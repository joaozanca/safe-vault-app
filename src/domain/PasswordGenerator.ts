import { randomInt } from '../crypto/csprng';

/** H4.1 — decisão do refinamento, 2026-10-02: 8 a 64, padrão 16. */
export const GENERATOR_MIN_LENGTH = 8;
export const GENERATOR_MAX_LENGTH = 64;
export const GENERATOR_DEFAULT_LENGTH = 16;

const MAIUSCULAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijklmnopqrstuvwxyz';
const NUMEROS = '0123456789';
const SIMBOLOS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/** Caracteres fáceis de confundir visualmente (critério "excluir ambíguos"). */
const AMBIGUOS = new Set(['0', 'O', '1', 'l', 'I']);

export interface OpcoesGerador {
  tamanho: number;
  maiusculas: boolean;
  minusculas: boolean;
  numeros: boolean;
  simbolos: boolean;
  excluirAmbiguos: boolean;
}

export const OPCOES_PADRAO: OpcoesGerador = {
  tamanho: GENERATOR_DEFAULT_LENGTH,
  maiusculas: true,
  minusculas: true,
  numeros: true,
  simbolos: true,
  excluirAmbiguos: false,
};

export class OpcoesGeradorInvalidasError extends Error {}

/**
 * H4.1 — gera senha com o CSPRNG (nunca `Math.random`, regra de lint em
 * `src/`). "Garante ao menos 1 de cada classe marcada" é um critério de
 * aceite, não só uma expectativa estatística: sorteia explicitamente 1
 * caractere de cada classe selecionada primeiro, completa o resto do
 * tamanho sorteando do conjunto de todas as classes juntas, e só então
 * embaralha tudo (senão os primeiros caracteres sempre sairiam na mesma
 * ordem de classe, um padrão previsível que não devia existir numa senha).
 *
 * @throws {OpcoesGeradorInvalidasError} se o tamanho estiver fora de
 * `[GENERATOR_MIN_LENGTH, GENERATOR_MAX_LENGTH]`, nenhuma classe estiver
 * marcada, ou o tamanho for menor que o número de classes marcadas (não dá
 * pra caber 1 de cada).
 */
export function gerarSenha(opcoes: OpcoesGerador): string {
  const problemas: string[] = [];
  if (opcoes.tamanho < GENERATOR_MIN_LENGTH || opcoes.tamanho > GENERATOR_MAX_LENGTH) {
    problemas.push(`tamanho precisa estar entre ${GENERATOR_MIN_LENGTH} e ${GENERATOR_MAX_LENGTH}`);
  }

  const classesSelecionadas = montarClasses(opcoes);
  if (classesSelecionadas.length === 0) {
    problemas.push('selecione ao menos uma classe de caractere');
  } else if (opcoes.tamanho < classesSelecionadas.length) {
    problemas.push('tamanho menor que o número de classes marcadas — não cabe 1 de cada');
  }

  if (problemas.length > 0) {
    throw new OpcoesGeradorInvalidasError(`Opções inválidas: ${problemas.join('; ')}.`);
  }

  const poolCompleto = classesSelecionadas.join('');
  const caracteres: string[] = classesSelecionadas.map((classe) => classe[randomInt(classe.length)]);
  while (caracteres.length < opcoes.tamanho) {
    caracteres.push(poolCompleto[randomInt(poolCompleto.length)]);
  }

  embaralhar(caracteres);
  return caracteres.join('');
}

function montarClasses(opcoes: OpcoesGerador): string[] {
  const brutas = [
    opcoes.maiusculas && MAIUSCULAS,
    opcoes.minusculas && MINUSCULAS,
    opcoes.numeros && NUMEROS,
    opcoes.simbolos && SIMBOLOS,
  ].filter((classe): classe is string => classe !== false);

  if (!opcoes.excluirAmbiguos) return brutas;
  return brutas.map((classe) => [...classe].filter((c) => !AMBIGUOS.has(c)).join(''));
}

/** Fisher-Yates com o CSPRNG — embaralhamento uniforme, não só "difícil de adivinhar". */
function embaralhar(itens: string[]): void {
  for (let i = itens.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [itens[i], itens[j]] = [itens[j], itens[i]];
  }
}
