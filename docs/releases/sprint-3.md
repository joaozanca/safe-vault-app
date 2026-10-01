# Notas de release — Sprint 3

**Data de encerramento:** 2026-10-01
**Tag:** `sprint-3`

## Objetivo da sprint

Uso diário seguro: usar o cofre no dia a dia sem vazar por clipboard, screenshot, app
switcher ou cofre destravado esquecido aberto.

## Entregue

- **H3.1 — CRUD de credenciais**: repositório SQL (`credentialsRepository.ts`) +
  serviço de domínio (`CredentialService.ts`, valida título/usuário/senha obrigatórios
  e limites de tamanho por campo) + telas de lista e formulário único de criar/editar.
  `PRAGMA secure_delete = ON` ligado na abertura do banco — ataca direto o critério
  "editar não deixa versão antiga decifrável em disco": sem a pragma, o SQLite só
  marca o espaço antigo como livre, sem zerar.
- **H3.2 — Copiar com limpeza automática**: `ClipboardService.ts` copia a senha e
  agenda a limpeza em 30s, só apagando se o clipboard ainda for exatamente o valor
  copiado (se o usuário copiou outra coisa no meio-tempo, não mexe). Marcar o
  conteúdo como sensível no Android 13+ (suprime a prévia no toast do sistema) ficou
  fora de escopo — exigiria um módulo nativo Kotlin só pra isso.
- **H3.3 — Bloqueio automático por inatividade**: `AutoLockController.ts` com dois
  gatilhos pro mesmo timeout (3 min, fixo por enquanto): timer de primeiro plano e
  checagem ao retomar o foreground via `AppState` (cobre o Android suspender o JS em
  background). Decisão do refinamento: ir para background não tranca na hora — entra
  no mesmo timer único, porque trocar de app pra buscar uma informação e voltar é uso
  legítimo.
- **H3.4 — Bloqueio de screenshot e app switcher**: `usePreventScreenCapture()`
  (já usada desde o H2.1 só numa tela) movida para `App.tsx`, ligada uma vez pra
  sessão inteira. No Android, `FLAG_SECURE` resolve os dois critérios numa tacada só.
- **H3.5 — Desbloqueio por biometria**: `BiometricService.ts` usa
  `expo-secure-store` com `requireAuthentication: true` — DEK no Android Keystore,
  liberada só pelo `BiometricPrompt` do sistema, com invalidação automática quando o
  conjunto de digitais muda. Zero biblioteca nativa nova. Primeira tela de
  Configurações do app, com o opt-in de biometria (exige a senha mestra pra ativar).
  "Primeira abertura após reiniciar o aparelho exige senha mestra" implementado via
  flag em memória por processo — mais conservador que o critério literal.
- **170 testes automatizados** (Jest) — 54 novos desde a Sprint 2.

## Teste exploratório e verificação manual

Toda história verificada rodando de verdade no emulador, não só em teste unitário —
detalhe completo em [backlog-5-sprints.md](../sprint-0/backlog-5-sprints.md). Destaques:

| Teste | Resultado |
|---|---|
| H3.1: criar, editar (sem duplicar), excluir (cancelar e confirmar), persistência através de um ciclo trancar/destravar | Aprovado |
| H3.2: confirmação via chip de sugestão de clipboard do Gboard (prova que a senha chega no clipboard do sistema) e que some depois de 30s cronometrados (86s de espera real) | Aprovado |
| H3.3: tranca sozinho sem interação (~3min14s real); toque antes do timeout reinicia a contagem (confirmado destravado bem depois do marco original); retomada de segundo plano (backgrounded ~3min45s reais) | Aprovado — tempo real, sem acelerar relógio |
| H3.4: screenshot da tela de criar cofre saiu totalmente preta; card do app switcher com miniatura em branco | Aprovado |
| H3.5: PIN e digital virtual cadastrados no emulador de verdade (`adb emu finger touch`); ativar, desbloquear, backup rápido/importar somem numa sessão biométrica, primeira abertura após `force-stop` exige senha, desativar sem prompt extra | Aprovado |

**Achados fora do escopo das histórias, pelo caminho:**
- Texto desatualizado na tela de criar cofre (dizia que a chave de recuperação "ainda
  não existe nesta sprint" — resquício de antes do H2.1). Corrigido.
- O patch do `react-native-libsodium` (fix de CMake no Windows, da Sprint 1) tinha
  3751 linhas — quase tudo lixo de artefato de build que vazou pra dentro dele quando
  foi gerado, incluindo caminhos absolutos da máquina. Isso o deixava frágil o
  bastante pra falhar silenciosamente num clone novo do repositório. Minimizado para
  19 linhas (só a mudança real), testado aplicando do zero.
- Colar não insere texto em nenhum `TextInput` do app (testado em dois campos
  diferentes, incluindo um que já existia desde o H3.1) — mesma categoria da Issue #1
  (sincronização de edição nativa com o estado controlado do React Native sob
  Fabric). Não bloqueia nenhum critério de aceite (H3.2 é sobre copiar *para* o
  clipboard do sistema, não colar de volta no próprio formulário). Registrado como
  achado pra abrir uma Issue #2 quando houver a ferramenta `gh` disponível.

## Decisões de refinamento tomadas nesta sprint

| Item | Decisão |
|---|---|
| Timer de inatividade em background (H3.3) | Um timer único (não um separado pra background) — trocar de app de propósito e voltar é uso legítimo |
| Timeout configurável do H3.3 | Fica fixo em 3 min por enquanto — a tela de Configurações pra isso é escopo novo, maior que o resto da história |
| Digitação reiniciando o timer (H3.3) | Só toque/navegação, não tecla isolada — instrumentar ~15 campos em 7 telas não se justificava |
| "Reiniciar o aparelho" (H3.5) | Proxy por flag em memória de processo — mais conservador que o critério literal, sem precisar de módulo nativo |
| Backup rápido/Importar numa sessão biométrica (H3.5) | Ficam indisponíveis (sem a senha mestra em texto puro não tem como gerar o backup) — usuário cai no "Exportar" normal |
| Sensibilidade do clipboard no Android 13+ (H3.2) | Descartado — só suprimiria a prévia de um toast do sistema, não o controle de segurança real |

## Issue conhecida, ainda aberta

[Issue #1](https://github.com/joaozanca/safe-vault-app/issues/1) — composição de
acento por tecla morta quebrada nos campos de senha, herdada da Sprint 1. Sem mudança
nesta sprint. Um segundo achado da mesma categoria (colar não funciona em nenhum
`TextInput`) foi registrado nesta sprint, ainda sem issue aberta no GitHub.

## O que fica para a Sprint 4 (não bloqueia)

Sprint 4 — ferramentas de senha e organização: gerador de senhas, indicador de força,
alerta de senha repetida. Ver [backlog-5-sprints.md](../sprint-0/backlog-5-sprints.md).

## Próximo passo

Abrir o refinamento da Sprint 4 (ferramentas de senha e organização).
