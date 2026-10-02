import type { Credencial } from './CredentialService';

/**
 * H4.3 — "comparação feita com o cofre destravado, em memória": função pura
 * sobre a lista já decifrada (`listarCredenciais`), nunca um índice
 * separado em disco. Não devolve nem recebe a senha em si pra quem chama
 * além do agrupamento — só título e contagem, exatamente o critério de
 * aceite ("mostra quantas e quais entradas compartilham, sem exibir a
 * senha").
 */
export interface GrupoSenhaRepetida {
  quantidade: number;
  titulos: string[];
}

export function encontrarSenhasRepetidas(credenciais: Credencial[]): GrupoSenhaRepetida[] {
  const porSenha = new Map<string, string[]>();
  for (const credencial of credenciais) {
    const titulos = porSenha.get(credencial.senha) ?? [];
    titulos.push(credencial.titulo);
    porSenha.set(credencial.senha, titulos);
  }

  return [...porSenha.values()]
    .filter((titulos) => titulos.length >= 2)
    .map((titulos) => ({ quantidade: titulos.length, titulos }));
}
