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

/**
 * Inteiro aleatório uniforme em `[0, maxExclusive)` — H4.1 (gerador de
 * senhas), escolher um índice de caractere num alfabeto sem viés.
 *
 * `byte % maxExclusive` sozinho enviesaria o resultado sempre que
 * `maxExclusive` não divide 256 exatamente (alguns restos saem mais vezes
 * que outros) — pouco importante pra um nonce, mas aqui afeta de verdade
 * quais caracteres saem mais numa senha gerada. Por isso descarta
 * (rejection sampling) qualquer byte que caia na sobra que quebraria a
 * uniformidade, e sorteia de novo.
 *
 * @throws {RangeError} se `maxExclusive` não for um inteiro entre 1 e 256.
 */
export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 256) {
    throw new RangeError(
      `randomInt: maxExclusive precisa ser um inteiro entre 1 e 256, recebeu ${maxExclusive}`,
    );
  }
  const limite = 256 - (256 % maxExclusive);
  let byte: number;
  do {
    byte = randomBytes(1)[0];
  } while (byte >= limite);
  return byte % maxExclusive;
}

function assertValidLength(length: number): void {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError(`randomBytes: length precisa ser um inteiro positivo, recebeu ${length}`);
  }
}
