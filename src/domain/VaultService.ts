import type { DB } from '@op-engineering/op-sqlite';

import { calibrateParams } from '../crypto/calibration';
import type { EncryptedPayload } from '../crypto/cipher';
import { bytesToHex, hexToBytes } from '../crypto/encoding';
import { randomBytes } from '../crypto/csprng';
import { deriveKey } from '../crypto/kdf';
import { generateDek, unwrapDek, wrapDek } from '../crypto/keyHierarchy';
import { assertDatabaseUnlocked, openVaultDatabase } from '../data/database';
import {
  deleteVaultHeader,
  hasVaultHeader,
  loadVaultHeader,
  saveVaultHeader,
  type HexWrap,
  type VaultHeader,
} from '../data/secureStore';
import {
  getLockoutState,
  recordFailedAttempt,
  recordSuccessfulUnlock,
  remainingLockoutMs,
} from './UnlockAttemptTracker';

/** H1.1 — mínimo de 8 caracteres, maiúscula, minúscula e número. */
const MIN_PASSWORD_LENGTH = 8;

/** H1.1 — salt do Argon2id: 16 bytes (ver kdf.ts, ARGON2_SALT_BYTES). */
const KDF_SALT_BYTES = 16;

export class WeakMasterPasswordError extends Error {}
export class VaultAlreadyExistsError extends Error {}
export class VaultNotFoundError extends Error {}
export class InvalidMasterPasswordError extends Error {}

/** H1.2 — bloqueio progressivo por tentativas erradas ainda em vigor. */
export class VaultLockedError extends Error {
  constructor(public readonly remainingMs: number) {
    super('Cofre bloqueado por excesso de tentativas erradas.');
  }
}

/**
 * Cria o cofre: valida a senha mestra, calibra o Argon2id neste device,
 * deriva a KEK, sorteia a DEK, embrulha a DEK com a KEK, grava o cabeçalho
 * no secure-store e cria o banco SQLCipher com a DEK.
 *
 * "Tudo ou nada" (H1.1): a gravação do cabeçalho é uma escrita atômica só;
 * se a criação do banco falhar depois disso, desfazemos o cabeçalho e o
 * arquivo do banco, para não deixar um cofre meio-criado que confunda a
 * próxima tentativa.
 *
 * @throws {WeakMasterPasswordError} se a senha não atender a política mínima.
 * @throws {VaultAlreadyExistsError} se já existir um cofre neste aparelho.
 */
export async function createVault(masterPassword: string): Promise<void> {
  assertMasterPasswordPolicy(masterPassword);

  if (await hasVaultHeader()) {
    throw new VaultAlreadyExistsError('Já existe um cofre neste aparelho.');
  }

  const salt = randomBytes(KDF_SALT_BYTES);
  const calibration = await calibrateParams(salt);
  const kek = await deriveKey(masterPassword, salt, calibration.params);
  const dek = generateDek();
  const wrapped = wrapDek(kek, dek);

  const header: VaultHeader = {
    formatVersion: 1,
    kdfSalt: bytesToHex(salt),
    kdfParams: calibration.params,
    dekWrap: { password: toHexWrap(wrapped) },
  };

  await saveVaultHeader(header);

  let db: DB | undefined;
  try {
    db = await openVaultDatabase(dek);
    await assertDatabaseUnlocked(db);
    db.close();
  } catch (erro) {
    db?.delete();
    await deleteVaultHeader();
    throw erro;
  }
}

/**
 * Desbloqueia o cofre com a senha mestra: carrega o cabeçalho, deriva a KEK
 * com o salt/params gravados, desembrulha a DEK e abre o banco com ela.
 *
 * Devolve a conexão já aberta — quem chama é responsável por fechar
 * (`db.close()`) quando trancar o cofre.
 *
 * Mensagem de erro sempre genérica para senha errada (H1.2): não vaza se o
 * cofre existe nem quão perto a senha chegou de estar certa.
 *
 * Bloqueio progressivo por tentativas erradas (H1.2, `UnlockAttemptTracker`):
 * se o cofre já está bloqueado, recusa **antes** de tentar qualquer coisa
 * (nem chega a rodar o Argon2id) — `VaultLockedError` carrega quanto tempo
 * falta, para a UI mostrar a contagem regressiva. Toda tentativa que chega a
 * ser avaliada conta: errada incrementa o contador (e pode disparar um novo
 * bloqueio), certa zera tudo.
 *
 * @throws {VaultNotFoundError} se não existir cofre neste aparelho.
 * @throws {VaultLockedError} se o cofre estiver bloqueado por excesso de
 * tentativas erradas.
 * @throws {InvalidMasterPasswordError} se a senha estiver errada.
 */
