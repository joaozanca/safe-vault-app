import type { DB } from '@op-engineering/op-sqlite';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

import { calibrateParams } from '../crypto/calibration';
import { decrypt, encrypt } from '../crypto/cipher';
import { bytesToHex, hexToBytes } from '../crypto/encoding';
import { randomBytes } from '../crypto/csprng';
import { deriveKey, type Argon2Params } from '../crypto/kdf';
import { DEK_BYTES } from '../crypto/keyHierarchy';
import { openVaultDatabase } from '../data/database';
import { loadVaultHeader, saveVaultHeader, type VaultHeader } from '../data/secureStore';
import { VaultNotFoundError } from './VaultService';

/**
 * H2.3/H2.4 — exportar/importar o cofre num arquivo `.safevault` autocontido:
 * cabeçalho do cofre (salt/params/embrulhos da DEK) + o arquivo `vault.db`
 * inteiro, tudo cifrado sob uma chave derivada da **senha de exportação**
 * (arquitetura.md seção 11). Autocontido de propósito — importar num
 * aparelho novo não pode depender de nada que já esteja nesse aparelho.
 *
 * A senha mestra continua sendo exigida depois de importar (o cabeçalho
 * restaurado ainda pede ela pra desembrulhar a DEK) — a senha de exportação
 * só protege o arquivo em trânsito (Drive, e-mail, pendrive), não substitui
 * a mestra.
 *
 * Importar (H2.4) SUBSTITUI o cofre atual sem mesclagem (decisão do
 * refinamento, 2026-09-24) — ver `substituirCofre` e
 * `criarBackupDeSegurancaAntesDeImportar` para a salvaguarda de engenharia
 * contra essa operação ser destrutiva.
 */

const EXPORT_SALT_BYTES = 16;
const FORMAT_VERSION = 1;

export class WeakExportPasswordError extends Error {}
export class InvalidExportPasswordError extends Error {
  constructor() {
    super('Senha de exportação incorreta, ou arquivo corrompido.');
  }
}
export class UnsupportedExportFormatError extends Error {
  constructor(public readonly foundVersion: number) {
    super(
      `Backup no formato ${foundVersion}, mas este app só entende até a versão ` +
        `${FORMAT_VERSION}. Atualize o app antes de importar este arquivo.`,
    );
  }
}

interface ExportedVaultFile {
  formatVersion: 1;
  kdfSalt: string;
  kdfParams: Argon2Params;
  nonce: string;
  ciphertext: string;
  authTag: string;
}

interface ExportedPayload {
  vaultHeader: VaultHeader;
  dbFileBase64: string;
}

export type ForcaSenha = 'fraca' | 'media' | 'forte';

/**
 * Indicador de força exigido pela arquitetura (seção 11) — um sinal pra
 * informar a escolha do usuário, não um portão. Ao contrário da senha
 * mestra (`assertMasterPasswordPolicy`), a senha de exportação não tem
 * regra mínima obrigatória além de "não pode ser vazia": é um segredo de
 * uso raro, às vezes a própria senha mestra, às vezes uma frase que o
 * usuário já decorou de outro lugar — decisão dele.
 */
export function calcularForcaSenha(password: string): ForcaSenha {
  if (password.length < 8) return 'fraca';
  const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((c) => c.test(password)).length;
  if (password.length >= 16 && classes >= 3) return 'forte';
  if (classes >= 2) return 'media';
  return 'fraca';
}

/** `cofre-2026-09-30.safevault` — nome sugerido com a data de hoje. */
export function sugerirNomeArquivo(agora: Date = new Date()): string {
  const iso = agora.toISOString().slice(0, 10);
  return `cofre-${iso}.safevault`;
}

/**
 * Monta o conteúdo cifrado do backup (cabeçalho do cofre + `vault.db`
 * inteiro) — mas **não grava em lugar nenhum**. Quem chama decide onde
 * salvar (ver `salvarArquivoExportado`).
 *
 * @throws {WeakExportPasswordError} se a senha de exportação for vazia.
 * @throws {VaultNotFoundError} se não existir cofre neste aparelho.
 */
export async function exportarCofre(db: DB, exportPassword: string): Promise<string> {
  if (exportPassword.length === 0) {
    throw new WeakExportPasswordError('A senha de exportação não pode ser vazia.');
  }

  const header = await loadVaultHeader();
  if (!header) {
    throw new VaultNotFoundError('Nenhum cofre encontrado neste aparelho.');
  }

  const dbFileBase64 = await FileSystem.readAsStringAsync(dbFileUri(db), { encoding: 'base64' });
  const payload: ExportedPayload = { vaultHeader: header, dbFileBase64 };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

  const salt = randomBytes(EXPORT_SALT_BYTES);
  const calibration = await calibrateParams(salt);
  const exportKey = await deriveKey(exportPassword, salt, calibration.params);
  const encrypted = encrypt(exportKey, payloadBytes);

  const arquivo: ExportedVaultFile = {
    formatVersion: FORMAT_VERSION,
    kdfSalt: bytesToHex(salt),
    kdfParams: calibration.params,
    nonce: bytesToHex(encrypted.nonce),
    ciphertext: bytesToHex(encrypted.ciphertext),
    authTag: bytesToHex(encrypted.authTag),
  };

  return JSON.stringify(arquivo);
}

