# Notas de release — Sprint 0

**Data de encerramento:** 2026-09-24
**Tag:** `sprint-0`

## Objetivo da sprint

Preparar terreno antes de escrever qualquer linha de código do app: arquitetura,
convenções, ambiente e backlog. Nenhuma funcionalidade do SafeVault foi implementada
nesta sprint — por desenho.

## Entregue

- **Arquitetura e criptografia** — [docs/sprint-0/arquitetura.md](../sprint-0/arquitetura.md):
  camadas do app, hierarquia de chaves KEK/DEK, Argon2id, AES-256-GCM, SQLCipher,
  Keystore/biometria, formato de dados versionado, bibliotecas propostas.
- **Padrão de `testID`** — [docs/sprint-0/padrao-testid.md](../sprint-0/padrao-testid.md):
  convenção `dominio.tela.elemento[.qualificador]` para Appium e Detox.
- **Ambiente Windows 11** — [docs/sprint-0/setup-ambiente-windows.md](../sprint-0/setup-ambiente-windows.md):
  passo a passo comando por comando (Android Studio/SDK/emulador, Python/pytest/Appium,
  Detox, Allure), com verificação e troubleshooting por etapa.
- **Backlog em 5 sprints, ordenado por risco** — [docs/sprint-0/backlog-5-sprints.md](../sprint-0/backlog-5-sprints.md):
  histórias no formato Como/quero/para, critérios de aceite, backup e recuperação na
  Sprint 2 antes de qualquer refinamento visual.
- **Análise de risco** — [docs/sprint-0/analise-de-risco.md](../sprint-0/analise-de-risco.md):
  10 áreas mais perigosas do sistema, mapeadas por sprint que as endereça.
- **Appium explicado** — [docs/sprint-0/appium-em-10-linhas.md](../sprint-0/appium-em-10-linhas.md):
  o que é, como fala com o emulador, diferença para Cypress/Playwright.
- **Definition of Done** — [docs/sprint-0/definition-of-done.md](../sprint-0/definition-of-done.md):
  checklist único de "pronto", válido para toda história de toda sprint.

## Decisões de refinamento tomadas nesta sprint

Registradas em detalhe na seção "Histórico de refinamento" do backlog. Resumo:

| Item | Decisão |
|---|---|
| Mínimo de senha mestra | 8 caracteres, com maiúscula, minúscula e número |
| Tentativas de desbloqueio erradas | bloqueio progressivo de UI: 30s → 1min → 2min → 4min → 8min → teto de 15min; sem bloqueio permanente nem apagamento automático |
| Aviso de tentativa errada | notificação local na próxima abertura bem-sucedida — sem e-mail/rede, mantém offline-first |
| Importação de backup | substitui o cofre atual, com backup automático de segurança antes de sobrescrever |
| Timeout de auto-lock | 3 minutos, default |
| Escopo do mentor (Claude) | liberado para conduzir também teste exploratório e caça a bugs, mantendo a explicação obrigatória de todo passo e decisão |

## Mudança de processo desta sprint

O README foi ajustado: a exclusividade de teste exploratório/caça a bugs do QA foi
revertida a pedido do próprio QA, para que o aprendizado aconteça por demonstração até
ele conseguir executar essas etapas sozinho — a obrigação de explicar tudo continua sem
exceção.

## O que fica para o refinamento da Sprint 3/4 (não bloqueia a Sprint 1)

Itens sinalizados no backlog como "a definir", que ficam para quando a sprint deles
chegar, em vez de travar a abertura da Sprint 1:

- H2.2 — chave de recuperação continua válida ou é rotacionada após o uso?
- H3.1 — campos obrigatórios e limites de tamanho do CRUD de credenciais.
- H3.2 — mitigação para o clipboard não limpar se o app for morto antes dos 30s.
- H3.3 — limites configuráveis do timeout de auto-lock e política ao ir para background.
- H4.1 — tamanho mínimo/máximo do gerador de senhas.

## Estado do ambiente (checado em 2026-09-09, revisar antes da Sprint 1)

Instalados: Git, Node, Java JDK, winget. Pendentes: Android Studio/SDK/emulador, Python,
Appium Server + driver uiautomator2, Detox, Allure — guia completo em
[setup-ambiente-windows.md](../sprint-0/setup-ambiente-windows.md).

## Próximo passo

Abrir o refinamento da Sprint 1 (núcleo criptográfico e cofre) e, em paralelo, o QA
seguir o guia de ambiente para deixar a máquina pronta para rodar a primeira automação.
