# Notas de release — Sprint 4

**Data de encerramento:** 2026-10-02
**Tag:** `sprint-4`

## Objetivo da sprint

Ferramentas de senha e organização — qualidade de vida. Risco menor que as sprints
anteriores: nada aqui perde ou vaza o cofre inteiro.

## Entregue

- **H4.1 — Gerador de senhas configurável**: `randomInt` novo em `csprng.ts`
  (inteiro uniforme via rejection sampling — `byte % N` sozinho enviesaria qual
  caractere sai mais). `PasswordGenerator.ts` garante 1 caractere de cada classe
  marcada *explicitamente* (sorteia 1 de cada antes de completar o resto e embaralhar
  com Fisher-Yates), não só estatisticamente. Faixa de tamanho 8-64, padrão 16.
  `GeneratorScreen.tsx` é uma sobreposição dentro do `CredentialFormScreen`, não uma
  tela de `App.tsx` — "usar esta senha" só devolve um valor pro campo já aberto.
- **H4.2 — Indicador de força da senha**: reaproveita a heurística simples que já
  existia desde o H2.3 (`calcularForcaSenha`, agora em `PasswordStrength.ts`,
  extraída de `BackupService.ts` pra virar módulo compartilhado) em vez de adicionar
  zxcvbn — zero dependência nova. Aparece tanto no gerador quanto no formulário de
  credencial.
- **H4.3 — Alerta de senha repetida**: `PasswordReuseDetector.ts`, função pura sobre
  a lista já decifrada em memória (nunca um índice em disco). Mostra título e
  quantidade por grupo repetido, nunca a senha em si.
- **H4.4 — Busca e filtro por categoria**: busca por título/usuário/URL e chips de
  categoria (calculados dinamicamente das próprias credenciais, sem lib de picker),
  tudo em memória sobre dados já decifrados, nada persistido.
- **193 testes automatizados** (Jest) — 23 novos desde a Sprint 3.

## Teste exploratório e verificação manual

Toda história verificada rodando de verdade no emulador — detalhe completo em
[backlog-5-sprints.md](../sprint-0/backlog-5-sprints.md). Destaques:

| Teste | Resultado |
|---|---|
| H4.1: stepper de tamanho regenerando a senha a cada toque; geração garantindo as 4 classes em várias rodadas; desligar todas as classes mostra erro e desabilita "Usar esta senha" sem travar; religar uma classe recupera | Aprovado |
| H4.2: indicador de força correto no gerador e no formulário de credencial (ex.: senha só minúsculas → "Fraca") | Aprovado |
| H4.3: duas credenciais com a mesma senha disparam o aviso com título e quantidade, nunca a senha | Aprovado |
| H4.4: busca por usuário filtra corretamente; filtro por categoria filtra corretamente (depois do fix de layout abaixo) | Aprovado |

**Achado real pelo caminho, corrigido:** os chips de categoria (H4.4) tinham a área de
toque esticada verticalmente até sobrepor a lista de credenciais abaixo deles —
`contentContainerStyle` de uma `ScrollView` horizontal sem `alignItems` explícito
("stretch" é o padrão, estica os filhos no eixo cruzado). Na prática, tocar num chip
não filtrava nada. Corrigido com `alignItems: 'center'`, testado de novo depois do fix.

## Decisões de refinamento tomadas nesta sprint

| Item | Decisão |
|---|---|
| Tamanho do gerador (H4.1) | 8 a 64 caracteres, padrão 16 |
| Biblioteca de força de senha (H4.2) | Reusar a heurística simples que já existia (H2.3) em vez de zxcvbn — zero dependência nova |

## Issue conhecida, ainda aberta

[Issue #1](https://github.com/joaozanca/safe-vault-app/issues/1) — composição de
acento por tecla morta quebrada nos campos de senha, herdada da Sprint 1. Sem mudança
nesta sprint.

## O que fica para a Sprint 5 (não bloqueia)

Sprint 5 — endurecimento, regressão e decisão de release. Ver
[backlog-5-sprints.md](../sprint-0/backlog-5-sprints.md).

## Próximo passo

Abrir o refinamento da Sprint 5 (endurecimento, regressão e decisão de release).
