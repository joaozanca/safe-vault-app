// @op-engineering/op-sqlite é módulo nativo — não roda no Jest. Mesmo padrão
// das outras libs nativas do projeto: dublê no nível do pacote.
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(),
}));

// database.ts só usa DEK_BYTES de keyHierarchy.ts (uma constante), mas o
// import da cadeia inteira (keyHierarchy -> cipher -> react-native-quick-crypto)
// ainda é avaliado — precisa do mesmo mock de sempre pra não quebrar fora de
// um device/emulador real.
jest.mock('react-native-quick-crypto', () => ({
  Buffer: jest.requireActual('@craftzdog/react-native-buffer').Buffer,
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
}));

import { open } from '@op-engineering/op-sqlite';

import { DEK_BYTES } from '../crypto/keyHierarchy';
import { assertDatabaseUnlocked, DB_NAME, formatRawKey, openVaultDatabase } from './database';

const mockedOpen = open as jest.Mock;

describe('formatRawKey', () => {
  it('formata a DEK como x\'<64 hex chars>\' — o formato de chave bruta do SQLCipher', () => {
    const dek = new Uint8Array(DEK_BYTES).fill(0xab);
    const formatted = formatRawKey(dek);

    expect(formatted.startsWith("x'")).toBe(true);
    expect(formatted.endsWith("'")).toBe(true);
    // x' + 64 hex chars (32 bytes * 2) + ' = 67 caracteres — é exatamente o
    // que o parser do SQLCipher exige pra reconhecer como chave bruta
    // (ver sqlcipher_cipher_ctx_key_derive no sqlite3.c embutido na lib).
    expect(formatted.length).toBe(67);
  });

  it('rejeita DEK com tamanho errado', () => {
    expect(() => formatRawKey(new Uint8Array(16))).toThrow(RangeError);
  });
});

describe('openVaultDatabase', () => {
  beforeEach(() => {
    mockedOpen.mockReset();
  });

  it('chama open() com o nome do banco e a DEK já formatada como chave bruta', () => {
    const dek = new Uint8Array(DEK_BYTES).fill(1);
    mockedOpen.mockReturnValue({ execute: jest.fn() });

    openVaultDatabase(dek);

    expect(mockedOpen).toHaveBeenCalledWith({
      name: DB_NAME,
      encryptionKey: formatRawKey(dek),
    });
  });
});

describe('assertDatabaseUnlocked', () => {
  it('resolve sem erro quando a consulta de teste funciona (chave certa)', async () => {
    const db = { execute: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(assertDatabaseUnlocked(db as never)).resolves.toBeUndefined();
  });

  it('lança erro com mensagem clara quando a consulta falha (chave errada)', async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error('file is not a database')) };
    await expect(assertDatabaseUnlocked(db as never)).rejects.toThrow(
      'Não foi possível abrir o cofre',
    );
  });
});
