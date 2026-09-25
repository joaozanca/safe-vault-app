// react-native-libsodium é um módulo nativo (JSI) — não existe fora de um
// device/emulador real, então não roda dentro do Jest. Substituímos por um
// dublê para testar a NOSSA lógica de wrapping (parâmetros montados certo,
// piso de segurança respeitado, tamanho de salt validado) sem depender do
// cálculo criptográfico de verdade. Mesmo raciocínio de mockar uma resposta
// de API no REST Assured/Cypress para testar como o seu código reage a ela,
// sem depender do servidor real estar de pé.
jest.mock('react-native-libsodium', () => ({
  crypto_pwhash: jest.fn(),
  crypto_pwhash_ALG_ARGON2ID13: 2, // valor real da libsodium; só precisa ser estável para o teste comparar
}));

import { crypto_pwhash, crypto_pwhash_ALG_ARGON2ID13 } from 'react-native-libsodium';

import { bytesToHex } from './encoding';
import { ARGON2_FLOOR, ARGON2_SALT_BYTES, deriveKey } from './kdf';

// `crypto_pwhash` é uma função com 3 sobrecargas (retorna Uint8Array, string,
// ou unknown dependendo do outputFormat). `jest.MockedFunction<typeof ...>`
// tentaria unificar as três e o TypeScript escolhe a sobrecarga errada para
// inferir `.mockReturnValue()`. Como aqui só usamos a variante Uint8Array
// (nunca passamos outputFormat), tipamos o dublê direto para essa forma.
const mockedPwhash = crypto_pwhash as unknown as jest.MockedFunction<
  (
    keyLength: number,
    password: string,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
    algorithm: number,
  ) => Uint8Array
>;

describe('kdf.deriveKey', () => {
  const salt16 = new Uint8Array(ARGON2_SALT_BYTES).fill(7);

  beforeEach(() => {
    mockedPwhash.mockReset();
  });

  it('chama a libsodium com os parâmetros no formato que ela espera', async () => {
    mockedPwhash.mockReturnValue(new Uint8Array(32));

    await deriveKey('minha-senha-mestra', salt16, ARGON2_FLOOR);

    expect(mockedPwhash).toHaveBeenCalledWith(
      ARGON2_FLOOR.hashLengthBytes,
      'minha-senha-mestra',
      salt16,
      ARGON2_FLOOR.iterations, // opsLimit
      ARGON2_FLOOR.memoryKiB * 1024, // memLimit em BYTES, não KiB
      crypto_pwhash_ALG_ARGON2ID13,
    );
  });

  it('devolve exatamente o que a libsodium retornou, como Uint8Array', async () => {
    const fakeKey = new Uint8Array(32).fill(0xa1);
    mockedPwhash.mockReturnValue(fakeKey);

    const key = await deriveKey('senha', salt16, ARGON2_FLOOR);

    expect(key).toBe(fakeKey);
  });

  it('rejeita params abaixo do piso mínimo de segurança, sem chamar a libsodium', async () => {
    await expect(
      deriveKey('senha', salt16, { ...ARGON2_FLOOR, memoryKiB: 1024 }),
    ).rejects.toThrow(RangeError);

    expect(mockedPwhash).not.toHaveBeenCalled();
  });

  it('rejeita salt com tamanho errado, sem chamar a libsodium', async () => {
    const saltErrado = new Uint8Array(8); // libsodium exige 16 bytes exatos

    await expect(deriveKey('senha', saltErrado, ARGON2_FLOOR)).rejects.toThrow(RangeError);
    expect(mockedPwhash).not.toHaveBeenCalled();
  });

  it('propaga o erro se a libsodium falhar', async () => {
    mockedPwhash.mockImplementation(() => {
      throw new Error('falha simulada do módulo nativo');
    });

    await expect(deriveKey('senha', salt16, ARGON2_FLOOR)).rejects.toThrow(
      'falha simulada do módulo nativo',
    );
  });

  // Guarda de regressão: se algum dia trocarmos de biblioteca de novo, este
  // teste falha caso a nova mantenha rawHash em hex sem a gente converter —
  // é só um lembrete impresso, não uma asserção de verdade.
  it('bytesToHex do resultado tem o dobro de caracteres do hashLengthBytes pedido', async () => {
    mockedPwhash.mockReturnValue(new Uint8Array(ARGON2_FLOOR.hashLengthBytes));
    const key = await deriveKey('senha', salt16, ARGON2_FLOOR);
    expect(bytesToHex(key).length).toBe(ARGON2_FLOOR.hashLengthBytes * 2);
  });
});
