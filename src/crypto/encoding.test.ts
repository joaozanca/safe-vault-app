import { bytesToHex, concatBytes, hexToBytes } from './encoding';

describe('encoding', () => {
  it('converte bytes conhecidos para o hex esperado', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe('0001ff');
    expect(bytesToHex(new Uint8Array([]))).toBe('');
  });

  it('converte hex conhecido de volta para os bytes esperados', () => {
    expect(hexToBytes('0001ff')).toEqual(new Uint8Array([0, 1, 255]));
    expect(hexToBytes('')).toEqual(new Uint8Array([]));
  });

  it('faz round-trip: bytes -> hex -> bytes devolve o original', () => {
    const original = new Uint8Array([1, 2, 3, 250, 251, 252, 253, 254, 255]);
    expect(hexToBytes(bytesToHex(original))).toEqual(original);
  });

  it('rejeita hex de tamanho ímpar', () => {
    expect(() => hexToBytes('abc')).toThrow(RangeError);
  });

  it('rejeita caractere que não é hexadecimal', () => {
    expect(() => hexToBytes('zz')).toThrow(RangeError);
  });

  it('concatBytes junta os pedaços na ordem dada', () => {
    const junto = concatBytes(new Uint8Array([1, 2]), new Uint8Array([]), new Uint8Array([3]));
    expect(junto).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('concatBytes sem argumentos devolve array vazio', () => {
    expect(concatBytes()).toEqual(new Uint8Array([]));
  });
});
