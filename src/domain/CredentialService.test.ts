jest.mock('../data/credentialsRepository', () => ({
  inserirCredencial: jest.fn(),
  listarCredenciais: jest.fn(),
  buscarCredencialPorId: jest.fn(),
  atualizarCredencial: jest.fn(),
  excluirCredencial: jest.fn(),
}));

import type { DB } from '@op-engineering/op-sqlite';

import {
  atualizarCredencial,
  excluirCredencial,
  listarCredenciais,
  obterCredencial,
  criarCredencial,
  CredencialInvalidaError,
  CredencialNaoEncontradaError,
  type DadosCredencial,
} from './CredentialService';
import * as repositorio from '../data/credentialsRepository';

const mockedInserir = repositorio.inserirCredencial as jest.Mock;
const mockedListar = repositorio.listarCredenciais as jest.Mock;
const mockedBuscarPorId = repositorio.buscarCredencialPorId as jest.Mock;
const mockedAtualizar = repositorio.atualizarCredencial as jest.Mock;
const mockedExcluir = repositorio.excluirCredencial as jest.Mock;

const dbFalso = {} as DB;

const dadosValidos: DadosCredencial = {
  titulo: 'E-mail pessoal',
  usuario: 'joao@example.com',
  senha: 'segredo123',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('criarCredencial', () => {
  it('gera um id de 32 caracteres hex (16 bytes) e grava com criadoEm === atualizadoEm', async () => {
    const credencial = await criarCredencial(dbFalso, dadosValidos);

    expect(credencial.id).toMatch(/^[0-9a-f]{32}$/);
    expect(credencial.criadoEm).toBe(credencial.atualizadoEm);
    expect(mockedInserir).toHaveBeenCalledWith(dbFalso, credencial);
  });

  it('usuário, senha e título obrigatórios: vazios são rejeitados', async () => {
    await expect(criarCredencial(dbFalso, { ...dadosValidos, titulo: '' })).rejects.toThrow(
      CredencialInvalidaError,
    );
    await expect(criarCredencial(dbFalso, { ...dadosValidos, usuario: '  ' })).rejects.toThrow(
      CredencialInvalidaError,
    );
    await expect(criarCredencial(dbFalso, { ...dadosValidos, senha: '' })).rejects.toThrow(
      CredencialInvalidaError,
    );
    expect(mockedInserir).not.toHaveBeenCalled();
  });

  it('URL, notas e categoria são opcionais — ausentes viram null, não erro', async () => {
    const credencial = await criarCredencial(dbFalso, dadosValidos);

    expect(credencial.url).toBeNull();
    expect(credencial.notas).toBeNull();
    expect(credencial.categoria).toBeNull();
  });

  it.each([
    ['titulo', 101],
    ['usuario', 255],
    ['senha', 257],
    ['url', 2049],
    ['notas', 2001],
    ['categoria', 51],
  ])('rejeita %s acima do limite decidido no refinamento (%i caracteres)', async (campo, tamanho) => {
    const dados: DadosCredencial = { ...dadosValidos, [campo]: 'a'.repeat(tamanho) };

    await expect(criarCredencial(dbFalso, dados)).rejects.toThrow(CredencialInvalidaError);
  });
});

describe('listarCredenciais', () => {
  it('delega direto pro repositório', async () => {
    mockedListar.mockResolvedValue([]);

    const resultado = await listarCredenciais(dbFalso);

    expect(mockedListar).toHaveBeenCalledWith(dbFalso);
    expect(resultado).toEqual([]);
  });
});

describe('obterCredencial', () => {
  it('devolve a credencial quando existe', async () => {
    const linha = { ...dadosValidos, id: 'id-1', url: null, notas: null, categoria: null, criadoEm: 1, atualizadoEm: 1 };
    mockedBuscarPorId.mockResolvedValue(linha);

    const resultado = await obterCredencial(dbFalso, 'id-1');

    expect(resultado).toEqual(linha);
  });

  it('lança CredencialNaoEncontradaError quando não existe', async () => {
    mockedBuscarPorId.mockResolvedValue(null);

    await expect(obterCredencial(dbFalso, 'inexistente')).rejects.toThrow(CredencialNaoEncontradaError);
  });
});

describe('atualizarCredencial', () => {
  const linhaExistente = {
    id: 'id-1',
    titulo: 'Antigo',
    usuario: 'antigo@example.com',
    senha: 'antiga',
    url: null,
    notas: null,
    categoria: null,
    criadoEm: 1000,
    atualizadoEm: 1000,
  };

  it('preserva id e criadoEm, atualiza o resto e avança atualizadoEm', async () => {
    mockedBuscarPorId.mockResolvedValue(linhaExistente);

    const resultado = await atualizarCredencial(dbFalso, 'id-1', dadosValidos);

    expect(resultado.id).toBe('id-1');
    expect(resultado.criadoEm).toBe(1000);
    expect(resultado.titulo).toBe(dadosValidos.titulo);
    expect(resultado.atualizadoEm).toBeGreaterThanOrEqual(1000);
    expect(mockedAtualizar).toHaveBeenCalledWith(dbFalso, resultado);
  });

  it('lança CredencialNaoEncontradaError quando o id não existe, sem chamar o repositório de update', async () => {
    mockedBuscarPorId.mockResolvedValue(null);

    await expect(atualizarCredencial(dbFalso, 'inexistente', dadosValidos)).rejects.toThrow(
      CredencialNaoEncontradaError,
    );
    expect(mockedAtualizar).not.toHaveBeenCalled();
  });

  it('valida os dados novos antes de tocar no repositório', async () => {
    await expect(atualizarCredencial(dbFalso, 'id-1', { ...dadosValidos, titulo: '' })).rejects.toThrow(
      CredencialInvalidaError,
    );
    expect(mockedBuscarPorId).not.toHaveBeenCalled();
    expect(mockedAtualizar).not.toHaveBeenCalled();
  });
});

describe('excluirCredencial', () => {
  it('resolve sem erro quando o repositório confirma a exclusão', async () => {
    mockedExcluir.mockResolvedValue(true);

    await expect(excluirCredencial(dbFalso, 'id-1')).resolves.toBeUndefined();
  });

  it('lança CredencialNaoEncontradaError quando o id não existia', async () => {
    mockedExcluir.mockResolvedValue(false);

    await expect(excluirCredencial(dbFalso, 'inexistente')).rejects.toThrow(CredencialNaoEncontradaError);
  });
});
