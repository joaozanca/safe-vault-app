import { open, type DB } from '@op-engineering/op-sqlite';

import { bytesToHex } from '../crypto/encoding';
import { DEK_BYTES } from '../crypto/keyHierarchy';

/** Nome do arquivo do banco. Fica no diretório privado do app por padrão
 * (não passamos `location`) — mesma pasta que nenhum outro app consegue ler
 * sem root, e que fica de fora do backup automático do sistema (H2.6). */
export const DB_NAME = 'vault.db';

/**
 * Formata a DEK no formato de "chave bruta" que o SQLCipher exige pra pular
 * o PBKDF2 interno dele e usar nossos bytes de verdade, sem reprocessar.
 *
 * Isto importa mais do que parece: o SQLCipher aceita a chave como *senha*
 * (deriva outra chave por cima, com PBKDF2 e outro salt) ou como *chave
 * bruta* (usa os bytes tal como estão) — e a diferença entre as duas é só o
 * formato exato da string. Só quando ela é literalmente `x'` + 64
 * caracteres hex + `'` é que ele usa como chave bruta; qualquer outro
 * formato (inclusive um hex "pelado") vira senha, silenciosamente, sem
 * erro. Perder isso jogaria fora todo o trabalho do Argon2id.
 *
 * @throws {RangeError} se `dek` não tiver exatamente 32 bytes.
 */
export function formatRawKey(dek: Uint8Array): string {
  if (dek.length !== DEK_BYTES) {
    throw new RangeError(`formatRawKey: DEK precisa ter ${DEK_BYTES} bytes, recebeu ${dek.length}`);
  }
  return `x'${bytesToHex(dek)}'`;
}

/**
 * Abre (ou cria, se não existir) o banco cifrado do cofre com a DEK dada.
 * Não confirma que a chave está certa — ver `assertDatabaseUnlocked`.
 *
 * Liga `PRAGMA secure_delete = ON` antes de devolver a conexão (H3.1): por
 * padrão, um `UPDATE`/`DELETE` no SQLite só marca o espaço antigo como livre
 * para reuso, sem zerar o conteúdo — os bytes de uma senha editada ou
 * excluída continuam no arquivo até alguma escrita futura reaproveitar
 * aquela página, o que pode nunca acontecer. Com a pragma ligada, o SQLite
 * sobrescreve com zeros na hora. Isso é um ajuste de **conexão**, não de
 * esquema (não é uma tabela, não precisa de migração) — por isso liga aqui,
 * um único lugar, toda vez que o banco é aberto, em vez de espalhar por cada
 * função que escreve.
 *
 * Não precisa da chave estar certa para funcionar: é uma configuração da
 * conexão em memória, não uma operação que lê/decifra uma página do banco —
 * por isso é seguro chamar antes de `assertDatabaseUnlocked`.
 */
export async function openVaultDatabase(dek: Uint8Array): Promise<DB> {
  const db = open({
    name: DB_NAME,
    encryptionKey: formatRawKey(dek),
  });
  await db.execute('PRAGMA secure_delete = ON;');
  return db;
}

/**
 * Confirma que a DEK realmente abre o banco. Abrir com a chave errada não
 * falha na hora — `sqlite3_key_v2` só registra a chave, o SQLCipher só
 * tenta de fato decifrar a página 1 na primeira leitura. Rodamos uma
 * consulta barata de propósito, pra falhar cedo com mensagem clara em vez
 * de deixar isso estourar em algum outro lugar do app.
 *
 * @throws {Error} se a chave estiver errada ou o banco estiver corrompido.
 */
export async function assertDatabaseUnlocked(db: DB): Promise<void> {
  try {
    await db.execute('SELECT count(*) FROM sqlite_master');
  } catch {
    throw new Error('Não foi possível abrir o cofre: chave incorreta ou banco corrompido.');
  }
}
