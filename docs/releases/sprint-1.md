# Notas de release — Sprint 1

**Data de encerramento:** 2026-09-30
**Tag:** `sprint-1`

## Objetivo da sprint

Existir um cofre que abre e fecha com segurança matemática correta. Sem CRUD ainda —
é a fundação: se estivesse errada, todo o resto herdaria o erro.

## Entregue

- **H1.1 — Criar cofre com senha mestra**: derivação de chave via Argon2id
  (`react-native-libsodium`, calibrado por device, piso de segurança 19 MiB/t=2/p=1,
  nunca abaixo disso mesmo em device fraco), salt de 16 bytes via CSPRNG, DEK de 32
  bytes embrulhada por AES-256-GCM, banco SQLCipher criado com a DEK. Tudo ou nada —
  se a abertura do banco falhar depois de gravar o cabeçalho, desfaz os dois.
- **H1.2 — Desbloquear com a senha mestra**: verificação por decifragem com checagem
  de auth tag (não hash guardado à parte), mensagem sempre genérica pra senha errada,
  bloqueio progressivo por tentativas (30s → 1min → 2min → 4min → 8min → teto de
  15min), contagem regressiva exata na tela, contador persistido sobrevivendo a
  fechar/reabrir o app.
- **H1.3 — Formato de dados versionado**: `formatVersion` no cabeçalho do cofre;
  versão desconhecida é recusada, não adivinhada.
- **H1.4 — Camada de criptografia isolada**: nada fora de `crypto/` fala com a lib de
  cripto diretamente; lint falha o build se `Math.random(` aparecer em `src/`.
- **Telas funcionais** (criar/desbloquear/trancar cofre) verificadas rodando de
  verdade no emulador via toque real (`adb input`), não só chamada de função —
  incluindo persistência sobrevivendo a fechar e reabrir o app.
- **78 testes automatizados** (Jest), cobrindo cada camada isoladamente com dublês
  para os módulos nativos, e a orquestração completa em `VaultService`.

## Teste exploratório (2026-09-29 a 2026-09-30)

Primeira rodada de teste exploratório manual e automatizado do projeto, registrada em
detalhe em [backlog-5-sprints.md](../sprint-0/backlog-5-sprints.md) (seção "Sprint 1
— Núcleo criptográfico e cofre"). Resumo:

| Teste | Resultado |
|---|---|
| Corrida: matar o processo durante `createVault` (0–1500ms, 7 medições) | Aprovado — sempre "tudo ou nada" |
| Corrida: matar o processo durante `unlockVault` (0–1500ms, 9 medições) | Aprovado — sempre recupera, nunca perde o cofre |
| Segurança: matar o app durante o bloqueio por tentativas (H1.2) | Aprovado — bloqueio sobrevive, comparação byte a byte do secure-store no disco |
| Duplo-toque no botão de desbloquear | Investigado a fundo (via `adb logcat`) — contagem do H1.2 correta, sem bug de concorrência confirmado |
| Vazamento por autofill (Google Password Manager) | Aprovado — nenhum prompt de salvar, nenhuma sugestão, senha nunca aparece em texto puro no log do app |
| Senha muito longa (300 caracteres) | Aprovado — ponta a ponta, sem truncamento nem lentidão |
| Emoji na senha mestra | Bloqueado (decisão de produto) |
| Composição de acento por tecla morta | **Defeito real encontrado** ([Issue #1](https://github.com/joaozanca/safe-vault-app/issues/1)) — ver correções abaixo |

## Correções aplicadas

- **Normalização Unicode (NFC) antes de derivar a chave** (`kdf.ts`/`deriveKey`):
  sem isso, a mesma senha visualmente idêntica podia derivar chaves diferentes
  dependendo de como o teclado/SO compõe caractere acentuado (precomposto vs.
  decomposto) — mais perigoso que o bug de tecla morta, porque não dava nenhum aviso
  visual. Corrigido e coberto por teste unitário.
- **Bloqueio de letra acentuada na senha mestra** (mitigação para a Issue #1):
  tentativa de correção direta (tornar os campos de senha "não controlados") não
  resolveu — testado e confirmado pelo QA no teclado real, revertido em seguida. A
  causa raiz é uma limitação confirmada de upstream do React Native com New
  Architecture/Fabric (issue equivalente:
  [react-native#56463](https://github.com/react/react-native/issues/56463)), não
  corrigível só no código do app. Decisão do QA/Tech Lead: restringir acento na
  senha mestra em vez de desabilitar New Architecture ou aceitar sem mitigação.

## Decisões de refinamento tomadas nesta sprint

| Item | Decisão |
|---|---|
| Emoji na senha mestra | Bloqueado — reação ao defeito de composição, mesmo mecanismo por baixo |
| Acento na senha mestra | Bloqueado — mitigação pra Issue #1, decisão de produto (não corrigível só no app) |
| Risco residual do acento (artefato "~a" da tecla morta quebrada) | Aceito sem mitigação adicional — heurística pra bloquear seria frágil e geraria falso positivo |
| Normalização Unicode | NFC, aplicada em `deriveKey()`, cobrindo criação e desbloqueio de uma vez |
| Desabilitar New Architecture | Descartado — mudança grande, sem garantia de resolver, para um projeto de portfólio que deve mostrar prática atual do RN |

## Issue conhecida, ainda aberta

[Issue #1](https://github.com/joaozanca/safe-vault-app/issues/1) — composição de
acento por tecla morta quebrada nos campos de senha (`~` + `a` não compõe `ã`).
Limitação de upstream do React Native/Fabric, sem correção possível só no código do
app. Impacto mitigado (não corrigido) pelo bloqueio de acento na senha mestra.

## O que fica para a Sprint 2 (não bloqueia)

Sprint 2 — recuperação e portabilidade: chave de recuperação (H2.1), export/import de
backup (H2.2/H2.3). Ver [backlog-5-sprints.md](../sprint-0/backlog-5-sprints.md).

## Próximo passo

Abrir o refinamento da Sprint 2 (recuperação e portabilidade).
