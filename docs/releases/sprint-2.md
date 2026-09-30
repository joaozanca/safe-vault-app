# Notas de release — Sprint 2

**Data de encerramento:** 2026-09-30
**Tag:** `sprint-2`

## Objetivo da sprint

Recuperação e portabilidade: o cofre não pode morrer com o celular. Se o usuário
esquecer a senha mestra ou trocar de aparelho, precisa existir um jeito seguro de
recuperar ou levar o cofre junto — sem depender do backup automático do sistema, que o
projeto desativa de propósito (o cofre é offline-first, a única cópia de segurança
deve ser intencional e cifrada pelo próprio usuário).

## Entregue

- **H2.1 — Gerar chave de recuperação**: chave de 256 bits via CSPRNG (entropia alta
  o bastante para dispensar Argon2id — usada direto como chave AES-256-GCM), exibida
  uma única vez na tela com `usePreventScreenCapture()` ativo, DEK reembrulhada com
  ela. Nada é persistido até o usuário confirmar ter guardado a chave
  (`confirmarChaveDeRecuperacao`) — a ausência do campo `recovery` no cabeçalho do
  cofre já é o sinal de "recuperação não configurada", sem precisar de uma flag
  separada.
- **H2.2 — Entrar com a chave de recuperação**: fluxo "esqueci minha senha" —
  valida a chave informada (aceita com ou sem traços), desembrulha a DEK, exige uma
  nova senha mestra e reembrulha a DEK com ela (novo salt, nova calibração). A chave
  de recuperação usada é descartada automaticamente (rotação): usá-la já deixa o
  cofre de novo em estado "recuperação não configurada", reaproveitando o mesmo sinal
  do H2.1 em vez de um campo novo. Decisão de refinamento: rotacionar em vez de
  permitir reuso indefinido da mesma chave — ver seção abaixo.
- **H2.3 — Exportar o cofre**: gera um arquivo `.safevault` autocontido (cabeçalho +
  banco cifrado, ambos protegidos por uma senha de exportação própria, independente
  da senha mestra), salvo via Storage Access Framework (picker de pasta do Android,
  necessário criar subpasta dentro de `Download` — a raiz é bloqueada pelo SO a
  partir do Android 11). Indicador de força de senha em tempo real no formulário.
- **H2.4 — Importar o cofre**: dois modos — **cofre novo** (aparelho sem cofre ainda)
  e **substituir cofre existente** (com checkbox de confirmação extra, por ser
  destrutivo). Antes de substituir, cria automaticamente um backup de segurança do
  cofre atual. Descoberta real de plataforma durante a implementação: o
  `expo-file-system` se recusa a **criar** arquivo novo fora de `documentDirectory`/
  `cacheDirectory` — inclusive dentro da própria pasta `databases/` do SQLite, mesmo
  ela já existindo (`IOException: Location ... isn't writable`). Escrever **por cima**
  de um arquivo já existente funciona normalmente. Isso invalidou o desenho original
  (arquivo temporário + rename atômico) — ajustado para escrever direto sobre o banco
  atual (que já existe, garantido pela conexão aberta ou por um truque de abrir e
  fechar uma conexão `op-sqlite` só para materializar o arquivo). Redução consciente
  de atomicidade, mitigada pelo backup de segurança automático que já roda antes.
- **H2.5 — Backup rápido de um toque**: reaproveita a senha mestra da sessão atual
  (o usuário já desbloqueou o cofre) para gerar e salvar o `.safevault` sem precisar
  digitar senha de exportação separada — um botão, um toque, um arquivo salvo.
- **H2.6 — Desativar o backup automático do Android**: `allowBackup=false` +
  `dataExtractionRules` (API 31+) via Config Plugin próprio
  (`plugins/withDataExtractionRules.js`), verificado de verdade no emulador via
  `adb shell bmgr backupnow` (recusado: `Backup is not allowed`) e
  `adb shell dumpsys backup` (o app não aparece na lista de participantes, ao
  contrário de dezenas de apps de terceiro que aparecem — confirma que o teste tem
  poder de detecção, não é um "não-efeito" do ambiente). Descoberta durante o
  `prebuild`: o `expo-secure-store` também tenta configurar suas próprias regras de
  backup por padrão, e o plugin próprio estava silenciosamente vencendo a corrida,
  apagando a proteção do `expo-secure-store` sobre seu armazenamento cifrado. Corrigido
  mesclando manualmente a regra de exclusão do `expo-secure-store` no XML próprio e
  desligando explicitamente `configureAndroidBackup` no plugin dele
  (`app.json`), deixando a posse do arquivo explícita.
- **116 testes automatizados** (Jest) — 38 novos desde a Sprint 1, cobrindo
  `VaultService` (recuperação) e o novo `BackupService` (exportar/importar).

## Decisões de refinamento tomadas nesta sprint

| Item | Decisão |
|---|---|
| Reuso da chave de recuperação após um "esqueci senha" | Rotacionar automaticamente (gerar sinal de "recuperação não configurada" de novo) em vez de permitir reuso indefinido — uma chave de recuperação usada e comprometida não deveria continuar valendo para sempre |
| Backup automático do Android (H2.6) | Desativado por completo (`allowBackup=false`) — cofre é offline-first por decisão de produto, a única cópia deve ser o `.safevault` intencional do usuário, nunca um snapshot do SO fora do controle dele |
| `android:fullBackupContent` (mecanismo legado, pré-API 31) | Não replicado, só o `dataExtractionRules` moderno — aceito como limitação de escopo de baixo impacto, já que `allowBackup=false` já bloqueia backup em qualquer versão do Android, independente do mecanismo |
| Conflito de regras de backup com `expo-secure-store` | Mesclar a regra dele na própria XML do projeto, em vez de ignorar o aviso do `prebuild` ou deixar os dois plugins competirem |

## Issue conhecida, ainda aberta

[Issue #1](https://github.com/joaozanca/safe-vault-app/issues/1) — composição de
acento por tecla morta quebrada nos campos de senha, herdada da Sprint 1. Sem
mudança nesta sprint.

## O que fica para a Sprint 3 (não bloqueia)

Sprint 3 — CRUD de senhas guardadas no cofre (criar, listar, editar, excluir
entradas). Ver [backlog-5-sprints.md](../sprint-0/backlog-5-sprints.md).

## Próximo passo

Abrir o refinamento da Sprint 3 (CRUD do cofre).
