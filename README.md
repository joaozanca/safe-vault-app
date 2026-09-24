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

**Sprint 0 concluída em 2026-09-24 (tag `sprint-0`). Sprint 1 liberada.** Nenhum código
de app foi escrito ainda — a Sprint 1 começa no próximo refinamento.
