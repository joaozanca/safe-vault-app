# Backlog do produto — 5 sprints, ordenado por risco

Princípio de ordenação: **o que causa perda ou vazamento da sua senha real vem primeiro**.
Polimento visual vem por último. Backup e recuperação são Sprint 2, antes de qualquer
refinamento de UI — como você exigiu.

Cada história está no formato `Como <papel>, quero <ação>, para <benefício>`. Os
**critérios de aceite** aqui são propostas — no refinamento de cada sprint o QA questiona
ambiguidade e a gente ajusta antes de codar.

Legenda de risco: 🔴 crítico (perda/vazamento de dado) · 🟠 alto · 🟡 médio.

---

## Histórico de refinamento

> Igual ao campo de comentários/histórico de uma issue no Jira: registro do que foi
> decidido, quando, e o que ainda está em aberto.

**2026-09-24 — respostas às provocações da Sprint 0:**
- H1.1: senha mestra mínima fixada em 8 caracteres, com maiúscula, minúscula e número
  (ver ressalva de segurança na própria história).
- H1.2: 5 tentativas erradas → bloqueio temporário de UI (ver detalhamento na história).
  Aviso por e-mail ficou pendente de decisão — ver entrada seguinte.
- H2.1/H2.2: confirmado sem alteração — segue exatamente a proposta da Sprint 0.
- H2.4: importar **substitui** o cofre atual (decisão tomada).
- H3.3: auto-lock com timeout default de **3 minutos**.

**2026-09-24 (mesmo dia, follow-up) — fecha os pendentes:**
- H1.2: aviso de tentativa errada vira **notificação local**, sem e-mail/rede — mantém
  offline-first. E-mail registrado como ideia de backlog futuro (pós-Sprint 5).
- H1.1: mínimo de senha mestra **confirmado em 8 caracteres**, ciente do trade-off
  comprimento × entropia; revisitar no H5.1 se a Sprint 5 apontar necessidade.

---

## Sprint 1 — Núcleo criptográfico e cofre

> Objetivo: existir um cofre que abre e fecha com segurança matemática correta. Sem CRUD
> ainda. É a fundação — se estiver errada, todo o resto herda o erro.

### H1.1 🔴 Criar cofre com senha mestra
**Como** dono do cofre, **quero** criar um cofre protegido por uma senha mestra,
**para** que meus dados fiquem cifrados em repouso.
Critérios de aceite (propostos):
- Na primeira execução, o app exige definir senha mestra e confirmá-la.
- A senha mestra nunca é gravada; deriva-se uma chave via Argon2id (params calibrados no
  device, piso 19 MiB / t=2 / p=1).
- Um salt aleatório de 16 bytes (CSPRNG) é gerado e persistido.
- Uma DEK aleatória de 32 bytes é gerada e persistida **embrulhada** (AES-256-GCM) pela
  chave derivada.
- O banco SQLCipher é criado e aberto com a DEK.
- **Senha mestra mínima (decisão do refinamento, 2026-09-24):** 8 caracteres, com ao
  menos 1 maiúscula, 1 minúscula e 1 número. Abaixo disso, recusada com mensagem clara
  listando a regra que faltou.
- **Erro:** se a gravação da DEK embrulhada falhar no meio, o app não deixa um cofre
  meio-criado — ou cria tudo, ou nada (transação/rollback).

> **Nota de segurança (decisão confirmada, 2026-09-24 — mantido em 8 caracteres):**
> registrada a ressalva de que, para uma **senha mestra que protege todas as outras**,
> comprimento pesa mais que mistura de classes (`Senha123` atende às 3 regras acima com
> ~52 bits de entropia; uma frase como `cavalo-azul-portao-13` passa de 70 bits só pelo
> tamanho, sem precisar de maiúscula forçada). Você optou por manter 8 caracteres
> cientes desse trade-off. Fica como item para revisitar no H5.1 (calibração do KDF em
> device real) se a bateria de testes de segurança da Sprint 5 mostrar necessidade de
> reforçar.

### H1.2 🔴 Desbloquear o cofre com a senha mestra
**Como** dono do cofre, **quero** abrir o cofre digitando a senha mestra, **para**
acessar meus dados.
Critérios (propostos):
- Senha correta → DEK desembrulhada, banco aberto, navega para a tela principal.
- Senha errada → mensagem genérica ("senha incorreta"), sem vazar se o cofre existe ou
  quão perto chegou.
