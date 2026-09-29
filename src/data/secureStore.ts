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

const VAULT_HEADER_KEY = 'safevault.vaultHeader';

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

export async function loadVaultHeader(): Promise<VaultHeader | null> {
  const raw = await SecureStore.getItemAsync(VAULT_HEADER_KEY);
  return raw ? (JSON.parse(raw) as VaultHeader) : null;
}

/** Usado só para desfazer uma criação de cofre que falhou no meio do caminho. */
export async function deleteVaultHeader(): Promise<void> {
  await SecureStore.deleteItemAsync(VAULT_HEADER_KEY);
}
