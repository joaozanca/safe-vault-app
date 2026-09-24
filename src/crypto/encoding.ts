/**
 * Conversões entre bytes (`Uint8Array`) e texto hexadecimal.
 *
 * Por que isto existe: bibliotecas nativas de criptografia costumam só aceitar
 * string como entrada/saída (é o caso do `react-native-argon2` — ver kdf.ts),
 * mas o resto da camada de cripto trabalha com `Uint8Array` (o tipo que
 * `csprng.ts` devolve). Em vez de cada arquivo converter do seu jeito, a
 * conversão mora só aqui.
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
