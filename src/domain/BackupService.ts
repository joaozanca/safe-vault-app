import type { DB } from '@op-engineering/op-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

import { calibrateParams } from '../crypto/calibration';
import { decrypt, encrypt } from '../crypto/cipher';
import { bytesToHex, hexToBytes } from '../crypto/encoding';
import { randomBytes } from '../crypto/csprng';
import { deriveKey, type Argon2Params } from '../crypto/kdf';
import { loadVaultHeader, type VaultHeader } from '../data/secureStore';
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
 * chama decide o que fazer com o resultado — ver `VaultService` para a
 * substituição em si).
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

function dbFileUri(db: DB): string {
  const caminho = db.getDbPath();
  return caminho.startsWith('file://') ? caminho : `file://${caminho}`;
}
