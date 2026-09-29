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
    db = openVaultDatabase(dek);
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
    await recordFailedAttempt();
    throw new InvalidMasterPasswordError('Senha incorreta.');
  }

  const db = openVaultDatabase(dek);
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

function assertMasterPasswordPolicy(password: string): void {
  const faltando: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    faltando.push(`mínimo de ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (!/[A-Z]/.test(password)) faltando.push('ao menos 1 letra maiúscula');
  if (!/[a-z]/.test(password)) faltando.push('ao menos 1 letra minúscula');
  if (!/[0-9]/.test(password)) faltando.push('ao menos 1 número');

  if (faltando.length > 0) {
    throw new WeakMasterPasswordError(`Senha mestra fraca — falta: ${faltando.join(', ')}.`);
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