- A verificação de senha é a **própria decifragem com checagem da auth tag** (não um
  hash guardado à parte).
- **Política de tentativas (decisão do refinamento, 2026-09-24):** após 5 tentativas
  erradas consecutivas, a **UI** de desbloqueio bloqueia por um tempo — proposta:
  30 s no 1º bloqueio, dobrando a cada novo bloco de 5 erradas (30 s → 1 min → 2 min…),
  com teto a definir, para não virar recusa permanente por engano de digitação.
- **Aviso de tentativa (decisão do refinamento, 2026-09-24): aviso local, sem rede.**
  Na próxima abertura bem-sucedida após tentativa(s) errada(s), o app mostra
  "houve N tentativas erradas desde a última vez que você entrou". Sem e-mail, sem
  servidor — mantém o produto 100% offline-first. E-mail de alerta fica registrado como
  ideia de backlog futuro (pós-Sprint 5), não entra nas 5 sprints atuais.
- Tempo de desbloqueio alvo ≤ 1,5 s no emulador de referência.

> **Nota de segurança (por que o bloqueio de UI não é a proteção principal):** o
> bloqueio de tentativas atrapalha quem está com o celular **destravado** na mão
> tentando adivinhar sua senha na tela. Mas quem rouba o **arquivo** do cofre (backup,
> celular perdido com acesso ao armazenamento) não passa pela sua UI — ataca o arquivo
> offline, sem limite de tentativas, no ritmo que quiser. Quem protege contra isso é o
> custo do Argon2id ([arquitetura.md](arquitetura.md) seção 4), não o contador. O
> contador é uma segunda camada útil, mas não é onde a segurança real mora.

### H1.3 🔴 Formato de dados versionado
**Como** time, **queremos** que todo artefato persistido carregue um número de versão de
formato, **para** que migrações futuras não corrompam cofres existentes.
Critérios:
- Header do cofre, do backup e do registro no secure-store têm `formatVersion = 1`.
- Abrir um cofre com `formatVersion` desconhecida (maior que a suportada) → recusa
  educada, não tenta adivinhar.

### H1.4 🟠 Camada de criptografia isolada + proibição de `Math.random`
**Como** time, **queremos** toda chamada de cripto atrás de uma única camada e uma regra
de lint contra `Math.random`, **para** manter o código auditável.
Critérios:
- Nenhum arquivo fora de `crypto/` importa a lib de cripto diretamente.
- Lint falha o build se `Math.random(` aparecer em `src/`.
- Testes unitários (Jest) da camada: derivação determinística dado salt+params, nonce
  sempre diferente, decifrar com chave errada lança erro.

**Fora de escopo de propósito na Sprint 1:** biometria, recuperação, CRUD, export,
gerador, qualquer tela bonita. Telas são funcionais e feias.

---

## Sprint 2 — Recuperação e portabilidade (rede de proteção contra perda)

> Objetivo: você **nunca** ficar trancado para fora nem perder o cofre por um celular
> quebrado. Vem antes de CRUD porque perder acesso é pior que não ter CRUD.

### H2.1 🔴 Chave de recuperação gerada na criação
**Como** dono do cofre, **quero** receber uma chave de recuperação ao criar o cofre,
**para** poder voltar a entrar se esquecer a senha mestra.
Critérios (propostos):
- Gerada na criação (256 bits CSPRNG), logo após H1.1.
- Exibida **uma única vez**, em tela com bloqueio de screenshot.
- Exige confirmação ativa ("guardei em local seguro") para prosseguir.
- Cria uma segunda cópia da DEK embrulhada, agora por uma chave derivada da recovery key.
- A chave nunca aparece em log, cache, backup automático ou notificação.
- **Erro:** se o app fechar durante a exibição, na próxima abertura ele **não** mostra a
  chave de novo — oferece regenerar (invalidando a antiga).

### H2.2 🔴 Entrar com a chave de recuperação
**Como** dono do cofre, **quero** usar a chave de recuperação quando esqueci a senha,
**para** recuperar o acesso e definir uma senha nova.
Critérios:
- Fluxo "esqueci a senha" → campo para a chave de recuperação.
- Chave válida → desembrulha a DEK → **obriga** a definir nova senha mestra → reembrulha.
- Chave inválida → mensagem genérica.
- Após uso bem-sucedido, decidir: a chave antiga continua válida ou é rotacionada?

