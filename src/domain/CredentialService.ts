import type { DB } from '@op-engineering/op-sqlite';

import { randomBytes } from '../crypto/csprng';
import { bytesToHex } from '../crypto/encoding';
import {
  atualizarCredencial as atualizarLinha,
  buscarCredencialPorId,
  excluirCredencial as excluirLinha,
  inserirCredencial,
  listarCredenciais as listarLinhas,
  type CredentialRow,
} from '../data/credentialsRepository';

/** H3.1 — id de 128 bits via CSPRNG (não é segredo, só precisa ser único — mesma
 * fonte aleatória do resto do app, nunca Math.random, por regra de lint em src/). */
const CREDENTIAL_ID_BYTES = 16;

/** Limites de tamanho por campo (decisão de Tech Lead, refinamento da Sprint 3,
 * 2026-10-01 — delegado pelo QA, mesmo padrão do teto de bloqueio do H1.2). */
const LIMITES = {
  titulo: 100,
  usuario: 254,
  senha: 256,
  url: 2048,
  notas: 2000,
  categoria: 50,
} as const;

export interface Credencial {
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
 * O que a UI manda pra criar/editar — título, usuário e senha obrigatórios
 * (decisão do refinamento, 2026-10-01); URL, notas e categoria opcionais.
 */
export interface DadosCredencial {
  titulo: string;
  usuario: string;
  senha: string;
  url?: string;
  notas?: string;
  categoria?: string;
}

export class CredencialInvalidaError extends Error {}

export class CredencialNaoEncontradaError extends Error {
  constructor() {
    super('Credencial não encontrada.');
  }
}

/**
 * Cria uma credencial nova.
 *
 * @throws {CredencialInvalidaError} se título, usuário ou senha estiverem
 * vazios, ou se algum campo passar do limite de tamanho decidido no
 * refinamento da Sprint 3.
 */
export async function criarCredencial(db: DB, dados: DadosCredencial): Promise<Credencial> {
  assertCredencialValida(dados);

  const agora = Date.now();
  const linha: CredentialRow = {
    id: gerarId(),
    titulo: dados.titulo,
    usuario: dados.usuario,
    senha: dados.senha,
    url: dados.url ?? null,
    notas: dados.notas ?? null,
    categoria: dados.categoria ?? null,
    criadoEm: agora,
    atualizadoEm: agora,
  };

  await inserirCredencial(db, linha);
  return linha;
}

/** Lista todas as credenciais do cofre, ordenadas por título. */
export async function listarCredenciais(db: DB): Promise<Credencial[]> {
  return listarLinhas(db);
}

/** @throws {CredencialNaoEncontradaError} se não existir credencial com esse `id`. */
export async function obterCredencial(db: DB, id: string): Promise<Credencial> {
  const linha = await buscarCredencialPorId(db, id);
  if (!linha) throw new CredencialNaoEncontradaError();
  return linha;
}

/**
 * Edita uma credencial existente — `dados` substitui título, usuário, senha,
 * URL, notas e categoria por inteiro (não há edição parcial de campo único).
 *
 * "Sem lixo de update" (critério do H3.1): a versão antiga não sobra legível
 * no arquivo porque a conexão já abre com `PRAGMA secure_delete = ON` (ver
 * `database.ts`) — o `UPDATE` sobrescreve o espaço antigo com zeros, não só
 * marca como livre.
 *
 * @throws {CredencialInvalidaError} mesmas regras de `criarCredencial`.
 * @throws {CredencialNaoEncontradaError} se não existir credencial com esse `id`.
 */
export async function atualizarCredencial(
  db: DB,
  id: string,
  dados: DadosCredencial,
): Promise<Credencial> {
  assertCredencialValida(dados);

  const existente = await buscarCredencialPorId(db, id);
  if (!existente) throw new CredencialNaoEncontradaError();

  const linha: CredentialRow = {
    ...existente,
    titulo: dados.titulo,
    usuario: dados.usuario,
    senha: dados.senha,
    url: dados.url ?? null,
    notas: dados.notas ?? null,
    categoria: dados.categoria ?? null,
    atualizadoEm: Date.now(),
  };

  await atualizarLinha(db, linha);
  return linha;
}

/**
 * Exclui uma credencial — pede confirmação antes é responsabilidade da UI
 * (critério do H3.1), esta função já executa a exclusão.
 *
 * @throws {CredencialNaoEncontradaError} se não existir credencial com esse `id`.
 */
export async function excluirCredencial(db: DB, id: string): Promise<void> {
  const excluiu = await excluirLinha(db, id);
  if (!excluiu) throw new CredencialNaoEncontradaError();
}

function gerarId(): string {
  return bytesToHex(randomBytes(CREDENTIAL_ID_BYTES));
}

function assertCredencialValida(dados: DadosCredencial): void {
  const problemas: string[] = [];

  if (dados.titulo.trim().length === 0) problemas.push('título é obrigatório');
  if (dados.usuario.trim().length === 0) problemas.push('usuário é obrigatório');
  if (dados.senha.length === 0) problemas.push('senha é obrigatória');

  if (dados.titulo.length > LIMITES.titulo) {
    problemas.push(`título não pode passar de ${LIMITES.titulo} caracteres`);
  }
  if (dados.usuario.length > LIMITES.usuario) {
    problemas.push(`usuário não pode passar de ${LIMITES.usuario} caracteres`);
  }
  if (dados.senha.length > LIMITES.senha) {
    problemas.push(`senha não pode passar de ${LIMITES.senha} caracteres`);
  }
  if ((dados.url?.length ?? 0) > LIMITES.url) {
    problemas.push(`URL não pode passar de ${LIMITES.url} caracteres`);
  }
  if ((dados.notas?.length ?? 0) > LIMITES.notas) {
    problemas.push(`notas não podem passar de ${LIMITES.notas} caracteres`);
  }
  if ((dados.categoria?.length ?? 0) > LIMITES.categoria) {
    problemas.push(`categoria não pode passar de ${LIMITES.categoria} caracteres`);
  }

  if (problemas.length > 0) {
    throw new CredencialInvalidaError(`Credencial inválida: ${problemas.join('; ')}.`);
  }
}
