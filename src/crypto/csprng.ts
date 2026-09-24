import * as Crypto from 'expo-crypto';

/**
 * Único ponto do app que gera bytes aleatórios (H1.4/H1.1 — regra de arquitetura).
 * Nenhum outro arquivo deve chamar `Math.random()` nem importar `expo-crypto`
 * diretamente — tudo passa por aqui. A regra de lint em `eslint.config.js` barra
 * `Math.random` em todo `src/`; este arquivo é o substituto correto.
 *
 * Por baixo, `expo-crypto` usa o gerador de números aleatórios seguro do próprio
 * sistema operacional (`SecureRandom` no Android, `SecRandomCopyBytes` no iOS) —
 * não é um algoritmo nosso, é o CSPRNG do SO. Ver arquitetura.md seção 9.
 */

/**
 * Gera `length` bytes aleatórios de forma síncrona.
 *
 * @param length quantidade de bytes a gerar — precisa ser um inteiro positivo.
 * @throws {RangeError} se `length` não for um inteiro positivo.
 */
export function randomBytes(length: number): Uint8Array {
  assertValidLength(length);
  return Crypto.getRandomBytes(length);
}

/**
 * Igual a {@link randomBytes}, mas assíncrona — preferível quando `length` é
 * grande ou a chamada acontece num caminho que já é async (evita bloquear a UI).
 */
export async function randomBytesAsync(length: number): Promise<Uint8Array> {
  assertValidLength(length);
  return Crypto.getRandomBytesAsync(length);
}

function assertValidLength(length: number): void {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError(`randomBytes: length precisa ser um inteiro positivo, recebeu ${length}`);
  }
}
