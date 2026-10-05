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

**2026-09-24 (fechamento) — QA delega o teto do bloqueio ao Tech Lead e aprova o DoD:**
- H1.2: teto do bloqueio progressivo definido em **15 minutos** (rationale completo na
  própria história) — Sprint 1 agora passa no checklist de Definition of Ready.
- Definition of Done do projeto aprovada sem alteração — ver
  [definition-of-done.md](definition-of-done.md).
- **Sprint 0 encerrada. Sprint 1 liberada.**

**2026-09-24 (refinamento formal da Sprint 1) — 3 ambiguidades novas fechadas:**
- H1.1: device fraco nunca impede criar o cofre — usa o piso mínimo do Argon2id e segue,
  mesmo mais lento.
- H1.2: bloqueio mostra contagem regressiva exata, não mensagem genérica.
- H1.4: proibição de `Math.random` vale só para `src/` (código do app), não para código
  de teste.
- **H1.1 a H1.4 sem nenhuma ambiguidade pendente. Desenvolvimento da Sprint 1 liberado.**

**2026-09-29 — H1.1 e H1.2 implementados e verificados de ponta a ponta:**
Toda a cadeia rodando de verdade no emulador (não só em teste com dublê):
`VaultService.createVault()`/`unlockVault()` juntando calibração do Argon2id, hierarquia
KEK/DEK, AES-256-GCM e SQLCipher via `secure-store`. Confirmado no device: senha fraca
recusada, cofre criado, segunda criação recusada, senha errada recusada com mensagem
genérica, senha certa desbloqueia. 58 testes unitários (dublê da lib nativa em cada
módulo) + verificação manual real. Três bibliotecas nativas novas no caminho
(`react-native-quick-crypto`, `@op-engineering/op-sqlite`, `expo-secure-store`) — só a
`react-native-quick-crypto` teve build limpo de primeira; as outras duas já vieram
resolvidas de sprints anteriores.

**2026-09-29 (mesmo dia, continuação) — H1.1, H1.2, H1.3 e H1.4 fechados:**
Contador de tentativas erradas implementado (`UnlockAttemptTracker`) e ligado ao
`unlockVault` — bloqueio progressivo de verdade, testado no device: 5 erradas bloqueiam,
a 6ª tentativa (mesmo com a senha **certa**) é recusada sem sequer rodar o Argon2id.
Telas reais de criar/desbloquear/trancar (`CreateVaultScreen`, `UnlockScreen`,
placeholder pós-desbloqueio), com contagem regressiva de verdade na tela de bloqueio.
Verificado com toque real no emulador (`adb input tap/text`), não só chamada de função —
incluindo persistência sobrevivendo a fechar e reabrir o app. H1.3 também fechado:
`loadVaultHeader()` agora recusa `formatVersion` desconhecida em vez de só gravar sem
checar. **69 testes.**

**H1.1, H1.2, H1.3 e H1.4 — Sprint 1 completa**, exceto o que ficou de propósito fora de
escopo (chave de recuperação é H2.1/H2.2, biometria é H3.5, CRUD é Sprint 3).

