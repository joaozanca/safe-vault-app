# SafeVault

Gerenciador de senhas mobile, **offline-first**, para uso real. Projeto de portfólio de QA
com foco em mobile: passa por todas as etapas do dia a dia de qualidade dentro de uma
empresa — refinamento, estratégia, casos de teste, execução manual e exploratória,
automação, defeito, regressão, pipeline e decisão de release.

> **Vai usar o app e quer saber se suas senhas ficam seguras?** Leia as
> [perguntas frequentes de segurança](docs/seguranca-perguntas-frequentes.md) — sem
> termos técnicos.

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

**Qualidade:** Jest (testes unitários) · Appium + Python + pytest (suíte E2E, Page
Objects, em [`e2e/`](e2e/README.md)) · Allure (relatórios) · GitHub Actions (pipeline com
emulador e geração do APK de release). Detox e uma ferramenta de gestão de casos estavam
no plano da Sprint 0 e não foram adotados: a suíte Appium cobriu os fluxos críticos, e os
casos e defeitos ficaram no backlog e nas Issues do GitHub.

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

## Documentação da Sprint 5 (release)

- [criterios-de-saida.md](docs/sprint-5/criterios-de-saida.md) — checklist de release risco por risco e a decisão do QA
- [matriz-cobertura.md](docs/sprint-5/matriz-cobertura.md) — cada critério de aceite ligado ao teste que o verifica
- [seguranca-perguntas-frequentes.md](docs/seguranca-perguntas-frequentes.md) — segurança explicada para quem usa o app
- [e2e/README.md](e2e/README.md) e [e2e/GUIA-PASSO-A-PASSO.md](e2e/GUIA-PASSO-A-PASSO.md) — a suíte de automação e o guia para quem está começando em mobile

## Estado atual

**v1.0.0 liberada em 2026-10-14 (tag `sprint-5`)** — decisão do QA registrada nos
[critérios de saída](docs/sprint-5/criterios-de-saida.md), depois de teste em aparelho
Android físico. Todas as 5 sprints do backlog concluídas.

| Sprint | Entrega | Notas |
|---|---|---|
| 0 | Arquitetura, padrões, backlog por risco, análise de risco, Definition of Done | [sprint-0](docs/releases/sprint-0.md) |
| 1 | Núcleo criptográfico e cofre (H1.1–H1.4) | [sprint-1](docs/releases/sprint-1.md) |
| 2 | Recuperação e portabilidade (H2.1–H2.6) | [sprint-2](docs/releases/sprint-2.md) |
| 3 | Uso diário seguro (H3.1–H3.5) | [sprint-3](docs/releases/sprint-3.md) |
| 4 | Gerador, força, senha repetida, busca (H4.1–H4.4) | [sprint-4](docs/releases/sprint-4.md) |
| 5 | Endurecimento, regressão, acessibilidade e release (H5.1–H5.5) | [sprint-5](docs/releases/sprint-5.md) |

**Números da v1.0.0:** 205 testes unitários · 67 testes E2E (Appium) · pipeline com 3
jobs verde · 8 defeitos encontrados e corrigidos na Sprint 5, cada um com teste que impede
a volta.

**Destaques do trabalho de QA:** análise de cobertura cruzando critérios de aceite com o
app, que revelou requisitos aprovados e nunca entregues; teste exploratório que achou
defeitos de severidade alta que a automação não cobria (menu inalcançável com fonte grande,
telas sem rolagem, chave de recuperação trocando sem aviso), cada um transformado em teste
automatizado; teste em aparelho Android físico; e a decisão de release com base em
critérios de saída escritos risco por risco.
