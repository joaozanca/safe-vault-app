// keyHierarchy.ts importa cipher.ts, que importa react-native-quick-crypto —
// mesmo mock de sempre, pela mesma razão (o módulo nativo quebra fora de um
// device/emulador real só de ser importado).
jest.mock('react-native-quick-crypto', () => ({
  Buffer: jest.requireActual('@craftzdog/react-native-buffer').Buffer,
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
}));

import { Buffer } from '@craftzdog/react-native-buffer';
import { createCipheriv, createDecipheriv } from 'react-native-quick-crypto';

import { DEK_BYTES, generateDek, unwrapDek, wrapDek } from './keyHierarchy';

const mockedCreateCipheriv = createCipheriv as jest.Mock;
const mockedCreateDecipheriv = createDecipheriv as jest.Mock;

function fakeCipherHandle() {
  return {
    setAAD: jest.fn(),
    setAuthTag: jest.fn(),
    update: jest.fn().mockReturnValue(Buffer.alloc(0)),
    final: jest.fn().mockReturnValue(Buffer.alloc(0)),
    getAuthTag: jest.fn().mockReturnValue(Buffer.alloc(16)),
  };
}

describe('keyHierarchy', () => {
  beforeEach(() => {
    mockedCreateCipheriv.mockReset();
    mockedCreateDecipheriv.mockReset();
  });

  it('generateDek devolve 32 bytes', () => {
    expect(generateDek().length).toBe(DEK_BYTES);
  });

  it('generateDek não repete entre chamadas', () => {
    const a = generateDek();
    const b = generateDek();
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('wrapDek delega para a cifra com a KEK como chave', () => {
    mockedCreateCipheriv.mockReturnValue(fakeCipherHandle());
    const kek = new Uint8Array(32).fill(9);
    const dek = generateDek();

    wrapDek(kek, dek);

    const [, calledKey] = mockedCreateCipheriv.mock.calls[0];
    expect(calledKey).toBe(kek);
  });

  it('unwrapDek delega para a decifra com a KEK como chave', () => {
    mockedCreateDecipheriv.mockReturnValue(fakeCipherHandle());
    const kek = new Uint8Array(32).fill(9);
    const wrapped = { nonce: new Uint8Array(12), ciphertext: new Uint8Array(32), authTag: new Uint8Array(16) };

    unwrapDek(kek, wrapped);

    const [, calledKey] = mockedCreateDecipheriv.mock.calls[0];
    expect(calledKey).toBe(kek);
  });
});
