/**
 * Conversões e utilidades para trabalhar com bytes (`Uint8Array`) — hex de um
 * lado, concatenação do outro. Existe pra nenhum arquivo da camada de cripto
 * reinventar essas operações do seu jeito.
 */

const HEX_CHARS = '0123456789abcdef';

/** Converte bytes para uma string hexadecimal em minúsculas (ex.: `[10, 255]` → `'0aff'`). */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    hex += HEX_CHARS[byte >> 4] + HEX_CHARS[byte & 0x0f];
  }
  return hex;
}

/**
 * Converte uma string hexadecimal de volta para bytes.
 *
 * @throws {RangeError} se a string tiver tamanho ímpar ou contiver caractere
 * que não é hexadecimal — um hex válido sempre tem um número par de dígitos
 * (cada byte vira exatamente 2 caracteres).
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new RangeError(
      `hexToBytes: string de tamanho ímpar não é hex válido (recebeu ${hex.length} caracteres)`,
    );
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byteHex = hex.slice(i * 2, i * 2 + 2);
    const byte = parseInt(byteHex, 16);
    if (Number.isNaN(byte)) {
      throw new RangeError(`hexToBytes: "${byteHex}" não é um par hexadecimal válido`);
    }
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * Concatena vários `Uint8Array` num só, na ordem dada. Usado em cipher.ts
 * para juntar o que `update()`/`final()` de um cifrador devolvem em pedaços
 * separados.
 */
export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
