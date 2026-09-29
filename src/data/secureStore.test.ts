// O auto-mock que o jest-expo dá pra expo-secure-store não guarda estado —
// getItemAsync sempre devolve undefined, não importa o que setItemAsync
// "gravou". Pra testar de verdade a nossa lógica de round-trip (grava, lê de
// volta, apaga), precisamos de um dublê com um Map por trás fazendo o papel
// de armazenamento de verdade — só assim o teste prova algo além de "a
// função não lançou exceção".
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import * as SecureStore from 'expo-secure-store';

import {
  deleteVaultHeader,
  hasVaultHeader,
  loadVaultHeader,
  saveVaultHeader,
  UnsupportedVaultFormatError,
  VAULT_HEADER_KEY,
  type VaultHeader,
} from './secureStore';

const sampleHeader: VaultHeader = {
  formatVersion: 1,
  kdfSalt: 'aa'.repeat(16),
  kdfParams: { memoryKiB: 19456, iterations: 2, parallelism: 1, hashLengthBytes: 32 },
  dekWrap: {
    password: { nonce: '11'.repeat(12), ciphertext: '22'.repeat(32), authTag: '33'.repeat(16) },
  },
};

describe('secureStore (vault header)', () => {
  it('não existe cabeçalho antes de qualquer gravação', async () => {
    expect(await hasVaultHeader()).toBe(false);
    expect(await loadVaultHeader()).toBeNull();
  });

  it('grava e lê o cabeçalho de volta, byte a byte igual', async () => {
    await saveVaultHeader(sampleHeader);

    expect(await hasVaultHeader()).toBe(true);
    expect(await loadVaultHeader()).toEqual(sampleHeader);
  });

  it('deleteVaultHeader remove — hasVaultHeader volta a false', async () => {
    await saveVaultHeader(sampleHeader);
    await deleteVaultHeader();

    expect(await hasVaultHeader()).toBe(false);
  });

  it('loadVaultHeader recusa um cabeçalho de formato desconhecido (H1.3)', async () => {
    // Simula um cofre gravado por uma versão futura do app — escreve direto
    // no dublê, contornando o tipo `formatVersion: 1` de VaultHeader (é
    // exatamente por causa desse tipo que isto não pode acontecer com
    // saveVaultHeader() dentro do próprio app; só um cofre vindo de fora, ou
    // de uma versão diferente, chegaria assim).
    const headerFuturo = { ...sampleHeader, formatVersion: 2 };
    await SecureStore.setItemAsync(VAULT_HEADER_KEY, JSON.stringify(headerFuturo));

    await expect(loadVaultHeader()).rejects.toThrow(UnsupportedVaultFormatError);
  });
});
