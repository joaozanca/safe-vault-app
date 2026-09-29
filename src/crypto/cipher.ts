// `Buffer` vem da própria react-native-quick-crypto (que reexporta a
// implementação de @craftzdog/react-native-buffer) — não existe Buffer global
// no React Native como existe no Node. `update()`/`final()` aceitam
// Uint8Array puro (por isso plaintext/ciphertext passam direto), mas
// `setAAD()`/`setAuthTag()` pedem especificamente este tipo Buffer, então
// convertemos só nesses dois pontos.
import { Buffer, createCipheriv, createDecipheriv } from 'react-native-quick-crypto';

import { concatBytes } from './encoding';
import { randomBytes } from './csprng';

/** AES-256 — chave de 32 bytes (256 bits). */
export const AES_KEY_BYTES = 32;

/**
 * Nonce de 96 bits, sorteado a cada chamada de `encrypt()` — nunca reaproveitado,
 * nunca um contador. Ver arquitetura.md seção 6 para o porquê: reutilizar nonce
 * com a mesma chave no AES-GCM quebra a confidencialidade e permite forjar dados.
 */
export const AES_GCM_NONCE_BYTES = 12;

/** Tamanho da auth tag do AES-GCM — o "selo" que denuncia adulteração. */
export const AES_GCM_TAG_BYTES = 16;

/** O que `encrypt()` devolve: os três pedaços que `decrypt()` precisa de volta. */
export interface EncryptedPayload {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
}

/**
 * Cifra `plaintext` com AES-256-GCM. Sorteia um nonce novo (via `csprng.ts` —
 * nunca `Math.random`, nunca reaproveitado) a cada chamada, mesmo cifrando o
 * mesmo dado duas vezes com a mesma chave.
 *
 * `aad` (associated data) é opcional: dado extra que entra na verificação de
 * integridade mas não é cifrado — útil para amarrar o ciphertext a um
 * contexto (ex.: "isto é uma DEK embrulhada pela senha mestra", não outra
 * coisa) sem ele fazer parte do conteúdo secreto.
 *
 * @throws {RangeError} se `key` não tiver exatamente `AES_KEY_BYTES` bytes.
 */
export function encrypt(key: Uint8Array, plaintext: Uint8Array, aad?: Uint8Array): EncryptedPayload {
  assertKeyLength(key);
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);

  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  if (aad) {
    cipher.setAAD(Buffer.from(aad));
  }
  const ciphertext = concatBytes(cipher.update(plaintext), cipher.final());
  const authTag = new Uint8Array(cipher.getAuthTag());

  return { nonce, ciphertext, authTag };
}

/**
 * Decifra um `EncryptedPayload` gerado por `encrypt()` com a mesma `key` e o
 * mesmo `aad` (se algum foi usado). Se a auth tag não bater — chave errada,
 * dado adulterado, ou `aad` diferente — lança erro em vez de devolver lixo:
 * é o AEAD fazendo exatamente o que promete.
 *
 * @throws {RangeError} se `key` ou `payload.nonce` não tiverem o tamanho
 * esperado.
 * @throws {Error} se a auth tag não for válida (dado corrompido/adulterado).
 */
export function decrypt(key: Uint8Array, payload: EncryptedPayload, aad?: Uint8Array): Uint8Array {
  assertKeyLength(key);
  assertNonceLength(payload.nonce);

  const decipher = createDecipheriv('aes-256-gcm', key, payload.nonce);
  if (aad) {
    decipher.setAAD(Buffer.from(aad));
  }
  decipher.setAuthTag(Buffer.from(payload.authTag));

  // final() é quem de fato verifica a auth tag — lança aqui se não bater.
  return concatBytes(decipher.update(payload.ciphertext), decipher.final());
}

function assertKeyLength(key: Uint8Array): void {
  if (key.length !== AES_KEY_BYTES) {
    throw new RangeError(
      `AES-256-GCM: key precisa ter exatamente ${AES_KEY_BYTES} bytes, recebeu ${key.length}`,
    );
  }
}

function assertNonceLength(nonce: Uint8Array): void {
  if (nonce.length !== AES_GCM_NONCE_BYTES) {
    throw new RangeError(
      `AES-256-GCM: nonce precisa ter exatamente ${AES_GCM_NONCE_BYTES} bytes, recebeu ${nonce.length}`,
    );
  }
}
