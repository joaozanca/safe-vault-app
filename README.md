# SafeVault

Gerenciador de senhas mobile, **offline-first**, para uso real. Projeto de portfólio de QA
com foco em mobile: passa por todas as etapas do dia a dia de qualidade dentro de uma
empresa — refinamento, estratégia, casos de teste, execução manual e exploratória,
automação, defeito, regressão, pipeline e decisão de release.

## Papéis

| Papel | Quem | Responsabilidade |
|---|---|---|
| Tech Lead / Time de Desenvolvimento / Mentor | Claude — QA especialista com 10 anos de experiência | Arquitetura, código do app, código-base de teste de exemplo, ensino |
| Analista de QA Júnior | João Vitor | Refinamento, estratégia, casos de teste, execução manual e **exploratória**, automação da suíte, defeitos, decisão de release |

Claude tem liberdade para fazer tudo neste projeto — incluindo explorar o app e caçar
bugs — mas a explicação de cada decisão e passo é obrigatória, sem exceção: o objetivo é
o QA aprender fazendo, até conseguir executar essas etapas sozinho.

## Stack

**Produto:** React Native + Expo (dev client / prebuild), TypeScript, SQLite cifrado
(SQLCipher), `expo-secure-store` para chaves, criptografia com bibliotecas consagradas
(ver [docs/sprint-0/arquitetura.md](docs/sprint-0/arquitetura.md)).

**Qualidade:** Appium + Python + pytest (suíte principal, Android) · Detox + TypeScript
(fluxos críticos) · Allure (relatórios) · GitHub Actions (pipeline com emulador) ·
Azure DevOps Test Plans (casos, execuções, defeitos).

## Como trabalhamos

Sprints de 1 semana: **Refinamento → Desenvolvimento → Teste → Correção → Release**.
Versionamento obrigatório em Conventional Commits, commit por etapa, tag `sprint-N` ao
fim de cada sprint.

## Documentação da Sprint 0

- [arquitetura.md](docs/sprint-0/arquitetura.md) — arquitetura e escolhas de criptografia explicadas
- [padrao-testid.md](docs/sprint-0/padrao-testid.md) — convenção de `testID`
- [setup-ambiente-windows.md](docs/sprint-0/setup-ambiente-windows.md) — preparação do ambiente no Windows 11, comando por comando
- [backlog-5-sprints.md](docs/sprint-0/backlog-5-sprints.md) — backlog do produto ordenado por risco, com histórico de refinamento
- [definition-of-done.md](docs/sprint-0/definition-of-done.md) — checklist de "pronto" válido para toda história de toda sprint
- [analise-de-risco.md](docs/sprint-0/analise-de-risco.md) — áreas mais arriscadas do sistema
- [appium-em-10-linhas.md](docs/sprint-0/appium-em-10-linhas.md) — o que é Appium e como difere de Cypress/Playwright

## Estado atual

**Sprint 0 concluída em 2026-09-24 (tag `sprint-0`).** **Sprint 1 concluída em
2026-09-30 (tag `sprint-1`)** — núcleo criptográfico e cofre (H1.1 a H1.4), mais uma
primeira rodada de teste exploratório completa (corrida, duplo-toque, bloqueio
resistente a `kill`, autofill, senha longa), uma correção real aplicada (normalização
Unicode antes de derivar a chave) e um defeito mitigado (Issue #1 — composição de
tecla morta quebrada no `TextInput`, limitação de upstream do React Native/Fabric,
ainda aberta). Detalhes em [`docs/releases/sprint-1.md`](docs/releases/sprint-1.md).

**Sprint 2 concluída em 2026-10-01 (tag `sprint-2`)** — recuperação e portabilidade,
H2.1 a H2.6: chave de recuperação com rotação automática, exportar/importar o cofre
num arquivo `.safevault` autocontido, backup manual de um toque, e backup automático
do Android desativado (verificado de verdade via `bmgr`/`dumpsys backup`). Detalhes em
[`docs/releases/sprint-2.md`](docs/releases/sprint-2.md).

**Sprint 3 concluída em 2026-10-01** — uso diário seguro, **H3.1 a H3.5, todas as
histórias da sprint**: CRUD de credenciais (com `PRAGMA secure_delete` pra não sobrar
segredo editado/excluído em disco), copiar senha com limpeza automática do clipboard
em 30s, bloqueio automático por inatividade (timer único, cobrindo tanto ficar parado
no app quanto ir para segundo plano), bloqueio de screenshot e app switcher
(`FLAG_SECURE` ligado pro app inteiro), e desbloqueio por biometria (chave no Android
Keystore via `expo-secure-store`, zero biblioteca nativa nova) — este último testado
de ponta a ponta no emulador com uma digital virtual real, não só teste unitário.
170 testes automatizados. Detalhes de cada verificação manual em
`docs/sprint-0/backlog-5-sprints.md`.

Falta a tag `sprint-3` (release em preparo) e a etapa de **Correção**/revisão final
antes de abrir a Sprint 4.
