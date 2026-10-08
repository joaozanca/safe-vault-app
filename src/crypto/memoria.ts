/**
 * Higiene de memória (H3.3 / risco R7): sobrescreve com zeros as cópias de
 * material de chave mantidas em JavaScript assim que deixam de ser usadas.
 *
 * Limite assumido: só vale para `Uint8Array`. Strings em JS são imutáveis e
 * não podem ser zeradas — a senha mestra digitada e a chave já formatada em
 * texto para o SQLCipher ficam no heap até o coletor de lixo liberar. O
 * SQLCipher guarda a própria cópia da chave em código nativo e a apaga ao
 * fechar o banco.
 */
export function zerar(...buffers: (Uint8Array | undefined)[]): void {
  for (const buffer of buffers) {
    buffer?.fill(0);
  }
}