**2026-09-29 (teste exploratório do QA) — achados e testes adicionais:**
- Defeito real encontrado e registrado ([Issue #1](https://github.com/joaozanca/safe-vault-app/issues/1)): acento composto por tecla morta
  (ex.: `~` + `a` → `ã`) não compõe corretamente nos campos de senha — `An~ao` em vez de
  `Anão`. Severidade alta: pode trancar o usuário fora do próprio cofre se a composição
  falhar de forma diferente entre criação e desbloqueio. Ainda sem correção.
- Botão "Mostrar/ocultar senha" adicionado nas telas de criar/desbloquear, a pedido do QA
  — foi o que permitiu enxergar o defeito acima.
- Emoji bloqueado na senha mestra (decisão do refinamento, reação ao defeito acima —
  emoji composto usa o mesmo mecanismo de composição).
- **Teste de corrida** (matar o processo durante `createVault`, de 0ms a 1500ms de
  atraso, 7 medições válidas): nunca produziu estado parcial — sempre "tudo" ou "nada",
  confirmando H1.1 na prática, não só em teste com dublê.
- **Teste de corrida (desbloqueio)**: mesmo experimento repetido matando o processo
  durante `unlockVault` (0/50/100/200/300/500/700/1000/1500ms de atraso, 9/9 medições).
  Em todo caso o app voltou limpo pra tela de desbloqueio e a senha certa voltou a
  funcionar depois — nunca precisou reinstalar nem perdeu o cofre. Ao inspecionar
  `databases/vault.db` do app (`run-as`, build debuggable) pra procurar `-wal`/
  `-journal` sujo, achei o arquivo com **0 bytes** e sem nenhum arquivo auxiliar — o
  que é esperado, não um defeito: o SQLite só grava algo no arquivo na primeira
  transação de escrita, e hoje `createVault`/`unlockVault` só fazem leitura
  (`SELECT count(*) FROM sqlite_master`). Ou seja, o risco que esse teste queria cobrir
  (journal/WAL corrompido por um `kill` no meio de uma escrita) **não existe ainda** —
  só passa a valer a partir da Sprint 3, quando o CRUD de credenciais introduzir
  escritas reais no banco. Repetir este teste específico (inspeção de journal/WAL)
  quando isso acontecer.
- **Teste de duplo-toque no botão de desbloquear** (H1.2): investigação em várias
  rodadas, incluindo instrumentação temporária com `console.log` (revertida depois,
  não sobrou no código) pra ver `failedCount`/`lockedUntil` reais via `adb logcat`.
  Conclusão: a contagem e o tempo de bloqueio do H1.2 estão corretos — `failedCount`
  sobe 1 a 1 (confirmado 0→1→2→3→4→5) e `lockedUntil` é gravado certinho na 5ª
  tentativa errada. As primeiras rodadas do teste pareciam mostrar "nunca bloqueia",
  mas era falso negativo do próprio teste manual (via `adb`): o bloqueio do 1º bloco
  dura só 30s, e o tempo gasto analisando cada resultado entre uma tentativa e outra
  passava dos 30s, então o bloqueio sempre expirava sozinho antes da tentativa
  seguinte. Dois achados reais, os dois de baixa severidade:
  - **UX**: a 5ª tentativa errada (a que só entra em vigor) ainda mostra "Senha
    incorreta." em vez de avisar na hora que o cofre acabou de travar — o usuário só
    descobre o bloqueio ao tentar de novo. O bloqueio em si já vale, é só falta de
    aviso imediato. Melhoria de UX pra sprint futura, não bug de segurança.
  - **Nota de design, não confirmada na prática**: `recordFailedAttempt` (em
    `UnlockAttemptTracker.ts`) lê o contador, soma 1 e grava — sem trava contra
    concorrência. Se duas chamadas rodassem em paralelo de verdade (ex.: um duplo
    toque que escapasse do `disabled` do botão), poderiam ler o mesmo valor antes de
    qualquer uma gravar e perder um incremento. Não consegui reproduzir isso empiricamente
    (o `adb` não tem precisão de milissegundos suficiente pra garantir duas chamadas
    genuinamente simultâneas, e o botão desabilita durante o carregamento, o que
    provavelmente já impede isso na prática). Revisitar com teste unitário controlado
    (mesmo padrão de `now`/`deriveKeyFn` injetáveis usado em `calibration.ts`) se
    quisermos fechar essa dúvida com certeza.
- **Teste de segurança: matar o app durante o bloqueio do H1.2** — a pergunta que
  importava de verdade: dá pra burlar o bloqueio de 30s só fechando e reabrindo o
  app bem no meio dele? Testes via UI (`adb input` + `uiautomator dump`) deram
  resultado inconclusivo várias vezes seguidas — não por falha do app, e sim porque
  o emulador nesta máquina varia muito de velocidade (uma rodada os 5 toques
  levaram 5s, outra rodada os mesmos 5 toques levaram 100s), tornando inviável
  cronometrar a janela de 30s pela tela. Troquei de método: comparei o arquivo
  criptografado do `secure-store` no disco do aparelho (`run-as cat
  shared_prefs/SecureStore.xml`) antes da 5ª tentativa errada, imediatamente depois
  dela (com o processo **ainda vivo**) e de novo logo **depois de matar o processo**
  (`am force-stop`). Resultado: o arquivo muda exatamente na 5ª tentativa (prova que
  a gravação do bloqueio aconteceu) e fica **idêntico, byte a byte** antes e depois
  de matar o processo — nada se perde. **Conclusão: não dá pra burlar o bloqueio
  matando o app.** A gravação no secure-store já está durável em disco antes do
  processo morrer.

**2026-09-30 — defeito real + correção: normalização Unicode da senha mestra.**
Investigando um ângulo diferente do defeito de acento já aberto (Issue #1, que é sobre
composição por tecla morta no `TextInput`), testei a **normalização Unicode**: o mesmo
"á" pode ser representado como 1 code point precomposto (NFC) ou como "a" + acento
combinante separado (NFD) — visualmente idênticos, bytes UTF-8 diferentes (`c3a1` vs
`61cc81`). Não consegui reproduzir na tela (`adb shell input text` quebra com acento
neste ambiente Windows — limitação da ferramenta, não do app), mas a leitura do código
foi conclusiva: `deriveKey()` (`kdf.ts`) não chamava `.normalize()` em lugar nenhum
antes de repassar a senha pro Argon2id, que é uma função determinística sobre bytes
exatos. Ou seja, criar o cofre com uma forma e digitar a "mesma" senha via um
teclado/SO que produz a outra forma trancaria o usuário fora do próprio cofre — **sem
nenhum aviso visual**, ao contrário do bug de tecla morta (que pelo menos mostra
`~a` errado na tela). Mais perigoso que o já registrado, então.
**Corrigido** em `deriveKey()`: normaliza pra NFC antes de derivar (recomendação
W3C/OWASP), cobrindo criação e desbloqueio de uma vez só, já que os dois passam pela
mesma função. Coberto por teste unitário (`kdf.test.ts`) comparando as duas formas.
Não fecha a Issue #1 (o bug de tecla morta na digitação continua existindo e sem
correção) — são causas raiz diferentes, esta é só uma parte do mesmo problema maior
de "texto acentuado em campo de senha".

**2026-09-30 — tentativa de correção do bug de tecla morta em si (Issue #1), ainda
sem confirmação manual.** Pesquisei a causa raiz do bug original (`~` + `a` vira `~a`
em vez de `ã` nos campos de senha): é um problema **conhecido do próprio React Native
com New Architecture (Fabric)** — o projeto está com `newArchEnabled=true`. Quando o
`TextInput` é controlado (prop `value` + `onChangeText`), o React devolve o texto pro
campo nativo a cada tecla digitada, e esse round-trip pode interromper a composição de
tecla morta do Android no meio (issue upstream equivalente:
[react-native#56463](https://github.com/react/react-native/issues/56463), mesmo
sintoma de "estado de composição destruído no meio da digitação"). Não é bug do nosso
código, é limitação de upstream.
**Correção candidata aplicada:** tirei a prop `value` dos 3 campos de senha
(`CreateVaultScreen.tsx` e `UnlockScreen.tsx`), deixando só `onChangeText` — campo
"não controlado", que evita o round-trip. Verifiquei tudo que dá pra verificar sem
teclado físico com tecla morta: lint limpo, 75 testes passando, e na tela — checagem
de "senhas não conferem" ainda funciona, criar/desbloquear com senha ASCII comum ainda
funciona de ponta a ponta, toggle de mostrar/ocultar senha ainda funciona
corretamente. **O que eu não consigo verificar:** se isso corrige o sintoma real do
acento, porque `adb shell input text` não passa pelo IME (injeta o texto pronto, não
simula tecla morta de verdade) — só reproduz digitando no teclado físico/emulador de
verdade. **Precisa da sua confirmação manual** antes de considerar a Issue #1
resolvida. Se não resolver, a causa é mais profunda que isso (ex.: algo mais específico
do build/versão do Fabric) e provavelmente não é algo que dá pra corrigir só no
código do app.

**Resultado (confirmado pelo QA no teclado real): não resolveu.** O bug de tecla morta
continua. Isso descarta a hipótese de que o round-trip do React de volta pro campo
nativo era a causa raiz — mesmo sem a prop `value`, o defeito persiste, então o
problema está em algo mais fundo da implementação nativa do `TextInput` no Fabric, não
em como o componente estava escrito aqui. **Revertido** (voltou ao padrão controlado,
mais idiomático, já que a versão não-controlada não trouxe benefício nenhum). A Issue
#1 continua aberta, agora com uma causa mais restrita: é uma limitação de upstream do
React Native + Fabric que não dá pra corrigir só mudando o componente — as opções
restantes (não tentadas ainda) são desabilitar New Architecture inteira (mudança
grande, com implicações em todo o app) ou aceitar como limitação conhecida e mitigar
o risco restringindo caracteres acentuados na senha mestra (mesma lógica já usada
para bloquear emoji). Decisão de produto, levada ao QA/Tech Lead.

**Decisão (QA/Tech Lead, 2026-09-30): restringir acento na senha mestra.** Optou-se
por **não** tentar desabilitar New Architecture (mudança grande, com implicações em
todo o app, pra resolver um bug pontual sem garantia de que resolveria mesmo) e
**não** deixar como risco aceito sem mitigação (poderia trancar alguém fora do
próprio cofre). Implementado em `assertMasterPasswordPolicy()` (`VaultService.ts`),
mesmo padrão do bloqueio de emoji: `\p{Diacritic}` depois de normalizar a senha pra
NFD (pega tanto `ã` precomposto quanto `a`+til combinante — ver o mesmo raciocínio
Unicode do achado em `kdf.ts`/`deriveKey`, 2026-09-30). Coberto por teste unitário com
os dois casos (NFC/NFD) mais cedilha, e um caso negativo (senha com hífen/apóstrofo,
sem acento, não deve ser bloqueada). A Issue #1 (bug de tecla morta em si) continua
aberta — esta mitigação reduz o impacto (ninguém consegue mais criar uma senha que o
bug poderia corromper), mas não é a correção do bug em si.

**2026-09-30 — achado: o bloqueio de acento não fecha o risco por completo.** QA
testou de novo e conseguiu criar o cofre com "acento" mesmo depois do bloqueio.
Investigando: **não é falha do bloqueio** — testei o regex direto no Hermes (motor
real do device, não o V8 do Jest) com um "ã" escrito no código-fonte (não digitado via
`adb`, que não simula tecla morta), e `\p{Diacritic}` + NFD pega certinho, confirmando
que a lógica funciona. O que aconteceu: o QA confirmou visualmente (com "Mostrar
senha") que o campo mostrou **"~a" quebrado**, não "ã" composto — ou seja, a tecla
morta quebrada (Issue #1) não produz um acento de verdade, produz um til solto
(pontuação comum, `~` U+007E) seguido de "a". Meu bloqueio só pega diacrítico Unicode
de verdade; "~a" não tem nenhum, então passa pela política sem ser barrado — o
bloqueio está fazendo exatamente o que foi projetado pra fazer, só que o alvo real
(a composição quebrada) produz outra coisa.
**Risco residual, ainda em aberto:** se a composição quebrar sempre do mesmo jeito
neste ambiente, "~a" funciona como senha normal, sem risco de trancar ninguém (é
determinístico). O risco original (senha visualmente igual, bytes diferentes) volta
se a composição se comportar diferente em outro momento/dispositivo/versão do app —
ex.: quebra agora, mas compõe certo depois de uma correção de upstream do React
Native, ou num teclado físico diferente do emulador. Bloquear especificamente
"til/acento solto seguido de vogal" é um regex frágil (heurística, não uma
propriedade Unicode real) e teria falso positivo real (alguém que queira usar `~`
de propósito na senha). Decisão de escopo pra levar ao QA/Tech Lead: aceitar esse
risco residual menor (mitigação parcial já é bem melhor que nada) ou investir em
bloquear o padrão quebrado também.

**Decisão (QA/Tech Lead, 2026-09-30): aceitar o risco residual.** Não bloquear
til/acento solto — seria heurística frágil (não é propriedade Unicode oficial, só
"parece" com o artefato do bug) e geraria falso positivo pra quem quisesse usar esses
símbolos de propósito na senha. O risco que sobra é menor e mais raro que o original
(só aparece se a composição se comportar diferente entre dois momentos/dispositivos,
não no uso normal e consistente do mesmo aparelho). Sem mudança de código adicional —
fica documentado como limitação conhecida e aceita.

- **Teste de vazamento por autofill**: verificado se o Android oferece "salvar senha"
  (Google Password Manager, serviço de autofill ativo neste emulador) depois de criar
  o cofre, e se aparece sugestão de credencial salva ao focar o campo de senha na tela
  de desbloqueio depois. **Aprovado, sem vazamento** — nenhum prompt de salvar, nenhuma
  sugestão ao reabrir o campo. Único ponto de atenção: o `logcat` mostra o
  `AutofillManager` do Android registrando um objeto `AutofillValue` a cada tecla
  digitada nos campos de senha, mesmo com `importantForAutofill="no"` — mas são só
  referências opacas (hashcode do objeto Java, ex. `AutofillValue@7e0`), nunca o texto
  em si; parece ser telemetria interna de baixo nível da plataforma, não uma falha real
  do `importantForAutofill`. A única aparição da senha em texto puro no log inteiro foi
  a própria linha do `adbd` ecoando o comando `adb shell input text` que eu rodei —
  artefato do método de teste (um usuário real digitando pelo teclado não gera log
  nenhum assim), não vazamento do app.
- **Teste de senha muito longa**: criado e desbloqueado o cofre com senha de 300
  caracteres, ponta a ponta. **Aprovado, sem defeito** — sem truncamento (os 300
  caracteres chegaram inteiros no campo e no `createVault`/`unlockVault`), sem
  travamento, sem lentidão perceptível no Argon2id (o custo dele vem dos parâmetros de
  memória/iteração calibrados por device, não do tamanho da senha em si, então isso já
  era esperado). Nota de metodologia: as primeiras tentativas pareceram falhar (campo
  ficava vazio), mas era o próprio harness de teste — depois de `pm clear`+`am start`,
  o campo às vezes ainda não tinha foco de verdade no momento do `adb shell input
  text`, e digitar sem foco não dá erro, só não escreve nada. Resolvido conferindo
  `focused="true"` antes de digitar, mesma lição de "garantir primeiro plano" já
  registrada nos testes de corrida.

**2026-10-01 (refinamento formal da Sprint 2) — fechamento retroativo:** Sprint 2
(H2.1 a H2.6) concluída, taggeada (`sprint-2`) e com notas de release em
[`docs/releases/sprint-2.md`](../releases/sprint-2.md). Decisão de refinamento daquela
sprint (rotação da chave de recuperação) está registrada direto na história H2.2, linha
abaixo. **Sprint 3 liberada.**

**2026-10-01 (refinamento formal da Sprint 3) — 3 ambiguidades fechadas:**
- H3.1: campos obrigatórios fixados em título, usuário e senha (URL/notas/categoria
  opcionais); limites de tamanho por campo delegados ao Tech Lead, mesmo padrão usado
  pro teto do bloqueio no H1.2.
- H3.2: app morto antes dos 30s do clipboard — aceito como limitação documentada, sem
  foreground service (custo/complexidade não justifica pra essa janela de risco).
- H3.3: ida para background **não** tranca na hora — unificado num único timer de
  inatividade (default 3 min, já decidido na Sprint 0), contado em relógio de parede
  independente de foreground/background. Motivo do QA: trocar de app de propósito pra
  buscar uma informação e colar no cofre é uso legítimo, não deveria ser penalizado com
  trava imediata.
- **H3.1 a H3.5 sem nenhuma ambiguidade pendente. Desenvolvimento da Sprint 3 liberado.**

**2026-10-01 — H3.1 (CRUD de credenciais) implementado e verificado no emulador:**
Camadas `credentialsRepository.ts` (SQL cru contra a tabela `credenciais`, criada sob
demanda com `CREATE TABLE IF NOT EXISTS`) e `CredentialService.ts` (validação dos
campos obrigatórios/limites decididos no refinamento, geração de id via CSPRNG),
cobertas por 26 testes novos (9 + 17). `openVaultDatabase` passou a ligar
`PRAGMA secure_delete = ON` antes de devolver a conexão — ataca direto o critério
"editar não deixa versão antiga decifrável em disco" (sem a pragma, um `UPDATE`/
`DELETE` só marca o espaço antigo como livre, sem zerar; com ela, o SQLite sobrescreve
na hora). `VaultUnlockedPlaceholderScreen` removida, substituída por
`CredentialListScreen` (lista + ações herdadas do placeholder) e `CredentialFormScreen`
(criar/editar na mesma tela) — ver decisão de manter o switch manual de telas em vez de
`react-navigation`, nesta mesma data.

Verificado de ponta a ponta no emulador, com toque real (`adb input`) e inspeção via
`uiautomator dump`:
- Criar com campos vazios: recusado com a mensagem exata da validação ("título é
  obrigatório; usuário é obrigatório; senha é obrigatória").
- Criar com dados válidos: credencial aparece na lista imediatamente.
- Editar: título alterado, lista reflete a mudança **sem duplicar** a credencial
  (confirma que é `UPDATE`, não um segundo `INSERT`).
- Excluir: diálogo de confirmação (`ConfirmDialog`, primeiro componente em
  `ui/components/`) testado nos dois caminhos — "Cancelar" preserva a credencial,
  "Excluir" remove e a lista volta ao estado vazio.
- **Persistência real**: credencial criada, cofre trancado (`db.close()`) e destravado
  de novo com a senha mestra — a credencial continuou lá, prova de que está vindo do
  SQLCipher em disco, não de estado em memória da sessão anterior.
- Achado à parte (não do H3.1): o subtítulo da tela de criar cofre ainda dizia "chave
  de recuperação, que ainda não existe nesta sprint" — texto desatualizado desde que o
  H2.1 implementou a chave de recuperação, na Sprint 2. Corrigido.

**2026-10-01 — achado real durante a instalação do `expo-clipboard` (fora do H3.2):**
o patch de 3751 linhas do `react-native-libsodium` (Windows, ver Sprint 1) tinha quase
tudo lixo de artefato de build (`android/.cxx/`, `android/build/`) que vazou pra dentro
dele quando foi gerado, incluindo caminhos absolutos da própria máquina. `npm install`
disparou o `postinstall` e o `patch-package` falhou ao aplicar — localmente isso só
avisa e segue (sai com código 0 fora de CI), mas um clone novo do repositório ficaria
silenciosamente sem o fix, só quebrando depois, na hora de compilar o Android, com um
erro de CMake difícil de relacionar com a causa. Regerado com
`--include CMakeLists --exclude "(build|\.cxx)"`: sobrou só o hunk real, 19 linhas.
Testado aplicando do zero (CMakeLists.txt revertido pro estado limpo do pacote
publicado, depois `npx patch-package`) — aplica sem erro, mesmo resultado de antes.

**2026-10-01 — H3.2 (copiar com limpeza automática) implementado e verificado no
emulador:**
`ClipboardService.ts` (`copiarTexto`/`copiarComLimpezaAutomatica`, 5 testes com timers
falsos) e botões "Copiar" no formulário de credencial (só em modo editar), com o novo
componente `Toast` mostrando contagem regressiva. Marcar o conteúdo como sensível
(`ClipDescription.EXTRA_IS_SENSITIVE`, Android 13+) descopado por decisão do
refinamento — `expo-clipboard` não expõe essa flag, exigiria módulo nativo Kotlin
próprio pra mitigar só a prévia de um toast do sistema, não o controle de segurança
real.

Verificação manual no emulador, com método ajustado no meio do caminho:
- Tentei confirmar o conteúdo colando de volta num `TextInput` do próprio formulário
  (toque longo → "Paste", e também o chip de sugestão de clipboard do Gboard) — nos
  dois casos nada era inserido no campo, mesmo dentro da janela de 30s. Descartei a
  hipótese de ser a limpeza automática disparando cedo demais (cronometrado: `date
  +%s` antes/depois, sempre bem dentro de 30s) e testei digitar texto normal no mesmo
  campo logo em seguida — funcionou perfeitamente. Ou seja, **colar não insere texto em
  nenhum `TextInput` do app (testado no campo de URL, novo, e no campo de título, já
  existente desde o H3.1) — mas digitar funciona normalmente.** Mesma categoria da
  Issue #1 (sincronização de edição nativa de texto com o estado controlado do React
  Native sob Fabric), só que agora para colar em vez de compor acento — não é regressão
  de hoje, é uma limitação de plataforma pré-existente em qualquer campo do app.
  **Não bloqueia o H3.2**: o critério é copiar PARA a área de transferência do sistema
  (pra colar em outro app, ex. um formulário de login), não colar de volta dentro do
  nosso próprio formulário.
- Confirmação real, por outro caminho: o chip de sugestão de clipboard do teclado
  Gboard (que mostra uma prévia truncada do conteúdo copiado, ex. "SenhaSuperS...")
  apareceu imediatamente após tocar "Copiar" na senha — prova de que
  `Clipboard.setStringAsync` gravou de verdade na área de transferência do sistema
  operacional, não só na memória do app. Esperado o tempo real (cronometrado, 86s,
  bem acima dos 30s) e verifiquei de novo: o chip **sumiu** — confirma que a limpeza
  automática realmente zera o clipboard do sistema, não é só um efeito dentro do app.
- Limitação de colar registrada como achado para abrir issue no GitHub (mesmo padrão
  da Issue #1) — sem ferramenta `gh` disponível neste ambiente para criar agora.

**2026-10-01 — H3.3 (bloqueio automático por inatividade) implementado e verificado no
emulador, com tempo real (sem acelerar relógio):**
`AutoLockController.ts` com os dois gatilhos descritos na história (timer de primeiro
plano + checagem ao retomar o foreground via `AppState`), 9 testes com relógio e
`AppState` falsos cobrindo cada combinação. Ligado no `App.tsx`: um controller por
sessão destravada (criado quando qualquer tela passa a ter `db` em mãos, parado ao
voltar para uma tela sem `db`), captura de toque num único ponto no topo da árvore
(`onStartShouldSetResponderCapture`, sem interceptar nada). Timeout configurável pelo
usuário (tela de Configurações) e reinício por tecla isolada ficaram de fora do
escopo — ver decisões de refinamento, 2026-10-01, na própria história.

Verificação manual no emulador, cronometrada com `date +%s` em cada passo (nenhum
teste usou relógio acelerado — é tempo real de parede):
- **Tranca sozinho sem nenhuma interação**: desbloqueou o cofre e não tocou em nada;
  conferido ~3min14s depois, já estava de volta na tela "Desbloquear cofre".
- **Interação reinicia o timer**: desbloqueou de novo, tocou na tela aos ~2min28s
  (dentro da janela), conferiu ainda destravado aos ~4min21s (bem depois do marco
  original de 3 minutos — prova que o toque reiniciou a contagem), e confirmou que
  trancou de novo ~3min52s depois **daquele toque**, não do desbloqueio original.
- **Retomada de segundo plano**: desbloqueou, foi para a home do Android
  (`KEYCODE_HOME`), esperou ~3min45s em background e trouxe o app de volta ao
  primeiro plano (`am start`) — já estava trancado ao reabrir, confirmando que o
  mecanismo de retomada (ou o próprio timer, que neste emulador continuou rodando em
  segundo plano) trancou o cofre mesmo fora de foco.

**2026-10-01 — H3.4 (bloqueio de screenshot e app switcher) implementado e verificado
no emulador:**
`usePreventScreenCapture()` (já usada desde o H2.1 só na tela de chave de recuperação)
movida para `App.tsx`, ligada uma vez para a sessão inteira do app — toda tela lida
com algum dado sensível, não fazia sentido decidir tela a tela. Pela própria
documentação da lib, no Android o `FLAG_SECURE` resolve os dois critérios do H3.4
numa tacada só (bloqueia screenshot **e** faz o app switcher mostrar miniatura em
branco), sem nenhum código adicional para o segundo.

Verificado no emulador:
- `adb shell screencap` na tela de criar cofre (que nunca teve essa proteção antes,
  só a de recuperação) devolveu uma imagem **totalmente preta** — confirmado via
  `uiautomator dump` que o conteúdo real (campos de criar cofre) continuava lá por
  trás, só a captura é que é bloqueada.
- App switcher (`KEYCODE_APP_SWITCH`): o card do SafeVault aparece com miniatura
  **totalmente preta**, ao lado de outros cards normais do sistema (que mostram
  conteúdo de verdade) — confirma que o bloqueio é específico do app, não um efeito
  do emulador inteiro.

**2026-10-01 — H3.5 (desbloqueio por biometria) implementado e verificado no emulador,
com digital virtual real (não só teste unitário):**
`BiometricService.ts` (13 testes) + tela de Configurações (primeira do app) +
integração no `App.tsx`/`UnlockScreen`/`CredentialListScreen`. Antes de testar, foi
preciso preparar o próprio emulador (nunca tinha biometria configurada): PIN definido
via `adb shell locksettings set-pin 1234` (bem mais simples que navegar o teclado
seguro do sistema, que não expõe os dígitos para automação — só aceitou texto comum
via `adb shell input text`, nunca toque em coordenada) e uma digital virtual cadastrada
via fluxo real de "Configurações → Segurança → Adicionar impressão digital",
confirmando cada toque com `adb emu finger touch 1`.

Verificado no emulador, de ponta a ponta:
- **Ativar**: formulário de Configurações pediu a senha mestra, e o `BiometricPrompt`
  real do sistema apareceu com a mensagem customizada do app
  ("Confirme sua digital ou rosto...") — confirmado com `adb emu finger touch 1`.
- **Desbloquear**: tela de desbloqueio mostrou "Desbloquear com biometria"; tocar nele
  abriu o `BiometricPrompt` de novo (mensagem "Desbloqueie o SafeVault"), e confirmar a
  digital abriu o cofre de verdade.
- **Backup rápido/Importar somem numa sessão biométrica**: confirmado — depois do
  desbloqueio biométrico, a lista mostrou só "Exportar | Config. | Trancar" (sem
  "Backup rápido"/"Importar"), com o aviso explicativo na tela.
- **Primeira abertura após reiniciar o processo exige senha mestra**: `adb shell am
  force-stop` (mata o processo de verdade) seguido de reabrir o app — tela de
  desbloqueio apareceu **sem** o botão de biometria, mesmo com ela ativa. Depois de
  desbloquear uma vez por senha, trancar e reabrir (sem matar o processo) trouxe o
  botão de volta — confirma que o gatilho é o reinício do **processo**, não do app em
  si.
- **Desativar**: toggle desligou sem pedir nenhuma confirmação biométrica extra
  (reversível, não-destrutivo, como decidido) — botão de biometria sumiu da tela de
  desbloqueio na sessão seguinte.
- PIN e digital virtual removidos do emulador ao final (`adb shell locksettings
  clear`), restaurando o estado sem bloqueio de tela pra não atrapalhar sessões de
  teste futuras que não esperam um PIN no caminho.

**H3.1, H3.2, H3.3, H3.4 e H3.5 — Sprint 3 completa**, todas as 5 histórias
implementadas, testadas (170 testes automatizados) e verificadas manualmente no
emulador com interação real, não só teste unitário.

**2026-10-02 (refinamento formal da Sprint 4) — 2 ambiguidades fechadas:**
- H4.1: faixa de tamanho do gerador fixada em 8-64 caracteres, padrão 16.
- H4.2: fica a heurística simples que já existia (`calcularForcaSenha`, usada desde o
  H2.3 na senha de exportação) em vez de adicionar zxcvbn — zero dependência nova.
  Extraída de `BackupService.ts` para `PasswordStrength.ts` (módulo compartilhado),
  já que agora serve duas histórias de sprints diferentes.
- **H4.1 e H4.2 sem ambiguidade pendente. Desenvolvimento liberado.**

**2026-10-02 — H4.1 (gerador de senhas) e H4.2 (indicador de força) implementados e
verificados no emulador:**
`randomInt` novo em `csprng.ts` (inteiro uniforme via rejection sampling — `byte % N`
sozinho enviesaria qual caractere sai mais, o que importa de verdade aqui, diferente
de um nonce). `PasswordGenerator.ts` garante 1 caractere de cada classe marcada
*explicitamente* (sorteia 1 de cada primeiro, completa o resto, só então embaralha com
Fisher-Yates) — não é só estatisticamente provável, é um critério de aceite testado.
`GeneratorScreen.tsx` é uma sobreposição de tela cheia dentro do próprio
`CredentialFormScreen` (mesmo raciocínio do `ConfirmDialog`/`Toast`: "usar esta senha"
só devolve um valor pro campo já aberto, não precisa de uma tela em `App.tsx`).
Controle de tamanho é um stepper +/- em vez de slider — sem lib de slider no projeto,
e um stepper já resolve sem dependência nova.

Verificado no emulador: tamanho do stepper (16→19, senha regerada a cada toque),
geração garantindo as 4 classes mesmo rodando várias vezes, desligar as 4 classes
mostra a mensagem de erro e desabilita "Usar esta senha" sem travar o app, religar uma
classe recupera e gera só com ela (confirmado: senha só minúsculas → força "Fraca"),
"Usar esta senha" preenche o campo de volta no formulário com o indicador de força
(H4.2) junto — credencial salva e aparece na lista normalmente.

**2026-10-02 — H4.3 (alerta de senha repetida) e H4.4 (busca e filtro) implementados e
verificados no emulador:**
`PasswordReuseDetector.ts` — função pura sobre a lista já decifrada
(`listarCredenciais`), nunca um índice em disco; o resultado nunca carrega a senha em
si, só título e contagem (testado explicitamente: `JSON.stringify` do resultado não
contém a senha usada no teste). Busca (H4.4) e filtro de categoria também em memória,
sem persistir nada — chips de categoria calculados dinamicamente a partir das próprias
credenciais, sem lib de picker.

Verificado no emulador: duas credenciais criadas com a mesma senha mostraram o aviso
"⚠ 2 credenciais com a mesma senha: Banco Inter, Email Pessoal" (título e quantidade,
nunca a senha); chips de categoria "Banco"/"Email" apareceram automaticamente; busca
por `"joao2"` filtrou pra só a credencial daquele usuário; filtro por categoria
"Banco" filtrou pra só aquela credencial.

**Achado real durante o teste manual, corrigido:** os chips de categoria tinham a área
de toque esticada verticalmente até sobrepor a lista de credenciais abaixo deles (altura
de ~650px em vez de ~78px) — `contentContainerStyle` da `ScrollView` horizontal sem
`alignItems` explícito, então o padrão (`stretch`) esticava cada `Pressable` filho no
eixo cruzado. Resultado prático: tocar num chip não filtrava nada, porque o toque
provavelmente ia pro item da lista por baixo, não pro chip. Corrigido com
`alignItems: 'center'`; testado de novo depois do fix e o filtro passou a funcionar.

**H4.1, H4.2, H4.3 e H4.4 — Sprint 4 completa**, todas as 4 histórias implementadas,
testadas (193 testes automatizados) e verificadas manualmente no emulador.

**2026-10-05 (refinamento formal da Sprint 5) — 3 decisões:**
- H5.1: **adiado, com risco documentado.** O QA só tem iPhone — e o SafeVault é
  Android-only (build iOS exige Mac, impossível nesta máquina Windows). Sem aparelho
  Android físico, não dá pra medir o Argon2id em hardware de celular real. O risco
  (parâmetros calibrados só em emulador, que roda na CPU do PC) entra como item
  explícito nos critérios de release do H5.5.
- H5.3: Claude monta a base da automação (Python + Appium + pytest + Allure, Page
  Objects, `conftest`) e 2-3 testes de exemplo comentados; o QA escreve o restante da
  suíte com orientação — é aqui que o QA aprende Appium na prática.
- H5.5: Issue #1 (tecla morta) e o achado de colar em `TextInput` **não bloqueiam** a
  release — limitações de upstream do React Native/Fabric, já mitigadas, entram como
  limitações conhecidas nas notas de release.

**2026-10-05 (H5.2 — bateria de segurança executada no emulador) — 5/5 itens passaram:**
1. **Logcat:** fluxo completo (criar cofre, cadastrar, editar, copiar, trancar,
   destravar) com marcadores únicos na senha mestra e nas credenciais. Todas as
   ocorrências dos marcadores vieram do processo `adbd` ecoando o próprio
   `input text` do teste — nenhuma do processo do app (485 linhas do app
   inspecionadas, zero palavras sensíveis).
2. **Diretório de dados do app:** `grep` dos marcadores em todos os arquivos via
   `run-as` — zero ocorrências. Controle positivo (uma string sabidamente presente)
   encontrado, provando que a busca funcionava.
3. **Nonce:** teste de invariante automatizado — 10.000 cifragens com a mesma chave,
   nenhum nonce repetido ([cipher.test.ts](../../src/crypto/cipher.test.ts)).
4. **Cofre em repouso:** `vault.db` não começa com "SQLite format 3"; entropia
   7,9861 bits/byte (controle de bytes aleatórios do mesmo tamanho: 7,9855); 22
   trechos imprimíveis de 6+ caracteres contra 12–25 em 8 arquivos aleatórios de
   controle — estatisticamente indistinguível de ruído.
5. **Matar o app no meio da gravação** (`am force-stop` com atraso medido no próprio
   aparelho): 6 rodadas no salvar (0 s a 0,6 s), 2 no editar, 2 no excluir. Em
   todas, o cofre reabriu com a senha mestra e o dado estava **inteiro ou ausente,
   nunca pela metade** (ex.: no editar, 0 s manteve o título antigo e 0,05 s gravou o
   novo). Nenhum arquivo `-journal`/`-wal` ficou para trás. Limitação do método: a
   gravação leva menos de 50 ms, então pelo adb não dá para cair exatamente dentro do
   commit — nesse trecho a garantia é a atomicidade de transação do SQLite, e o que
   foi observado é consistente com ela.

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
- **Device fraco (decisão do refinamento, 2026-09-24):** o app **nunca recusa** criar o
  cofre por o Argon2id ser lento no aparelho — usa o piso mínimo (19 MiB / t=2 / p=1) e
  segue mesmo que a calibração leve mais que o alvo de conforto. Sem piso alternativo
  "mais fraco ainda": abaixo de 19 MiB/t=2 não entra no app.
- **Senha mestra mínima (decisão do refinamento, 2026-09-24):** 8 caracteres, com ao
  menos 1 maiúscula, 1 minúscula e 1 número. Abaixo disso, recusada com mensagem clara
  listando a regra que faltou. **Atualizado no teste exploratório (2026-09-29/30):**
  também não pode conter emoji nem letra acentuada — ver seção "teste exploratório do
  QA" acima para o porquê de cada uma.
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
- **Política de tentativas (decisão do refinamento, fechada em 2026-09-24 — teto
  definido pelo Tech Lead a pedido do QA):** após 5 tentativas erradas consecutivas, a
  **UI** de desbloqueio bloqueia por um tempo que dobra a cada novo bloco de 5 erradas —
  **30 s → 1 min → 2 min → 4 min → 8 min → 15 min, e para de dobrar em 15 min** (fica
  fixo nesse valor para qualquer bloco seguinte). Contador de erros e o horário até
  quando o bloqueio vale ficam persistidos localmente (sobrevivem a fechar/reabrir o
  app) e zeram só quando a senha correta é digitada. **Nunca** existe bloqueio
  permanente nem apagamento automático do cofre por tentativas erradas — quem esqueceu
  mesmo a senha usa a chave de recuperação (H2.2), não um "reset por excesso de erro".
- **Aviso de tentativa (decisão do refinamento, 2026-09-24): aviso local, sem rede.**
  Na próxima abertura bem-sucedida após tentativa(s) errada(s), o app mostra
  "houve N tentativas erradas desde a última vez que você entrou". Sem e-mail, sem
  servidor — mantém o produto 100% offline-first. E-mail de alerta fica registrado como
  ideia de backlog futuro (pós-Sprint 5), não entra nas 5 sprints atuais.
- **Mensagem de bloqueio (decisão do refinamento, 2026-09-24):** enquanto bloqueado, a
  tela mostra contagem regressiva exata ("tente novamente em 4:32"), não mensagem
  genérica — a informação só é vista por quem já está com o celular físico na mão, então
  não abre canal pra ataque remoto.
- Tempo de desbloqueio alvo ≤ 1,5 s no emulador de referência.

> **Nota de segurança (por que o bloqueio de UI não é a proteção principal):** o
> bloqueio de tentativas atrapalha quem está com o celular **destravado** na mão
> tentando adivinhar sua senha na tela. Mas quem rouba o **arquivo** do cofre (backup,
> celular perdido com acesso ao armazenamento) não passa pela sua UI — ataca o arquivo
> offline, sem limite de tentativas, no ritmo que quiser. Quem protege contra isso é o
> custo do Argon2id ([arquitetura.md](arquitetura.md) seção 4), não o contador. O
> contador é uma segunda camada útil, mas não é onde a segurança real mora.
>
> **Por que o teto ficou em 15 minutos, e não mais alto nem "sem teto":** como o
> contador não é a defesa principal (é o Argon2id), não faz sentido pagar o preço de
> usabilidade de um teto agressivo (1h, 1 dia) só para ganhar uma fração de
> segurança a mais — o ganho marginal é pequeno e o risco de você mesmo ficar de fora do
> seu cofre por errar a senha algumas vezes (dedo grande, teclado errado, cansaço) é
> real e caro num cofre de uso diário. Por outro lado, "sem teto" (dobrar para sempre)
> deixaria um único lapso de memória virar horas de espera, o que empurraria você a usar
> a chave de recuperação toda vez — desgastando exatamente o fluxo que devia ser raro.
> 15 minutos é alto o suficiente para tornar inviável adivinhar por tentativa na UI
> (no máximo ~4 blocos de 5 tentativas por hora, uma vez no teto) e baixo o suficiente
> para você tentar de novo dentro da mesma sessão de uso. Se, na prática de uso real
> (Sprint 5), 15 min incomodar demais ou de menos, é só um número — ajustamos com dado
> real de uso, não precisa virar debate de arquitetura.

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
- **Escopo do lint (decisão do refinamento, 2026-09-24):** falha o build se
  `Math.random(` aparecer em `src/` (código do app). **Não** se aplica ao código de
  teste (`cypress`/detox/pytest/factories) — massa de teste não protege dado real, então
  ali é estilo, não segurança. Pode ser revisitado depois se fizer sentido.
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

**Implementado e verificado no emulador (2026-09-30), todos os critérios acima:**
tela aparece logo após criar o cofre, chave formatada em blocos de 4 hex (256 bits),
botão "Continuar" desabilitado até marcar "guardei em local seguro". Bloqueio de
screenshot confirmado de um jeito direto: um `adb shell screencap` na tela voltou
**completamente preta** — prova real do `FLAG_SECURE`/`usePreventScreenCapture()`
funcionando no device, não só confiança na documentação da lib. Cenário do "erro"
testado matando o processo (`am force-stop`) enquanto a chave estava na tela, sem
confirmar: no próximo desbloqueio, a tela de recuperação reapareceu — com uma chave
**diferente** da anterior (capturada e comparada por acessibilidade, já que a
captura de tela não funciona nesta tela de propósito) — confirmando que a chave
antiga nunca chegou a ser persistida em lugar nenhum. Um segundo desbloqueio normal
(depois de confirmar) não mostra a tela de novo, como esperado.

### H2.2 🔴 Entrar com a chave de recuperação
**Como** dono do cofre, **quero** usar a chave de recuperação quando esqueci a senha,
**para** recuperar o acesso e definir uma senha nova.
Critérios:
- Fluxo "esqueci a senha" → campo para a chave de recuperação.
- Chave válida → desembrulha a DEK → **obriga** a definir nova senha mestra → reembrulha.
- Chave inválida → mensagem genérica.
- **Rotação da chave de recuperação (decisão do refinamento, 2026-09-30):** a cada uso
  bem-sucedido, gera uma chave de recuperação **nova** e invalida a antiga
  imediatamente — mesma lógica de token de reset de senha em sistemas sérios: fecha o
  risco de uma cópia antiga vazada (foto, papel esquecido) continuar sendo porta de
  entrada permanente pro cofre. Custo aceito: toda recuperação bem-sucedida exige
  guardar uma chave nova de novo, passando pela mesma tela de exibição única do H2.1.

**Implementado e verificado no emulador (2026-09-30), ciclo completo:** criar cofre →
confirmar chave de recuperação #1 → trancar → "Esqueci minha senha" → colar a chave
**sem os traços** (formato alternativo, pra testar que o parser aceita os dois jeitos)
→ definir senha nova → sucesso, cai automaticamente na tela de exibição única de novo
com uma chave **#2, diferente da #1** (rotação funcionando sozinha, sem lógica extra
de roteamento) → confirmar → trancar → desbloquear com a **senha nova** → funciona.
Testado também o caminho de erro: chave errada dá "Chave de recuperação inválida."
(mensagem genérica, mesma pros dois casos — formato errado ou chave certa mas
incorreta) e o link "Voltar para o desbloqueio normal" retorna pra tela de senha sem
efeito colateral.

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

**Implementado e verificado no emulador (2026-09-30):** fluxo completo de ponta a
ponta, incluindo o seletor de pasta real do Android (`com.google.android.documentsui`,
não um dublê) — precisou criar uma subpasta dentro de "Download" porque o Android
11+ recusa conceder permissão de diretório direto na raiz de pastas conhecidas
("Can't use this folder / To protect your privacy, choose another folder"), depois
conceder o acesso explicitamente ("Allow SafeVault to access folder?"). Arquivo
`cofre-2026-09-30.safevault` confirmado no disco (nome com a data certa) e o
conteúdo inspecionado diretamente: só `formatVersion`, `kdfSalt`, `kdfParams`,
`nonce`, `authTag` e um `ciphertext` grande e opaco — nenhum vestígio em claro do
cabeçalho do cofre nem do `vault.db` (que vai inteiro, em base64, dentro do blob
cifrado). Indicador de força também verificado ao vivo na tela ("Senha forte" para
uma senha de 18 caracteres com as 4 classes).
**Nota sobre "escrita atômica":** implementado como uma única chamada de escrita
(nunca incremental) tanto para o conteúdo final quanto para o arquivo no SAF — não
é literalmente "arquivo temporário + rename" (o SAF, por ser baseado em content
provider, não opera sobre caminhos de arquivo reais e não tem uma operação de rename
atômica exposta), mas satisfaz o espírito do critério: o conteúdo inteiro é montado
em memória antes de qualquer escrita começar, então uma interrupção no meio nunca
deixa um arquivo parcial que pareça válido — o pior caso é um arquivo vazio
(obviamente inválido) ou nenhum arquivo. Além disso, exportar nunca muda o estado do
cofre em si (é só leitura), então uma falha é sempre seguro de tentar de novo.

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

**Implementado e verificado no emulador (2026-09-30), os dois modos de ponta a
ponta:** "aparelho novo" (sem cofre — criar cofre A com senha `CofreOriginal1`,
exportar, `pm clear` simulando aparelho novo, importar pelo link em "Criar cofre",
cair direto na tela de desbloqueio, senha original de A abre normalmente) e
"substituir" (cofre A ativo, "Importar / restaurar cofre" na tela principal, aviso
de confirmação + checkbox obrigatório antes do botão habilitar, importar o mesmo
arquivo por cima — backup de segurança automático confirmado no disco
(`run-as ls files`, arquivo `backup-antes-de-importar-<timestamp>.safevault` do
tamanho esperado), substituição concluída, senha original volta a abrir).

**Achado técnico real durante o teste, documentado em `BackupService.ts`:** o
`expo-file-system` recusa **criar** qualquer arquivo novo fora de
`documentDirectory`/`cacheDirectory` — tanto `writeAsStringAsync` quanto `moveAsync`
para um destino que ainda não existe dentro de `databases/` (a pasta do SQLite, fora
do radar do Expo) falham com `IOException: Location ... isn't writable`, mesmo a
pasta em si já existindo. Escrever **em cima** de um arquivo que já existe, porém,
funciona — e abrir uma conexão do `op-sqlite` (mesmo sem nenhuma operação) já
materializa o arquivo no disco, ainda que vazio. Isso inviabilizou o desenho
original de "escrever num temporário e trocar por rename" (não tem como criar esse
temporário fora de `databases/`); a implementação final escreve direto em cima do
arquivo existente, com uma garantia de atomicidade menor que o desenho original —
mitigado pela salvaguarda real do H2.4, que sempre foi o backup automático cifrado,
não a troca de arquivo em si.

### H2.5 🟠 Backup manual rápido
**Como** dono do cofre, **quero** um botão de backup, **para** gerar uma cópia cifrada
sem repensar as opções toda vez.
Critérios: reusa H2.3; um toque; confirma onde salvou.

**Implementado e verificado no emulador (2026-09-30):** botão "Backup rápido" na
tela principal vai direto pro seletor de pasta do sistema (sem nenhum formulário de
senha no meio — reusa a senha mestra da sessão, mesmo padrão do backup de segurança
automático do H2.4), e mostra "Backup salvo como cofre-2026-09-30.safevault." depois
de confirmado. Arquivo verificado no disco, mesmo formato/tamanho dos outros exports.

### H2.6 🔴 Desativar backup automático do sistema
**Como** dono do cofre, **quero** que o Android não suba meu cofre para a nuvem sem a
minha cifra, **para** não vazar por um canal que eu não controlo.
Critérios: `allowBackup=false`; `dataExtractionRules` excluindo os arquivos do cofre;
teste que confirma o cofre fora do conjunto de auto-backup.

**Implementado e verificado no emulador (2026-09-30).** `allowBackup: false` direto em
`app.json` (`expo.android.allowBackup`, suporte nativo do Expo). `dataExtractionRules`
via Config Plugin próprio (`plugins/withDataExtractionRules.js`, roda no `expo
prebuild`) — excluindo `domain="database"` (cobre `vault.db` sem depender do nome
exato do arquivo).

**Achado real do refinamento, corrigido antes de seguir:** o `expo-secure-store` já
tenta configurar suas próprias regras de extração por padrão (protegendo o que ele
guarda — o cabeçalho do cofre, com os embrulhos da DEK). Rodar meu plugin por cima
sem cuidado *sobrescreveria* essas regras silenciosamente (`withDangerousMod` apagando
o arquivo dele) — o aviso "Expo-secure-store tried to apply Android Auto Backup
rules, but other backup rules are already present" no primeiro `prebuild` foi o sinal.
Inspecionei o XML que o `expo-secure-store` geraria
(`node_modules/expo-secure-store/android/.../secure_store_data_extraction_rules.xml`)
e **mesclei** as regras dele no meu arquivo em vez de simplesmente vencer a
corrida — `<exclude domain="sharedpref" path="SecureStore"/>`, a mesma exclusão que
ele já fazia por padrão (o secure-store nunca seria restaurável de verdade entre
aparelhos mesmo, a chave fica presa ao Android Keystore daquele device). Desabilitei
a auto-configuração dele (`configureAndroidBackup: false`) pra deixar claro que este
projeto assumiu essa responsabilidade manualmente, de forma completa.

**Teste real, não só inspeção de config:** com o emulador, habilitei o Backup Manager
(`adb shell bmgr enable true`), selecionei o transporte local de teste
(`adb shell bmgr transport com.android.localtransport/.LocalTransport`) e forcei um
backup do app depois de criar um cofre de verdade (`adb shell bmgr backupnow
com.joaozanca.safevault`) — resultado: **`Backup is not allowed`**. Mais forte ainda:
`adb shell dumpsys backup` lista todos os apps que participam do sistema de backup —
dezenas de apps de terceiros aparecem (Chrome, Gmail, YouTube, Maps...), confirmando
que a lista é real e discrimina corretamente — e `com.joaozanca.safevault` **não
aparece em lugar nenhum** dela. Confirmação vinda do próprio Android Backup Manager
em tempo real, não de uma leitura estática do manifest.

**Limitação de escopo assumida conscientemente:** `android:fullBackupContent`
(formato legado, Android ≤ 30/API < 31) não foi replicado — só o `dataExtractionRules`
moderno (Android 12+/API 31+, o que o critério pede). Como `allowBackup=false` já
bloqueia backup por completo em **qualquer** versão do Android (é a proteção
principal; `dataExtractionRules` é defesa em profundidade só relevante se
`allowBackup` um dia voltar a ser `true`), o impacto prático dessa lacuna é mínimo.

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
- **Campos obrigatórios (decisão do refinamento, 2026-10-01): título, usuário e senha.**
  URL, notas e categoria ficam opcionais.
- **Limites de tamanho (decisão de Tech Lead, 2026-10-01 — delegado pelo QA, mesmo
  padrão do teto de bloqueio do H1.2):** título até 100 caracteres, usuário até 254,
  senha até 256 (sem limite baixo artificial — é o campo mais sensível do formulário),
  URL até 2048, notas até 2000, categoria (texto livre) até 50.

### H3.2 🔴 Copiar com limpeza automática em 30 s
**Como** usuário, **quero** que a senha copiada seja apagada da área de transferência em
30 segundos, **para** não deixar rastro.
Critérios:
- Ao copiar: marca o conteúdo como sensível (Android 13+), mostra aviso com contagem.
- Após 30 s (± tolerância a definir), limpa **se** o conteúdo ainda for o nosso.
- Se o usuário copiou outra coisa nesse meio-tempo, não apaga o dele.
- **App morto antes dos 30 s (decisão do refinamento, 2026-10-01): aceitar como
  limitação documentada, sem foreground service.** A senha pode ficar na área de
  transferência do Android além dos 30s se o app for encerrado à força nesse meio-tempo.
  Mesmo critério já usado para o artefato de tecla morta na Sprint 1: mitigação extra
  (serviço em background, com notificação persistente e mais um componente nativo pra
  manter) custaria mais do que o risco residual justifica.

### H3.3 🔴 Bloqueio automático por inatividade
**Como** usuário, **quero** que o cofre tranque sozinho após inatividade, **para** que
alguém com meu celular na mão não veja meus dados.
Critérios:
- **Timeout (decisão do refinamento, 2026-09-24): default de 3 minutos**, fixo no
  código por enquanto (decisão do refinamento, 2026-10-01: tela de Configurações pra
  deixar configurável fica pendente — escopo novo de verdade, maior que o resto do
  H3.3, que é só o timer — mesmo critério já usado pra adiar busca/filtro da lista e o
  gerador de senhas).
- Ao trancar: KEK e DEK zeradas da memória, navega para a tela de desbloqueio.
- **App para background (decisão do refinamento, 2026-10-01): não tranca na hora —
  entra no mesmo timer de inatividade único (default 3 min), em vez de um timer
  separado para background.** Motivo levantado pelo QA: é comum trocar de app de
  propósito para buscar uma informação (ex. copiar um código de outro app) e voltar
  pra colar no cofre — travar na hora penalizaria esse uso legítimo. Elapsed time é
  contado em relógio de parede (`Date.now()`) desde a última interação, não um
  contador que só avança em foreground — então o tempo gasto em outro app conta
  normalmente dentro dos 3 minutos. Ao retomar o foreground, o app checa se o timeout
  já expirou e tranca então, se for o caso.
- **Timer reinicia a cada interação dentro do app (toque, digitação, navegação)**
  (decisão do refinamento, 2026-10-01): na prática, só toque e navegação —
  capturados num único ponto no topo da árvore de componentes. Digitação sem tocar de
  novo (ex. escrever uma nota longa sem pausa) não reinicia por tecla: o teclado do
  Android é uma sobreposição do sistema, fora da árvore de views do app, então
  instrumentar isso exigiria passar um callback por ~15 campos de texto em 7 telas
  diferentes, só pra cobrir o caso raro de digitar sem parar por mais de 3 minutos
  num campo só. Risco aceito, sem mitigação adicional.

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
- **Primeira abertura após reiniciar o aparelho → exige senha mestra, não biometria**
  (decisão do refinamento, 2026-10-01): não existe API simples no Expo/React Native
  pra detectar "o aparelho reiniciou" sem módulo nativo próprio. Proxy aceito: flag em
  memória, válida só enquanto o **processo** do app está vivo — reseta em qualquer
  reinício do processo (reiniciar o aparelho reinicia o processo; fechar o app à força
  pelo multitarefas também). Mais conservador que o critério literal: pede senha em
  mais situações, nunca em menos.
- Trocar a senha mestra ou alterar digitais do aparelho → invalida a biometria, cai
  para senha. Gratuito via `expo-secure-store`: o próprio Android invalida a chave do
  Keystore quando o conjunto de biometria cadastrada muda (`getItemAsync` devolve
  `null`), sem nenhum código nosso pra detectar isso.
- DEK biométrica guardada no Keystore, liberada só pelo BiometricPrompt. Também
  gratuito: `expo-secure-store` com `requireAuthentication: true` já é exatamente
  isso (`setUserAuthenticationRequired` por baixo) — zero biblioteca nativa nova.
- **Consequência aceita (decisão do refinamento, 2026-10-01):** desbloqueio biométrico
  nunca tem a senha mestra em texto puro (esse é o ponto do recurso). "Backup rápido"
  (H2.5) e "Importar substituindo o cofre" (H2.4) reusam a senha mestra da sessão como
  atalho — ficam indisponíveis numa sessão biométrica, com aviso na tela. O "Exportar"
  normal continua funcionando (pede a própria senha de exportação).

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
- **Tamanho mín./máx. (decisão do refinamento, 2026-10-02): 8 a 64 caracteres, padrão
  16.**
- Nunca loga a senha gerada.

### H4.2 🟡 Indicador de força da senha
**Como** usuário, **quero** ver quão forte é uma senha, **para** decidir se troco.
Critérios: estimativa local, sem enviar nada para lugar nenhum. **Biblioteca (decisão
do refinamento, 2026-10-02): a heurística simples que já existia desde o H2.3
(`calcularForcaSenha` — comprimento + classes de caractere) em vez de uma biblioteca
consagrada tipo zxcvbn (proposta original) — zero dependência nova, código já testado
em produção no app. Menos preciso (não detecta padrão de teclado nem palavra de
dicionário), mas suficiente pra um indicador visual de referência, não uma validação
que bloqueia algo.**

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

> **Achado da Sprint 1 (2026-09-25):** no emulador de desenvolvimento (Pixel_10a,
> rodando na máquina de desenvolvimento), a calibração bateu no teto de segurança
> (`MAX_ITERATIONS = 6`) em ~81ms — bem abaixo do alvo de conforto de 700ms
> ([calibration.ts](../../src/crypto/calibration.ts)). Ou seja, o teto está deixando
> segurança na mesa em hardware capaz: dava pra pedir bem mais iterações (ou subir
> memória) sem incomodar o usuário. Revisar `MAX_ITERATIONS` (e considerar escalar
> `memoryKiB` também, não só `iterations`) com dado de device físico real, não só
> emulador — emulador roda na CPU do PC, não reflete um celular médio.

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