export async function unlockVault(masterPassword: string): Promise<DB> {
  const header = await loadVaultHeader();
  if (!header) {
    throw new VaultNotFoundError('Nenhum cofre encontrado neste aparelho.');
  }

  const lockout = await getLockoutState();
  const remaining = remainingLockoutMs(lockout);
  if (remaining > 0) {
    throw new VaultLockedError(remaining);
  }

  const salt = hexToBytes(header.kdfSalt);
  const kek = await deriveKey(masterPassword, salt, header.kdfParams);

  let dek: Uint8Array;
  try {
    dek = unwrapDek(kek, fromHexWrap(header.dekWrap.password));
  } catch {
    const estado = await recordFailedAttempt();
    // H1.2 — a tentativa que COMPLETA um bloco de erradas já devolve o
    // bloqueio, com o tempo restante. Antes ela devolvia "Senha incorreta." e
    // o bloqueio só aparecia na tentativa seguinte — o dono do cofre digitava
    // a senha certa e só então descobria que estava bloqueado.
    const restante = remainingLockoutMs(estado);
    if (restante > 0) {
      throw new VaultLockedError(restante);
    }
    throw new InvalidMasterPasswordError('Senha incorreta.');
  }

  const db = await openVaultDatabase(dek);
  try {
    await assertDatabaseUnlocked(db);
  } catch {
    db.close();
    // Chave certa o bastante para a auth tag do embrulho bater, mas o
    // banco não abre — cofre corrompido, não senha errada. Ainda assim
    // usamos a mensagem genérica: do ponto de vista de quem está
    // desbloqueando, não há como distinguir com confiança os dois casos
    // sem arriscar vazar informação. Não conta como tentativa errada —
    // a senha estava certa, o problema é outro.
    throw new InvalidMasterPasswordError('Senha incorreta.');
  }

  await recordSuccessfulUnlock();
  return db;
}

/** H2.1 — chave de recuperação: 256 bits, mesmo tamanho de chave AES-256-GCM. */
const RECOVERY_KEY_BYTES = 32;

export interface RecoveryKeyGerada {
  /** Só existe na memória enquanto a tela está aberta — nunca persistir em claro. */
  recoveryKey: Uint8Array;
  /** Pronto pra gravar, mas só depois que o usuário confirmar que guardou a chave. */
  wrap: HexWrap;
}

/**
 * Sorteia uma chave de recuperação nova e embrulha uma segunda cópia da DEK
 * com ela — mas **não grava nada ainda** (ver `confirmarChaveDeRecuperacao`).
 *
 * Ao contrário da senha mestra, a chave de recuperação já nasce com 256 bits
 * de entropia real (CSPRNG, não escolhida por humano) — não precisa de
 * Argon2id pra compensar senha fraca. Usada direto como chave AES-256-GCM
 * pra embrulhar a DEK, do mesmo jeito que a KEK derivada da senha mestra.
 *
 * Reaproveitada tanto pela configuração inicial (H2.1, logo após criar o
 * cofre) quanto pela rotação depois de um uso bem-sucedido da chave antiga
 * (H2.2, decisão do refinamento de 2026-09-30) — as duas situações são "gerar
 * uma chave nova e trocar o embrulho", só muda quando são chamadas.
 *
 * @throws {VaultNotFoundError} se não existir cofre neste aparelho.
 * @throws {Error} se `masterPassword` estiver errada (auth tag não bate).
 */
export async function gerarChaveDeRecuperacao(masterPassword: string): Promise<RecoveryKeyGerada> {
  const header = await loadVaultHeader();
  if (!header) {
    throw new VaultNotFoundError('Nenhum cofre encontrado neste aparelho.');
  }

  const salt = hexToBytes(header.kdfSalt);
  const kek = await deriveKey(masterPassword, salt, header.kdfParams);
  const dek = unwrapDek(kek, fromHexWrap(header.dekWrap.password));

  const recoveryKey = randomBytes(RECOVERY_KEY_BYTES);
  const wrapped = wrapDek(recoveryKey, dek);

  return { recoveryKey, wrap: toHexWrap(wrapped) };
}

