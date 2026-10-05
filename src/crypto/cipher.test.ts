// react-native-quick-crypto é um módulo nativo (Nitro) — cria o objeto
// nativo já na importação do pacote, então quebra fora de um device/
// emulador real, igual às outras libs nativas do projeto. Dublê no nível do
// pacote inteiro, incluindo Buffer (que aqui é só a implementação em JS
// puro de @craftzdog/react-native-buffer, funciona igual em qualquer lugar
// — não precisa mockar o Buffer em si, só as funções que dependem do
// módulo nativo).
import { Buffer } from '@craftzdog/react-native-buffer';

jest.mock('react-native-quick-crypto', () => ({
  Buffer: jest.requireActual('@craftzdog/react-native-buffer').Buffer,
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
}));

import { createCipheriv, createDecipheriv } from 'react-native-quick-crypto';

import {
  AES_GCM_NONCE_BYTES,
  AES_KEY_BYTES,
  decrypt,
  encrypt,
  type EncryptedPayload,
} from './cipher';

const mockedCreateCipheriv = createCipheriv as jest.Mock;
const mockedCreateDecipheriv = createDecipheriv as jest.Mock;

/** Cria um dublê mínimo de Cipher/Decipher só com os métodos que cipher.ts usa. */
function fakeCipherHandle(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    setAAD: jest.fn(),
    setAuthTag: jest.fn(),
    update: jest.fn().mockReturnValue(Buffer.alloc(0)),
    final: jest.fn().mockReturnValue(Buffer.alloc(0)),
    getAuthTag: jest.fn().mockReturnValue(Buffer.alloc(AES_GCM_NONCE_BYTES + 4)),
    ...overrides,
  };
}

describe('cipher.encrypt', () => {
  const key32 = new Uint8Array(AES_KEY_BYTES).fill(1);

  beforeEach(() => {
    mockedCreateCipheriv.mockReset();
  });

  it('chama createCipheriv com "aes-256-gcm", a key e um nonce de 12 bytes', () => {
    const handle = fakeCipherHandle();
    mockedCreateCipheriv.mockReturnValue(handle);

    const result = encrypt(key32, new Uint8Array([1, 2, 3]));

    expect(mockedCreateCipheriv).toHaveBeenCalledTimes(1);
    const [algorithm, calledKey, calledNonce] = mockedCreateCipheriv.mock.calls[0];
    expect(algorithm).toBe('aes-256-gcm');
    expect(calledKey).toBe(key32);
    expect(calledNonce).toBeInstanceOf(Uint8Array);
    expect(calledNonce.length).toBe(AES_GCM_NONCE_BYTES);
    expect(result.nonce).toBe(calledNonce);
  });

  it('duas chamadas seguidas usam nonces diferentes', () => {
    mockedCreateCipheriv.mockReturnValue(fakeCipherHandle());

    encrypt(key32, new Uint8Array([9]));
    encrypt(key32, new Uint8Array([9]));

    const [, , nonce1] = mockedCreateCipheriv.mock.calls[0];
    const [, , nonce2] = mockedCreateCipheriv.mock.calls[1];
    expect(Buffer.from(nonce1).equals(Buffer.from(nonce2))).toBe(false);
  });

  it('H5.2 — invariante: 10.000 cifragens com a mesma chave, nenhum nonce se repete', () => {
    // Nonce repetido com a mesma chave no AES-GCM quebra confidencialidade e
    // permite forjar dados — o pior erro possível nesta camada. Com 96 bits
    // sorteados, a chance real de colisão em 10.000 amostras é ~1e-20; se
    // este teste falhar, o defeito é na geração (ex.: nonce virou contador,
    // ou o CSPRNG devolve buffer reaproveitado), não azar estatístico.
    mockedCreateCipheriv.mockReturnValue(fakeCipherHandle());
    const vistos = new Set<string>();

    for (let i = 0; i < 10_000; i++) {
      const { nonce } = encrypt(key32, new Uint8Array([1]));
      vistos.add(Buffer.from(nonce).toString('hex'));
    }

    expect(vistos.size).toBe(10_000);
  });

  it('junta update()+final() como ciphertext e devolve a auth tag', () => {
    const handle = fakeCipherHandle({
      update: jest.fn().mockReturnValue(Buffer.from([10, 20])),
      final: jest.fn().mockReturnValue(Buffer.from([30])),
      getAuthTag: jest.fn().mockReturnValue(Buffer.from([255, 254])),
    });
    mockedCreateCipheriv.mockReturnValue(handle);

    const result = encrypt(key32, new Uint8Array([1]));

    expect(result.ciphertext).toEqual(new Uint8Array([10, 20, 30]));
    expect(result.authTag).toEqual(new Uint8Array([255, 254]));
  });

  it('passa o AAD para setAAD só quando fornecido', () => {
    const comAad = fakeCipherHandle();
    mockedCreateCipheriv.mockReturnValueOnce(comAad);
    encrypt(key32, new Uint8Array([1]), new Uint8Array([7, 7]));
    expect(comAad.setAAD).toHaveBeenCalledTimes(1);

    const semAad = fakeCipherHandle();
    mockedCreateCipheriv.mockReturnValueOnce(semAad);
    encrypt(key32, new Uint8Array([1]));
    expect(semAad.setAAD).not.toHaveBeenCalled();
  });

  it('rejeita key com tamanho errado, sem chamar createCipheriv', () => {
    expect(() => encrypt(new Uint8Array(16), new Uint8Array([1]))).toThrow(RangeError);
    expect(mockedCreateCipheriv).not.toHaveBeenCalled();
  });
});

describe('cipher.decrypt', () => {
  const key32 = new Uint8Array(AES_KEY_BYTES).fill(2);
  const payloadBase: EncryptedPayload = {
    nonce: new Uint8Array(AES_GCM_NONCE_BYTES).fill(3),
    ciphertext: new Uint8Array([1, 2, 3]),
    authTag: new Uint8Array(16).fill(4),
  };

  beforeEach(() => {
    mockedCreateDecipheriv.mockReset();
  });

  it('chama createDecipheriv com "aes-256-gcm", key e o nonce do payload, e seta a auth tag', () => {
    const handle = fakeCipherHandle();
    mockedCreateDecipheriv.mockReturnValue(handle);

    decrypt(key32, payloadBase);

    expect(mockedCreateDecipheriv).toHaveBeenCalledWith('aes-256-gcm', key32, payloadBase.nonce);
    expect(handle.setAuthTag).toHaveBeenCalledTimes(1);
  });

  it('devolve update()+final() concatenados', () => {
    const handle = fakeCipherHandle({
      update: jest.fn().mockReturnValue(Buffer.from([1, 2])),
      final: jest.fn().mockReturnValue(Buffer.from([3])),
    });
    mockedCreateDecipheriv.mockReturnValue(handle);

    expect(decrypt(key32, payloadBase)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('propaga o erro de final() quando a auth tag não bate (dado adulterado)', () => {
    const handle = fakeCipherHandle({
      final: jest.fn().mockImplementation(() => {
        throw new Error('Unsupported state or unable to authenticate data');
      }),
    });
    mockedCreateDecipheriv.mockReturnValue(handle);

    expect(() => decrypt(key32, payloadBase)).toThrow(/authenticate/);
  });

  it('rejeita nonce com tamanho errado no payload, sem chamar createDecipheriv', () => {
    expect(() =>
      decrypt(key32, { ...payloadBase, nonce: new Uint8Array(4) }),
    ).toThrow(RangeError);
    expect(mockedCreateDecipheriv).not.toHaveBeenCalled();
  });
});
