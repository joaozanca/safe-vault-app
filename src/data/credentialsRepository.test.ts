import type { DB } from '@op-engineering/op-sqlite';

import {
  atualizarCredencial,
  buscarCredencialPorId,
  excluirCredencial,
  inserirCredencial,
  listarCredenciais,
  type CredentialRow,
} from './credentialsRepository';

function criarDbFalso(): { db: DB; execute: jest.Mock } {
  const execute = jest.fn().mockResolvedValue({ rows: [], rowsAffected: 0 });
  return { db: { execute } as unknown as DB, execute };
}

const linhaExemplo: CredentialRow = {
  id: 'id-1',
  titulo: 'E-mail pessoal',
  usuario: 'joao@example.com',
  senha: 'segredo123',
  url: 'https://mail.example.com',
  notas: null,
  categoria: 'e-mail',
  criadoEm: 1000,
  atualizadoEm: 1000,
};

describe('inserirCredencial', () => {
  it('garante a tabela antes de inserir e grava todos os campos na ordem certa', async () => {
    const { db, execute } = criarDbFalso();

    await inserirCredencial(db, linhaExemplo);

    expect(execute).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS credenciais'));
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO credenciais'),
      [
        linhaExemplo.id,
        linhaExemplo.titulo,
        linhaExemplo.usuario,
        linhaExemplo.senha,
        linhaExemplo.url,
        linhaExemplo.notas,
        linhaExemplo.categoria,
        linhaExemplo.criadoEm,
        linhaExemplo.atualizadoEm,
      ],
    );
  });
});

describe('listarCredenciais', () => {
  it('devolve as linhas ordenadas por título, sem diferenciar caixa', async () => {
    const { db, execute } = criarDbFalso();
    execute.mockResolvedValue({ rows: [linhaExemplo], rowsAffected: 0 });

    const resultado = await listarCredenciais(db);

    expect(execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY titulo COLLATE NOCASE'));
    expect(resultado).toEqual([linhaExemplo]);
  });

  it('devolve lista vazia quando não há nenhuma credencial', async () => {
    const { db } = criarDbFalso();

    const resultado = await listarCredenciais(db);

    expect(resultado).toEqual([]);
  });
});

describe('buscarCredencialPorId', () => {
  it('devolve a linha quando o id existe', async () => {
    const { db, execute } = criarDbFalso();
    execute.mockResolvedValue({ rows: [linhaExemplo], rowsAffected: 0 });

    const resultado = await buscarCredencialPorId(db, 'id-1');

    expect(execute).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'), ['id-1']);
    expect(resultado).toEqual(linhaExemplo);
  });

  it('devolve null quando o id não existe', async () => {
    const { db } = criarDbFalso();

    const resultado = await buscarCredencialPorId(db, 'inexistente');

    expect(resultado).toBeNull();
  });
});

describe('atualizarCredencial', () => {
  it('atualiza todos os campos editáveis e devolve true quando o id existia', async () => {
    const { db, execute } = criarDbFalso();
    execute.mockResolvedValue({ rows: [], rowsAffected: 1 });
    const linhaEditada = { ...linhaExemplo, titulo: 'Novo título', atualizadoEm: 2000 };

    const resultado = await atualizarCredencial(db, linhaEditada);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE credenciais'),
      [
        linhaEditada.titulo,
        linhaEditada.usuario,
        linhaEditada.senha,
        linhaEditada.url,
        linhaEditada.notas,
        linhaEditada.categoria,
        linhaEditada.atualizadoEm,
        linhaEditada.id,
      ],
    );
    expect(resultado).toBe(true);
  });

  it('devolve false quando nenhuma linha foi afetada (id não existia)', async () => {
    const { db } = criarDbFalso();

    const resultado = await atualizarCredencial(db, linhaExemplo);

    expect(resultado).toBe(false);
  });
});

describe('excluirCredencial', () => {
  it('devolve true quando a credencial existia e foi excluída', async () => {
    const { db, execute } = criarDbFalso();
    execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const resultado = await excluirCredencial(db, 'id-1');

    expect(execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM credenciais'), ['id-1']);
    expect(resultado).toBe(true);
  });

  it('devolve false quando não existia nenhuma credencial com esse id', async () => {
    const { db } = criarDbFalso();

    const resultado = await excluirCredencial(db, 'inexistente');

    expect(resultado).toBe(false);
  });
});
