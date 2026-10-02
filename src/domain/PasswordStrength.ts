/**
 * Indicador de força de senha — heurística local simples (comprimento +
 * quantas classes de caractere aparecem), sem biblioteca externa. Usado em
 * dois lugares com propósitos diferentes: a senha de exportação (H2.3,
 * `BackupService.ts`/`ExportScreen.tsx` — sinal pra informar a escolha do
 * usuário, não um portão, já que ali não existe regra mínima obrigatória) e
 * a senha de credenciais (H4.2) — nos dois casos é só referência visual,
 * nunca bloqueia nada.
 *
 * Decisão do refinamento, 2026-10-02: ficou essa heurística simples em vez
 * de uma biblioteca consagrada tipo zxcvbn (sugestão original do H4.2) —
 * zero dependência nova, código já testado em produção no app desde o H2.3.
 * Menos preciso (não detecta padrão de teclado tipo "qwerty123" nem palavra
 * de dicionário), mas suficiente pra um indicador visual de referência.
 */

export type ForcaSenha = 'fraca' | 'media' | 'forte';

export function calcularForcaSenha(password: string): ForcaSenha {
  if (password.length < 8) return 'fraca';
  const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((c) => c.test(password)).length;
  if (password.length >= 16 && classes >= 3) return 'forte';
  if (classes >= 2) return 'media';
  return 'fraca';
}
