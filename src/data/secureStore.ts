import * as SecureStore from 'expo-secure-store';

import type { Argon2Params } from '../crypto/kdf';

/**
 * O "cabeçalho" do cofre: tudo que precisa estar acessível *antes* do banco
 * abrir — porque abrir o banco exige a DEK, e é justamente isto aqui que
 * guarda os embrulhos que dão acesso a ela. Não pode morar dentro do
 * vault.db (seria circular). Ver arquitetura.md seções 8 e 13.
 *
 * Os embrulhos ficam em hex (string), não Uint8Array — é o formato que dá
 * pra serializar em JSON sem conversão extra; quem desembrulha (VaultService)
 * converte de volta com hexToBytes.
 */
export interface HexWrap {
  nonce: string;
  ciphertext: string;
  authTag: string;
}

export interface VaultHeader {
  formatVersion: 1;
  kdfSalt: string;
  kdfParams: Argon2Params;
  dekWrap: {
    password: HexWrap;
    biometric?: HexWrap;
    recovery?: HexWrap;
  };
}

/**
 * H1.3 — versão do formato que este app sabe ler. Sobe quando o formato do
 * cabeçalho muda de um jeito incompatível (campo novo obrigatório, campo
 * removido). Nunca inferimos o formato pelo conteúdo — comparamos direto
 * com este número.
 */
export const SUPPORTED_FORMAT_VERSION = 1;

/**
 * Um cofre foi criado por uma versão do app que entende um formato mais
 * novo (ou mais velho, de um jeito que este app não sabe mais ler) do que
 * `SUPPORTED_FORMAT_VERSION`. Recusa educada, sem tentar adivinhar o
 * formato — ver analise-de-risco.md, "migração de esquema" é um dos
 * maiores riscos do projeto.
 */
export class UnsupportedVaultFormatError extends Error {
  constructor(public readonly foundVersion: number) {
    super(
      `Cofre no formato ${foundVersion}, mas este app só entende até a versão ` +
        `${SUPPORTED_FORMAT_VERSION}. Atualize o app antes de abrir este cofre.`,
    );
  }
}

/** Exportada só para teste (evita duplicar a string em secureStore.test.ts). */
export const VAULT_HEADER_KEY = 'safevault.vaultHeader';

/** Existe um cofre criado nesse aparelho? */
export async function hasVaultHeader(): Promise<boolean> {
  return (await SecureStore.getItemAsync(VAULT_HEADER_KEY)) !== null;
}

/**
 * Grava o cabeçalho do cofre — uma escrita só, um valor JSON só. É o que
 * garante que a gravação é "tudo ou nada": não existe um estado intermediário
 * com salt gravado mas sem o embrulho da DEK, por exemplo.
 */
export async function saveVaultHeader(header: VaultHeader): Promise<void> {
  await SecureStore.setItemAsync(VAULT_HEADER_KEY, JSON.stringify(header));
}

/**
 * @throws {UnsupportedVaultFormatError} se o cabeçalho gravado for de uma
 * versão de formato que este app não sabe ler.
 */
export async function loadVaultHeader(): Promise<VaultHeader | null> {
  const raw = await SecureStore.getItemAsync(VAULT_HEADER_KEY);
  if (!raw) return null;

  const header = JSON.parse(raw) as VaultHeader;
  if (header.formatVersion !== SUPPORTED_FORMAT_VERSION) {
    throw new UnsupportedVaultFormatError(header.formatVersion);
  }
  return header;
}

/** Usado só para desfazer uma criação de cofre que falhou no meio do caminho. */
export async function deleteVaultHeader(): Promise<void> {
  await SecureStore.deleteItemAsync(VAULT_HEADER_KEY);
}