/**
 * A recuperação (H2.1) ainda não foi configurada neste cofre — nunca
 * chamada `confirmarChaveDeRecuperacao`, ou a app fechou entre gerar e
 * confirmar. A UI usa isto pra decidir se mostra a tela de chave de
 * recuperação (na criação, ou de novo ao desbloquear se ficou pendente).
 */
export async function precisaConfigurarRecuperacao(): Promise<boolean> {
  const header = await loadVaultHeader();
  return header !== null && header.dekWrap.recovery === undefined;
}

/**
 * Grava o embrulho de recuperação no cabeçalho — só chamado depois que o
 * usuário confirma ativamente que guardou a chave ("guardei em local
 * seguro").
 *
 * "Erro" do H2.1 (decisão do refinamento, 2026-09-24): se o app fechar entre
 * `gerarChaveDeRecuperacao` e esta função, nada foi gravado — a própria
 * ausência de `dekWrap.recovery` no cabeçalho é o sinal de "ainda não
 * configurado", sem precisar de uma flag separada pra rastrear. Na próxima
 * vez que o cofre for aberto, a UI vê a ausência e oferece gerar de novo (a
 * chave antiga nunca chegou a existir gravada, então não tem o que
 * invalidar).
 */
export async function confirmarChaveDeRecuperacao(wrap: HexWrap): Promise<void> {
  const header = await loadVaultHeader();
  if (!header) {
    throw new VaultNotFoundError('Nenhum cofre encontrado neste aparelho.');
  }

  await saveVaultHeader({
    ...header,
    dekWrap: { ...header.dekWrap, recovery: wrap },
  });
}

/**
 * Chave de recuperação errada, malformada, ou nunca configurada — sempre a
 * mesma mensagem genérica (H1.2, mesma filosofia: não vaza se o cofre
 * existe nem se a chave chegou perto de estar certa).
 */
export class InvalidRecoveryKeyError extends Error {
  constructor() {
    super('Chave de recuperação inválida.');
  }
}

/**
 * `abc123` mostrada como `e51a-bda1-c28c-...` (blocos de 4, ver
 * RecoveryKeyScreen.tsx) — aceita de volta com ou sem os traços, letra
 * maiúscula ou minúscula, tanto faz como o usuário colar. Só o conteúdo hex
 * importa.
 *
 * @throws {Error} se, depois de limpar, não sobrarem exatamente
 * `RECOVERY_KEY_BYTES * 2` dígitos hex.
 */
function parseChaveDeRecuperacao(texto: string): Uint8Array {
  const hexLimpo = texto.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (hexLimpo.length !== RECOVERY_KEY_BYTES * 2) {
    throw new RangeError('Formato de chave de recuperação inválido.');
  }
  return hexToBytes(hexLimpo);
}

/**
 * H2.2 — recupera o acesso com a chave de recuperação, definindo uma nova
 * senha mestra no processo (não existe "descobrir a senha antiga", só
 * trocar — a antiga fica esquecida de vez, por desenho).
 *
 * Rotação da chave de recuperação (decisão do refinamento, 2026-09-30): a
 * chave antiga é invalidada **aqui mesmo**, dentro desta função — o
 * cabeçalho sai gravado sem `dekWrap.recovery`. Essa ausência é o mesmo
 * sinal que `precisaConfigurarRecuperacao()` já usa para o H2.1, então a UI
 * volta sozinha pra tela de exibição única de uma chave nova, sem precisar
 * de lógica extra pra distinguir "primeira configuração" de "rotação".
 *
 * @throws {WeakMasterPasswordError} se a nova senha não atender a política.
 * @throws {VaultNotFoundError} se não existir cofre neste aparelho.
 * @throws {InvalidRecoveryKeyError} se a chave de recuperação estiver
 * errada, malformada, ou nunca tiver sido configurada.
 */
export async function entrarComChaveDeRecuperacao(
  recoveryKeyTexto: string,
  novaSenhaMestra: string,
): Promise<DB> {
  assertMasterPasswordPolicy(novaSenhaMestra);

  const header = await loadVaultHeader();
  if (!header) {
    throw new VaultNotFoundError('Nenhum cofre encontrado neste aparelho.');
  }

  let dek: Uint8Array;
  try {
    if (!header.dekWrap.recovery) {
      throw new Error('sem chave de recuperação configurada neste cofre');
    }
    const recoveryKey = parseChaveDeRecuperacao(recoveryKeyTexto);
    dek = unwrapDek(recoveryKey, fromHexWrap(header.dekWrap.recovery));
  } catch {
    throw new InvalidRecoveryKeyError();
  }

  const salt = randomBytes(KDF_SALT_BYTES);
  const calibration = await calibrateParams(salt);
  const kek = await deriveKey(novaSenhaMestra, salt, calibration.params);
  const novoWrapSenha = wrapDek(kek, dek);

  await saveVaultHeader({
    ...header,
    kdfSalt: bytesToHex(salt),
    kdfParams: calibration.params,
    dekWrap: { ...header.dekWrap, password: toHexWrap(novoWrapSenha), recovery: undefined },
  });

  const db = await openVaultDatabase(dek);
  await assertDatabaseUnlocked(db);
  await recordSuccessfulUnlock();
  return db;
}