/**
 * Deixa o usuário escolher a pasta (Storage Access Framework) e grava o
 * conteúdo **numa escrita só** — nunca incremental. Assim, se a escrita for
 * interrompida no meio, o resultado é um arquivo vazio (obviamente
 * inválido), nunca um arquivo parcial que parece legítimo.
 *
 * @returns `false` se o usuário cancelou a escolha da pasta — não é erro.
 */
export async function salvarArquivoExportado(
  conteudo: string,
  nomeArquivo: string,
): Promise<boolean> {
  const permissao = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissao.granted) return false;

  const uri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissao.directoryUri,
    nomeArquivo,
    'application/octet-stream',
  );
  await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, conteudo);
  return true;
}

/**
 * Lê e decifra um arquivo `.safevault` (H2.4) — valida a auth tag antes de
 * devolver qualquer coisa. Só decifra; **não toca no cofre atual** (quem
 * chama decide o que fazer com o resultado — ver `substituirCofre` mais
 * abaixo).
 *
 * @throws {UnsupportedExportFormatError} se o arquivo for de uma versão que
 * este app não sabe ler.
 * @throws {InvalidExportPasswordError} se a senha estiver errada ou o
 * arquivo estiver corrompido (mensagem sempre genérica, mesma filosofia do
 * H1.2/H2.2 — não dá pra distinguir os dois casos com confiança).
 */
export async function lerArquivoExportado(
  conteudo: string,
  exportPassword: string,
): Promise<{ vaultHeader: VaultHeader; dbFileBase64: string }> {
  let arquivo: ExportedVaultFile;
  try {
    arquivo = JSON.parse(conteudo) as ExportedVaultFile;
  } catch {
    throw new InvalidExportPasswordError();
  }

  if (arquivo.formatVersion !== FORMAT_VERSION) {
    throw new UnsupportedExportFormatError(arquivo.formatVersion);
  }

  try {
    const salt = hexToBytes(arquivo.kdfSalt);
    const exportKey = await deriveKey(exportPassword, salt, arquivo.kdfParams);
    const payloadBytes = decrypt(exportKey, {
      nonce: hexToBytes(arquivo.nonce),
      ciphertext: hexToBytes(arquivo.ciphertext),
      authTag: hexToBytes(arquivo.authTag),
    });
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as ExportedPayload;
    return payload;
  } catch {
    throw new InvalidExportPasswordError();
  }
}

/**
 * Abre o seletor de arquivo do sistema (não o de pasta — H2.4 escolhe um
 * arquivo só). Usa a API nova do `expo-file-system` (`File.pickFileAsync`)
 * só pra abrir o seletor; a leitura do conteúdo em si usa a mesma API
 * legada do resto deste módulo, por consistência.
 *
 * @returns `null` se o usuário cancelou a escolha — não é erro.
 */
export async function escolherArquivoParaImportar(): Promise<{
  conteudo: string;
  nomeArquivo: string;
} | null> {
  const escolha = await File.pickFileAsync();
  if (escolha.canceled) return null;

  const conteudo = await FileSystem.readAsStringAsync(escolha.result.uri);
  return { conteudo, nomeArquivo: escolha.result.name };
}

/**
 * Salvaguarda de engenharia do H2.4: antes de substituir o cofre atual (uma
 * operação destrutiva e irreversível pela UI), faz um backup automático
 * cifrado do cofre atual — mesmo formato do H2.3, mas com a **senha mestra
 * já em memória da sessão** em vez de pedir uma senha de exportação nova.
 * Menos fricção num passo que já é uma salvaguarda, não uma ação que o
 * usuário pediu de propósito.
 *
 * Fica no armazenamento interno do próprio app (não pede pro usuário
 * escolher pasta — é automático, silencioso) — se algo der errado na
 * importação, este arquivo é o caminho de volta, decifrável com a mesma
 * senha mestra que o usuário já usa todo dia.
 *
 * @returns o caminho onde o backup de segurança foi salvo.
 */
export async function criarBackupDeSegurancaAntesDeImportar(
  db: DB,
  masterPassword: string,
): Promise<string> {
  const conteudo = await exportarCofre(db, masterPassword);

  const pasta = FileSystem.documentDirectory;
  if (!pasta) {
    throw new Error('Não foi possível encontrar o diretório de documentos do app.');
  }

  const caminho = `${pasta}backup-antes-de-importar-${Date.now()}.safevault`;
  await FileSystem.writeAsStringAsync(caminho, conteudo);
  return caminho;
}

