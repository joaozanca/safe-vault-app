import { AES_KEY_BYTES, decrypt, encrypt, type EncryptedPayload } from './cipher';
import { randomBytes } from './csprng';

/**
 * Hierarquia de chaves KEK/DEK (arquitetura.md seção 5). A DEK (Data
 * Encryption Key) é quem realmente cifra os dados do cofre — sorteada uma
 * vez, na criação do cofre, e nunca muda. A KEK (Key Encryption Key) é
 * derivada da senha mestra (ou da chave de recuperação) só para
 * embrulhar/desembrulhar a DEK.
 *
 * Por que essa volta a mais: trocar a senha mestra fica barato (só
 * reembrulha a DEK, não recifra o banco inteiro) e biometria/recuperação
 * viram só embrulhos alternativos da mesma DEK, sem duplicar dado.
 */

/** Tamanho da DEK — 256 bits, o mesmo tamanho de chave que o AES-256-GCM espera. */
export const DEK_BYTES = AES_KEY_BYTES;

/** Sorteia uma DEK nova. Chamado uma única vez, na criação do cofre. */
export function generateDek(): Uint8Array {
  return randomBytes(DEK_BYTES);
}

/** Embrulha (cifra) a DEK com uma KEK — o resultado é o que vai persistido. */
export function wrapDek(kek: Uint8Array, dek: Uint8Array): EncryptedPayload {
  return encrypt(kek, dek);
}

/**
 * Desembrulha (decifra) a DEK com uma KEK.
 *
 * @throws {Error} se a KEK estiver errada (senha mestra incorreta) — a
 * auth tag não bate e o AEAD rejeita, ver cipher.ts.
 */
export function unwrapDek(kek: Uint8Array, wrapped: EncryptedPayload): Uint8Array {
  return decrypt(kek, wrapped);
}