### H2.3 🔴 Exportar o cofre em arquivo cifrado
**Como** dono do cofre, **quero** exportar o cofre para um arquivo cifrado, **para** ter
um backup fora do celular.
Critérios (propostos):
- Usuário define uma **senha de exportação** com indicador de força; sem opção "sem
  senha".
- Arquivo `.safevault`: header (versão, params KDF, salt, nonce) + blob AES-256-GCM.
- Escrita atômica (arquivo temporário + rename) — queda no meio não deixa arquivo
  parcial que parece válido.
- Nome sugerido com data; salvo via seletor do sistema (SAF).
- Nada em claro no arquivo, nem metadados de credenciais.

### H2.4 🔴 Importar de um arquivo cifrado
**Como** dono do cofre, **quero** restaurar de um arquivo exportado, **para** recuperar
meus dados num aparelho novo.
Critérios:
- Pede a senha de exportação; valida a auth tag **antes** de tocar em qualquer dado
  local.
- Arquivo corrompido/senha errada → falha limpa, cofre atual intacto.
- **Comportamento (decisão do refinamento, 2026-09-24): importar SUBSTITUI o cofre
  atual** (sem mesclagem).
- **Salvaguarda de engenharia:** como substituir é destrutivo e irreversível pela UI, o
  app faz um **backup automático cifrado do cofre atual** (mesmo formato do H2.3, senha
  temporária derivada da sessão) antes de sobrescrever, mais uma tela de confirmação
  explícita ("isto vai substituir todas as suas credenciais atuais"). Isso não muda a
  decisão que você tomou, só evita que um toque errado vire perda permanente.
- Versão de formato incompatível → recusa.

### H2.5 🟠 Backup manual rápido
**Como** dono do cofre, **quero** um botão de backup, **para** gerar uma cópia cifrada
sem repensar as opções toda vez.
Critérios: reusa H2.3; um toque; confirma onde salvou.

### H2.6 🔴 Desativar backup automático do sistema
**Como** dono do cofre, **quero** que o Android não suba meu cofre para a nuvem sem a
minha cifra, **para** não vazar por um canal que eu não controlo.
Critérios: `allowBackup=false`; `dataExtractionRules` excluindo os arquivos do cofre;
teste que confirma o cofre fora do conjunto de auto-backup.

**Fora de escopo de propósito:** CRUD completo, biometria, gerador, busca, UI refinada.

---

## Sprint 3 — Uso diário seguro (CRUD + vazamento na operação)

> Objetivo: usar o cofre no dia a dia sem vazar por clipboard, screenshot, app switcher
> ou cofre destravado esquecido aberto.

### H3.1 🟠 CRUD de credenciais
**Como** usuário, **quero** criar, ver, editar e excluir credenciais (título, usuário,
senha, URL, notas, categoria), **para** guardar meus acessos.
Critérios (propostos):
- Todos os campos persistidos no banco cifrado.
- Senha exibida mascarada por padrão; toggle para revelar.
- Excluir pede confirmação.
- Editar não deixa versão antiga decifrável em disco (sem "lixo" de update).
- Campos obrigatórios e limites definidos no refinamento.

### H3.2 🔴 Copiar com limpeza automática em 30 s
**Como** usuário, **quero** que a senha copiada seja apagada da área de transferência em
30 segundos, **para** não deixar rastro.
Critérios:
- Ao copiar: marca o conteúdo como sensível (Android 13+), mostra aviso com contagem.
- Após 30 s (± tolerância a definir), limpa **se** o conteúdo ainda for o nosso.
- Se o usuário copiou outra coisa nesse meio-tempo, não apaga o dele.
- App morto antes dos 30 s: decidir mitigação (documentar limitação? serviço curto?).

### H3.3 🔴 Bloqueio automático por inatividade
**Como** usuário, **quero** que o cofre tranque sozinho após inatividade, **para** que
alguém com meu celular na mão não veja meus dados.
Critérios:
- **Timeout (decisão do refinamento, 2026-09-24): default de 3 minutos**, configurável
  pelo usuário dentro de limites a definir (mín./máx.).
- Ao trancar: KEK e DEK zeradas da memória, navega para a tela de desbloqueio.
- App para background → tranca conforme política (imediato? após X?) — **ainda em
  aberto**: ir para background já é um sinal mais forte que "inatividade dentro do app";
  proposta é tratar como caso à parte, com timeout menor ou trava imediata — confirmar
  no refinamento da Sprint 3.
- Timer reinicia a cada interação.

