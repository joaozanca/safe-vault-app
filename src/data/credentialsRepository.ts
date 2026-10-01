import type { DB } from '@op-engineering/op-sqlite';

/**
 * H3.1 — uma linha da tabela `credenciais`, exatamente como ela existe no
 * banco (sem nenhuma regra de negócio em cima). A camada de domínio
 * (`CredentialService.ts`) é quem decide o que é um dado válido; aqui só
 * persistimos o que ela já validou.
 *
 * Nenhum campo é cifrado individualmente — o arquivo `vault.db` inteiro já
 * é cifrado pelo SQLCipher (ver `database.ts`), então cifrar de novo campo a
 * campo seria redundante, igual cifrar uma coluna que já está dentro de um
 * volume criptografado.
 */
export interface CredentialRow {
  id: string;
  titulo: string;
  usuario: string;
  senha: string;
  url: string | null;
  notas: string | null;
  categoria: string | null;
  criadoEm: number;
  atualizadoEm: number;
}

/**
 * `CREATE TABLE IF NOT EXISTS` — idempotente, por isso chamamos antes de
 * toda operação em vez de só na abertura do cofre: não existe nenhum
 * sistema de migração neste projeto (uma tabela só, sem versões anteriores
 * pra migrar), então "garantir que existe antes de usar" já cobre tanto o
 * primeiro uso (tabela ainda não existe) quanto todos os seguintes (já
 * existe, o `IF NOT EXISTS` não faz nada) sem precisar de nenhum outro lugar
 * lembrando de chamar isso antes.
 */
async function garantirTabela(db: DB): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS credenciais (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      usuario TEXT NOT NULL,
      senha TEXT NOT NULL,
      url TEXT,
      notas TEXT,
      categoria TEXT,
      criadoEm INTEGER NOT NULL,
      atualizadoEm INTEGER NOT NULL
    );
  `);
}

export async function inserirCredencial(db: DB, linha: CredentialRow): Promise<void> {
  await garantirTabela(db);
  await db.execute(
    `INSERT INTO credenciais (id, titulo, usuario, senha, url, notas, categoria, criadoEm, atualizadoEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      linha.id,
      linha.titulo,
      linha.usuario,
      linha.senha,
      linha.url,
      linha.notas,
      linha.categoria,
      linha.criadoEm,
      linha.atualizadoEm,
    ],
  );
}

/** Ordenado por título (sem diferenciar maiúscula/minúscula) — ordem previsível pra UI. */
export async function listarCredenciais(db: DB): Promise<CredentialRow[]> {
  await garantirTabela(db);
  const resultado = await db.execute('SELECT * FROM credenciais ORDER BY titulo COLLATE NOCASE ASC;');
  return resultado.rows as unknown as CredentialRow[];
}

export async function buscarCredencialPorId(db: DB, id: string): Promise<CredentialRow | null> {
  await garantirTabela(db);
  const resultado = await db.execute('SELECT * FROM credenciais WHERE id = ?;', [id]);
  return (resultado.rows[0] as unknown as CredentialRow) ?? null;
}

/** @returns `false` se não existia nenhuma credencial com esse `id`. */
export async function atualizarCredencial(db: DB, linha: CredentialRow): Promise<boolean> {
  await garantirTabela(db);
  const resultado = await db.execute(
    `UPDATE credenciais
     SET titulo = ?, usuario = ?, senha = ?, url = ?, notas = ?, categoria = ?, atualizadoEm = ?
     WHERE id = ?;`,
    [
      linha.titulo,
      linha.usuario,
      linha.senha,
      linha.url,
      linha.notas,
      linha.categoria,
      linha.atualizadoEm,
      linha.id,
    ],
  );
  return resultado.rowsAffected > 0;
}

/** @returns `false` se não existia nenhuma credencial com esse `id`. */
export async function excluirCredencial(db: DB, id: string): Promise<boolean> {
  await garantirTabela(db);
  const resultado = await db.execute('DELETE FROM credenciais WHERE id = ?;', [id]);
  return resultado.rowsAffected > 0;
}