/**
 * Substitui o cabeçalho e o arquivo do banco pelo conteúdo restaurado de um
 * backup (H2.4). Não abre o banco resultante — a DEK restaurada só desembrulha
 * com a senha mestra **original** daquele cofre, que quem importou pode nem
 * ter em mente agora (principalmente no caso "aparelho novo"). Depois de
 * importar, o fluxo normal é desbloquear como de costume.
 *
 * Troca de arquivo em 3 passos pra minimizar a janela de risco (escrever o
 * conteúdo novo nunca mexe no arquivo atual; só depois de pronto é que a
 * troca acontece, e a troca em si é um `rename`, rápido, não uma escrita
 * grande):
 * 1. Escreve o conteúdo novo num arquivo temporário (o banco atual continua
 *    intacto o tempo todo até aqui).
 * 2. Renomeia o banco atual pra um `.bak` (não apaga ainda).
 * 3. Renomeia o arquivo temporário pro lugar do banco.
 * Se o passo 3 falhar, desfaz (o `.bak` volta). Só depois de tudo certo é
 * que o cabeçalho novo é gravado — se isso falhar, o arquivo do banco
 * também é desfeito, pra nunca sobrar um cabeçalho e um banco de cofres
 * diferentes.
 *
 * **Risco residual, documentado e não eliminável com as APIs disponíveis:**
 * se o processo morrer exatamente entre os passos 2 e 3 (não uma exceção
 * JS, um `kill` de verdade), o app pode ficar sem nenhum `vault.db` no
 * lugar esperado até uma nova tentativa. É por isso que a salvaguarda
 * principal do H2.4 é o backup de segurança automático (ver
 * `criarBackupDeSegurancaAntesDeImportar`), não esta troca de arquivo por si
 * só — o backup cifrado é o que garante que nada se perde de verdade.
 *
 * @param dbAberto se já existe um cofre aberto sendo substituído (fluxo
 * "substituir"), passa a conexão pra reaproveitar o caminho e fechar antes
 * de mexer no arquivo. Omitido no fluxo "aparelho novo" (nenhum cofre
 * aberto ainda).
 */
export async function substituirCofre(
  novoHeader: VaultHeader,
  dbFileBase64: string,
  dbAberto?: DB,
): Promise<void> {
  const caminhoBanco = dbAberto ? dbAberto.getDbPath() : resolverCaminhoDoBanco();
  dbAberto?.close();

  const dbUri = caminhoBanco.startsWith('file://') ? caminhoBanco : `file://${caminhoBanco}`;
  const tmpUri = `${dbUri}.importando-tmp`;
  const bakUri = `${dbUri}.bak-antes-de-importar`;

  // No fluxo "aparelho novo", a pasta `databases/` pode nem existir ainda no
  // disco: abrir uma conexão só pra achar o caminho (ver
  // `resolverCaminhoDoBanco`) não força o SQLite a materializar o arquivo/
  // pasta de verdade — só a primeira operação real faz isso (mesmo
  // raciocínio do `vault.db` de 0 bytes documentado no backlog). Garantir a
  // pasta aqui evita um `IOException: ... isn't writable` na escrita abaixo.
  await FileSystem.makeDirectoryAsync(dirnameUri(dbUri), { intermediates: true }).catch(() => {});

  await FileSystem.writeAsStringAsync(tmpUri, dbFileBase64, { encoding: 'base64' });

  const atual = await FileSystem.getInfoAsync(dbUri);
  if (atual.exists) {
    await FileSystem.moveAsync({ from: dbUri, to: bakUri });
  }

  try {
    await FileSystem.moveAsync({ from: tmpUri, to: dbUri });
  } catch (erro) {
    if (atual.exists) {
      await FileSystem.moveAsync({ from: bakUri, to: dbUri });
    }
    throw erro;
  }

  try {
    await saveVaultHeader(novoHeader);
  } catch (erro) {
    await FileSystem.deleteAsync(dbUri, { idempotent: true });
    if (atual.exists) {
      await FileSystem.moveAsync({ from: bakUri, to: dbUri });
    }
    throw erro;
  }

  if (atual.exists) {
    await FileSystem.deleteAsync(bakUri, { idempotent: true });
  }
}

/**
 * Acha o caminho real de `vault.db` sem precisar de uma DEK válida — abre
 * com uma chave qualquer só pra perguntar pro op-sqlite onde ele criaria o
 * arquivo (a convenção de local é sempre a mesma, independente da chave) e
 * fecha na hora. Só usada quando ainda não existe nenhuma conexão aberta
 * (fluxo "aparelho novo", sem cofre prévio) — quando já existe, usa-se
 * `db.getDbPath()` da conexão já aberta.
 */
function resolverCaminhoDoBanco(): string {
  const dbTemporario = openVaultDatabase(new Uint8Array(DEK_BYTES));
  const caminho = dbTemporario.getDbPath();
  dbTemporario.close();
  return caminho;
}

/** `file:///a/b/arquivo.db` → `file:///a/b/` — a pasta que contém o arquivo. */
function dirnameUri(fileUri: string): string {
  return fileUri.slice(0, fileUri.lastIndexOf('/') + 1);
}

function dbFileUri(db: DB): string {
  const caminho = db.getDbPath();
  return caminho.startsWith('file://') ? caminho : `file://${caminho}`;
}
