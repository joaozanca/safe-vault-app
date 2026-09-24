// react-native-argon2 é um módulo nativo — não existe fora de um device/
// emulador real, então não roda dentro do Jest. Substituímos por um dublê
// (jest.mock) para testar a NOSSA lógica de wrapping (parâmetros montados
// certo, resposta decodificada certo, piso de segurança respeitado) sem
// depender do cálculo criptográfico de verdade. É o mesmo raciocínio de
// mockar uma resposta de API no REST Assured/Cypress para testar como o seu
// código reage a ela, sem depender do servidor real estar de pé.
jest.mock('react-native-argon2', () => jest.fn());

import argon2 from 'react-native-argon2';

import { bytesToHex } from './encoding';
import { ARGON2_FLOOR, deriveKey } from './kdf';

const mockedArgon2 = argon2 as jest.MockedFunction<typeof argon2>;

describe('kdf.deriveKey', () => {
  beforeEach(() => {
    mockedArgon2.mockReset();
  });

  it('chama a lib nativa com os parâmetros no formato que ela espera', async () => {
    mockedArgon2.mockResolvedValue({ rawHash: '00'.repeat(32), encodedHash: 'irrelevante' });
    const salt = new Uint8Array([1, 2, 3, 4]);

    await deriveKey('minha-senha-mestra', salt, ARGON2_FLOOR);

    expect(mockedArgon2).toHaveBeenCalledWith('minha-senha-mestra', bytesToHex(salt), {
      iterations: ARGON2_FLOOR.iterations,
      memory: ARGON2_FLOOR.memoryKiB,
      parallelism: ARGON2_FLOOR.parallelism,
      hashLength: ARGON2_FLOOR.hashLengthBytes,
      mode: 'argon2id',
      saltEncoding: 'hex',
    });
  });

  it('devolve o rawHash decodificado como Uint8Array do tamanho pedido', async () => {
    const fakeHash = 'a1' + '00'.repeat(31); // 32 bytes
    mockedArgon2.mockResolvedValue({ rawHash: fakeHash, encodedHash: 'irrelevante' });

    const key = await deriveKey('senha', new Uint8Array([9]), ARGON2_FLOOR);

    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
    expect(key[0]).toBe(0xa1);
  });

  it('mesma senha, salt e params => sempre a mesma chave (contrato de determinismo)', async () => {
    // O Argon2id de verdade é determinístico (mesma entrada, mesma saída) —
    // isso é o que garante que a mesma senha mestra sempre reabra o cofre.
    // Aqui simulamos esse contrato fazendo o dublê responder de forma
    // determinística à mesma entrada, só para provar que deriveKey() não
    // introduz nenhuma aleatoriedade própria no meio do caminho.
    mockedArgon2.mockImplementation(async () => ({
      rawHash: 'cafe'.repeat(16),
      encodedHash: 'irrelevante',
    }));
    const salt = new Uint8Array([5, 6, 7]);

    const key1 = await deriveKey('senha-fixa', salt, ARGON2_FLOOR);
    const key2 = await deriveKey('senha-fixa', salt, ARGON2_FLOOR);

    expect(bytesToHex(key1)).toBe(bytesToHex(key2));
  });

  it('rejeita params abaixo do piso mínimo de segurança, sem chamar a lib nativa', async () => {
    await expect(
      deriveKey('senha', new Uint8Array([1]), { ...ARGON2_FLOOR, memoryKiB: 1024 }),
    ).rejects.toThrow(RangeError);

    expect(mockedArgon2).not.toHaveBeenCalled();
  });

  it('propaga o erro se a lib nativa falhar', async () => {
    mockedArgon2.mockRejectedValue(new Error('falha simulada do módulo nativo'));

    await expect(deriveKey('senha', new Uint8Array([1]), ARGON2_FLOOR)).rejects.toThrow(
      'falha simulada do módulo nativo',
    );
  });
});