/**
 * `\p{Extended_Pictographic}` é a categoria que o próprio padrão Unicode
 * define como "isto é emoji" — não dá pra listar emoji um a um (são
 * milhares, e crescem a cada versão do Unicode), então usamos a
 * classificação oficial. Suportado nativamente pelo JS desde 2018, mas
 * verificado de propósito no Hermes (o motor do React Native no device),
 * não só no V8 do Jest — ver VaultService.test.ts.
 *
 * Precisa de `\p{Regional_Indicator}` também: bandeira (🇧🇷) não é
 * "Extended_Pictographic" — é feita de duas "letras indicadoras
 * regionais" (🇧 + 🇷), uma categoria Unicode separada. Sem isso, bandeira
 * passaria pela checagem sem ser barrada (achado pelo próprio teste
 * automatizado desta função, não em produção).
 *
 * Decisão do refinamento, 2026-09-29: emoji fora da senha mestra. Motivo
 * não é teórico — é reação a um defeito real que achamos no app (acento
 * com tecla morta não compondo certo, ver Issue do GitHub). Emoji composto
 * (família, tom de pele, bandeira) usa o mesmo tipo de composição por
 * baixo; até esse defeito estar corrigido e testado a fundo, bloquear é a
 * escolha mais segura.
 */
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/**
 * `\p{Diacritic}` sozinho não pega letra acentuada precomposta (`á` é 1
 * code point só, não carrega a propriedade Diacritic — só a marca
 * combinante separada, tipo `´`, carrega). Por isso normalizamos pra NFD
 * antes de checar: isso decompõe `á` em `a` + acento combinante, aí sim
 * `\p{Diacritic}` pega tanto a forma precomposta quanto a já decomposta.
 * Mesmo mecanismo Unicode documentado no achado de 2026-09-30 em
 * kdf.ts/deriveKey — aqui é a mesma história por outro ângulo: bloquear na
 * política em vez de normalizar na derivação.
 *
 * Decisão do refinamento, 2026-09-30: acento fora da senha mestra. Reação
 * à Issue #1 (composição por tecla morta quebrada no TextInput do Fabric,
 * limitação de upstream do React Native confirmada — não corrigível só no
 * código do app). Até esse defeito ser corrigido rio acima, bloquear é a
 * forma de garantir que a senha exibida na hora de criar é sempre a mesma
 * que vai ser digitada na hora de desbloquear.
 */
const ACCENT_PATTERN = /\p{Diacritic}/u;
function temAcento(password: string): boolean {
  return ACCENT_PATTERN.test(password.normalize('NFD'));
}

function assertMasterPasswordPolicy(password: string): void {
  const problemas: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    problemas.push(`precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (!/[A-Z]/.test(password)) problemas.push('precisa ter ao menos 1 letra maiúscula');
  if (!/[a-z]/.test(password)) problemas.push('precisa ter ao menos 1 letra minúscula');
  if (!/[0-9]/.test(password)) problemas.push('precisa ter ao menos 1 número');
  if (EMOJI_PATTERN.test(password)) problemas.push('não pode conter emoji');
  if (temAcento(password)) problemas.push('não pode conter letra acentuada (ex.: ã, ç, é)');

  if (problemas.length > 0) {
    throw new WeakMasterPasswordError(`Senha mestra inválida: ${problemas.join('; ')}.`);
  }
}

function toHexWrap(payload: EncryptedPayload): HexWrap {
  return {
    nonce: bytesToHex(payload.nonce),
    ciphertext: bytesToHex(payload.ciphertext),
    authTag: bytesToHex(payload.authTag),
  };
}

function fromHexWrap(wrap: HexWrap): EncryptedPayload {
  return {
    nonce: hexToBytes(wrap.nonce),
    ciphertext: hexToBytes(wrap.ciphertext),
    authTag: hexToBytes(wrap.authTag),
  };
}
