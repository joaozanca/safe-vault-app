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
