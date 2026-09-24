# Definition of Done (DoD) do SafeVault

> Aprovada em 2026-09-24. Diferente da [Definition of Ready](backlog-5-sprints.md), que
> é avaliada **história por história** antes dela entrar numa sprint, a DoD é **uma só,
> para todas as histórias, de todas as sprints**. É o checklist que decide quando uma
> história pode sair do "Em progresso" e ir para "Concluído" — o equivalente ao que, no
> Jira, costuma virar uma checklist fixa anexada à coluna "Done" do board.

Uma história do SafeVault só está **pronta** quando:

- [ ] **Critérios de aceite validados manualmente pelo QA** — não basta o dev achar que
  funciona; alguém roda o fluxo e confere item a item do critério.
- [ ] **`testID` adicionado e registrado** conforme o
  [padrão combinado](padrao-testid.md) — e o dev avisou qual `testID` usou.
- [ ] **Testes automatizados da história passando** — unitário (Jest) para lógica
  isolada, Appium/Detox para fluxo de UI, conforme o que a sprint já cobre naquele
  momento. Equivalente a "build verde" antes de dar merge, como você já faz com
  `cy:run` no Cypress.
- [ ] **Nenhum segredo em log** — checagem manual do `logcat` do Android nas histórias
  que tocam senha mestra, DEK, KEK, chave de recuperação ou qualquer credencial.
- [ ] **Commits seguem o padrão** (Conventional Commits, em português, com escopo,
  corpo explicando o quê/porquê) e o PR (quando existir CI) foi revisado.
- [ ] **Sem regressão perceptível** nas histórias das sprints anteriores — pelo menos um
  fluxo de fumaça (smoke) das sprints já entregues, rodado manualmente ou pela suíte.
- [ ] **Documentação afetada atualizada** — se a história mudar uma decisão registrada
  em `docs/sprint-0/` (arquitetura, backlog, risco), o documento é atualizado no mesmo
  commit ou num commit de documentação logo em seguida, nunca deixado desatualizado.

## Como isso se conecta ao que você já usa

- É o mesmo papel que o "Definition of Done" tem em qualquer board Scrum/Jira que você
  já usou — só que agora é a nossa, escrita, em vez de implícita.
- "Build verde antes de dar done" é o mesmo hábito de rodar a suíte do Cypress/REST
  Assured antes de marcar uma tarefa como concluída.
- A checagem de log sem segredo é o equivalente, em espírito, ao mascaramento de
  `authorization`/`password` que você já viu em relatório de teste de API — só que aqui
  é uma inspeção ativa, não uma máscara automática (ainda não temos ferramenta pra isso
  no app; é revisão manual até virar um teste automatizado na Sprint 5, H5.2).

## O que ela NÃO cobre (de propósito)

A DoD não substitui o critério de aceite de cada história (isso é o DoR) nem a decisão
de release da Sprint 5 (H5.5, que é sobre o **produto inteiro**, não uma história). Ela
é o degrau de qualidade mínimo de **cada** entrega individual.