### H3.4 🔴 Bloqueio de screenshot e ocultação no app switcher
**Como** usuário, **quero** que o app não possa ser fotografado nem apareça na prévia de
apps recentes, **para** não vazar a tela.
Critérios:
- `FLAG_SECURE` ativo em todas as telas com dado sensível.
- Screenshot dentro do app → bloqueado pelo SO.
- App switcher mostra tela neutra, não o conteúdo.

### H3.5 🟠 Desbloqueio por biometria
**Como** usuário, **quero** abrir com digital/rosto, **para** agilizar sem digitar a
senha toda hora.
Critérios:
- Opt-in nas configurações; exige a senha mestra para ativar.
- Primeira abertura após reiniciar o aparelho → **exige senha mestra**, não biometria.
- Trocar a senha mestra ou alterar digitais do aparelho → invalida a biometria, cai
  para senha.
- DEK biométrica guardada no Keystore, liberada só pelo BiometricPrompt.

**Fora de escopo de propósito:** gerador, indicador de força, busca/filtro, UI refinada.

---

## Sprint 4 — Ferramentas de senha e organização

> Objetivo: qualidade de vida. Risco menor — nada aqui perde ou vaza o cofre inteiro.

### H4.1 🟡 Gerador de senhas configurável
**Como** usuário, **quero** gerar senhas fortes com regras (tamanho, maiúsc./minúsc.,
números, símbolos, excluir ambíguos), **para** não reusar senhas.
Critérios:
- Aleatoriedade só do CSPRNG.
- Garante ao menos 1 de cada classe marcada.
- Tamanho mín./máx. definidos no refinamento.
- Nunca loga a senha gerada.

### H4.2 🟡 Indicador de força da senha
**Como** usuário, **quero** ver quão forte é uma senha, **para** decidir se troco.
Critérios: estimativa por biblioteca consagrada (ex.: zxcvbn); cálculo local; sem enviar
nada para lugar nenhum.

### H4.3 🟠 Alerta de senha repetida
**Como** usuário, **quero** ser avisado quando uso a mesma senha em mais de uma
credencial, **para** corrigir o reúso.
Critérios:
- Comparação feita **com o cofre destravado, em memória** (nunca índice em claro no
  disco).
- Mostra quantas e quais entradas compartilham (sem exibir a senha).

### H4.4 🟡 Busca e filtro por categoria
**Como** usuário, **quero** buscar por título/usuário/URL e filtrar por categoria,
**para** achar rápido.
Critérios: busca sobre dados já decifrados em memória; sem persistir termo de busca.

---

## Sprint 5 — Endurecimento, regressão e decisão de release

> Objetivo: transformar "funciona" em "posso confiar minha senha real nisto".

### H5.1 🔴 Calibração e reteste do KDF em devices reais
Rodar Argon2id num celular físico (não só emulador), ajustar parâmetros, documentar
tempos. Garantir que um device fraco não fica inutilizável.

### H5.2 🔴 Bateria de testes de segurança
- Nenhum segredo em `logcat` durante fluxos completos.
- Nenhum segredo no diretório de backup do app.
- Nonce nunca repetido entre registros (teste de invariante).
- Arquivo do cofre em repouso é indistinguível de ruído (sem strings legíveis).
- Cofre continua íntegro após "matar" o app em cada etapa crítica.

### H5.3 🟠 Suíte de regressão completa (Appium + Detox) + pipeline
- Fluxos críticos no Detox; suíte ampla no Appium; Allure publicado pelo CI.
- GitHub Actions com emulador rodando a suíte a cada PR.

### H5.4 🟡 Acessibilidade e polimento de UI
Agora sim: contraste, tamanho de toque, labels de acessibilidade, textos, estados de
carregamento e erro. **De propósito por último.**

### H5.5 🔴 Critérios de saída e decisão de release
Fechar a checklist de release (definida na Sprint 1) e o QA decide liberar ou não.

---

## Resumo da ordenação por risco

| Sprint | Foco | Por que nessa posição |
|---|---|---|
| 1 | Núcleo cripto + cofre | erro aqui contamina tudo; é a base matemática |
| 2 | Recuperação + backup | ficar trancado para fora ou perder o cofre é o pior resultado possível |
| 3 | CRUD + anti-vazamento na operação | uso diário é onde o segredo escapa (clipboard, screenshot, cofre aberto) |
| 4 | Gerador, força, reúso, busca | conveniência; falha aqui não derruba o cofre |
| 5 | Endurecimento + release | vira produto confiável; polimento visual só agora |
