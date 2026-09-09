# Análise de risco — áreas mais perigosas do SafeVault

Contexto: o app vai guardar senhas **reais**. "Risco" aqui = probabilidade × impacto,
onde impacto máximo é **vazar** ou **perder para sempre** os dados. Ordenado do mais
grave para o menos.

Para cada área: o que pode dar errado, por que é grave, e como a gente ataca o risco
(engenharia + teste). Teste **exploratório** dessas áreas é trabalho do QA — aqui só
mapeamos onde olhar.

---

## R1 🔴 Derivação de chave e tratamento da senha mestra

**O que pode dar errado**
- Parâmetros do Argon2id fracos (pouca memória/iteração) → ataque de força bruta viável.
- Senha mestra sobrando em memória depois do desbloqueio, ou logada.
- Salt reutilizado, previsível ou não persistido.
- Calibração no device escolhe parâmetros abaixo do piso "para não travar".
- Verificação de senha por hash guardado à parte (permite ataque offline mais barato que
  a decifragem real).

**Por que é grave**
Se a derivação é fraca, **toda a cifragem abaixo dela não vale nada** — o atacante
adivinha a senha e recebe a chave. É a fundação; erro aqui é invisível até o vazamento
acontecer.

**Como atacamos**
- Piso duro no código (19 MiB / t=2 / p=1), calibração só sobe a partir daí.
- Parâmetros e salt persistidos e versionados junto do cofre.
- Verificação = decifrar a DEK e conferir a auth tag, nada de hash paralelo.
- Teste: derivação determinística dado (salt, params); tempo dentro do alvo; `logcat`
  limpo; senha mestra não aparece em dump de memória após desbloqueio.

---

## R2 🔴 Fluxo da chave de recuperação

**O que pode dar errado**
- Chave exibida mais de uma vez (ou recuperável depois).
- Chave gravada em claro em algum lugar (cache de render, log, clipboard, screenshot).
- Geração com entropia baixa.
- Bug na verificação faz uma chave **errada** ser aceita — ou uma **certa** ser recusada
  (usuário perde o cofre achando que digitou errado).
- App fecha durante a exibição e o usuário nunca anotou → cofre sem rota de recuperação.

**Por que é grave**
É a **única** rede contra esquecer a senha mestra num cofre offline. Se ela falha
silenciosamente, o usuário só descobre no dia que precisa — tarde demais. Falso positivo
(aceitar chave errada) é igualmente ruim: cria falsa sensação de recuperação.

**Como atacamos**
- Exibição única, com `FLAG_SECURE`, confirmação ativa, e detecção de "exibição
  interrompida" → oferece regenerar.
- Chave nunca toca disco em claro nem clipboard.
- Teste: chave certa recupera; qualquer bit trocado é recusado; cofre intacto após
  tentativa falha; reabrir após interrompir a exibição não revela a chave de novo.

---

## R3 🔴 Correção da cifra e unicidade do nonce (AES-256-GCM)

**O que pode dar errado**
- Nonce repetido com a mesma chave (contador que reinicia, nonce fixo, cópia de registro
  sem re-sortear).
- Auth tag não verificada, ou erro de verificação tratado como "seguir mesmo assim".
- Associated data (versão, id) não incluído → registro de um contexto aceito noutro.
- Ordem trocada (ex.: guardar tag e ciphertext embaralhados no parse).

**Por que é grave**
Nonce repetido no GCM **quebra a confidencialidade** daquele par de mensagens e permite
**forjar** dados. Auth tag ignorada = atacante edita o cofre e o app confia.

**Como atacamos**
- Nonce sempre do CSPRNG, 96 bits, um por operação de escrita.
- Toda falha de auth tag = "cofre corrompido/adulterado", fluxo de erro explícito.
- Teste de invariante: varrer todos os registros e garantir zero nonces repetidos;
  adulterar 1 byte do arquivo e confirmar que a abertura falha.

---

## R4 🔴 Armazenamento de chaves no dispositivo (Keystore / secure-store) e biometria

**O que pode dar errado**
- DEK "crua" (não embrulhada) escrita no secure-store ou em SharedPreferences normal.
- Chave biométrica sem `setUserAuthenticationRequired` / sem invalidação ao mudar
  digitais.
- Biometria permitida como **única** proteção desde o primeiro boot.
- Perda da chave do Keystore ao restaurar o app noutro aparelho → cofre inacessível se
  for a única cópia.
- Erros do BiometricPrompt (cancelado, sem hardware, lockout) mal tratados → app
  travado.

**Por que é grave**
Se a DEK vaza do armazenamento, o cofre abre sem a senha. Se a chave some sem
alternativa, o cofre fecha para sempre. Biometria mal amarrada transfere a segurança do
cofre para o PIN de 4 dígitos do celular.

**Como atacamos**
- Só chaves **embrulhadas** no secure-store; DEK crua nunca persistida.
- Biometria é sempre cópia adicional; senha mestra exigida no primeiro desbloqueio pós
  reboot.
- Invalidação automática ao alterar biometria do aparelho.
- Teste: inspecionar o conteúdo do secure-store e confirmar que só há material
  embrulhado; simular troca de digital e confirmar fallback para senha.

---

## R5 🔴 Exportação / importação e formato de arquivo

**O que pode dar errado**
- Arquivo exportado sem cifra, ou com senha fraca aceita.
- Escrita não atômica → arquivo parcial que "parece" válido.
- Importação toca o cofre atual antes de validar o arquivo → corrompe o que já existia.
- Sem versão de formato → import de arquivo antigo interpretado errado.
- Segredo em claro em campo de metadado do arquivo.

**Por que é grave**
A exportação **tira o dado do sandbox do app** e coloca em Downloads/Drive/e-mail — o
ponto onde a proteção do SO deixa de valer. Um export ruim é um vazamento permanente com
cópias fora do seu controle.

**Como atacamos**
- Sem opção "exportar sem senha"; indicador de força obrigatório.
- Escrita atômica (temp + rename); validação da auth tag antes de qualquer merge.
- Header versionado; incompatível → recusa.
- Teste: abrir o arquivo exportado num editor e não achar string legível; truncar o
  arquivo e confirmar import falha limpo; senha errada não altera o cofre atual.

---

## R6 🔴 Migração de esquema do banco cifrado

**O que pode dar errado**
- Migração que assume o estado errado de origem (por falta de versão).
- Migração interrompida no meio deixa o banco num estado que nenhuma versão entende.
- Migração que precisa decifrar/recifrar tudo e falha com o cofre grande.

**Por que é grave**
Uma migração ruim **corrompe cofres que já funcionavam** — inclusive o seu, com dados
reais dentro. É um risco que só aparece na segunda versão do app, quando já há dados a
perder.

**Como atacamos**
- `formatVersion` desde a v1; toda migração é `de N para N+1`, idempotente, transacional.
- Backup automático (cifrado) antes de migrar.
- Teste: pegar um cofre da versão anterior, migrar, conferir todos os registros; matar o
  app no meio da migração e confirmar recuperação.

---

## R7 🟠 Higiene de memória e ciclo de vida (lock, background, clipboard, screenshot)

**O que pode dar errado**
- KEK/DEK não zeradas ao trancar → ficam no heap, aparecem em dump/crash report.
- App vai para background e a tela sensível fica na prévia de recentes.
- Clipboard não limpo se o app morre antes dos 30 s.
- Auto-lock com corrida: timer não reinicia direito, ou não dispara vindo do background.
- Campo de senha com autocomplete/teclado que guarda o que foi digitado.

**Por que é grave**
São vazamentos "pequenos" e frequentes — a senha aparece num screenshot automático, num
histórico de clipboard, numa prévia de app. Difícil de perceber, fácil de explorar por
quem tem o aparelho por 30 segundos.

**Como atacamos**
- Zerar chaves no lock; `FLAG_SECURE` global; tela neutra no background.
- Clipboard: marca sensível + limpeza condicionada a "ainda é o nosso conteúdo".
- Teclado sem sugestão/armazenamento nos campos de segredo.
- Teste: `logcat` e dump de memória após lock; screenshot bloqueado; recentes neutro;
  clipboard limpo no tempo certo e preservado se o usuário copiou outra coisa.

---

## R8 🟠 Aleatoriedade (CSPRNG)

**O que pode dar errado**
- Uso de `Math.random()` em qualquer ponto (nonce, salt, DEK, senha gerada).
- Polyfill de `crypto` que cai silenciosamente num gerador fraco.

**Por que é grave**
Aleatoriedade previsível quebra **tudo ao mesmo tempo**: nonces colidem, salts repetem,
senhas geradas são adivinháveis, chave de recuperação é atacável.

**Como atacamos**
- Regra de lint proibindo `Math.random`.
- Só APIs de CSPRNG do sistema; teste que confirma distribuição e ausência de repetição
  em amostra grande.

---

## R9 🟠 Superfície da stack (dev client, config plugins, libs nativas)

**O que pode dar errado**
- Uma lib de cripto nativa desatualizada ou não mantida.
- Config plugin do Expo aplicando (ou deixando de aplicar) `FLAG_SECURE`,
  `allowBackup=false` de forma inconsistente entre builds.
- Diferença de comportamento entre o build de debug (teste) e o de release (uso real).

**Por que é grave**
O que você testa pode não ser o que roda com a sua senha real, se debug e release
divergirem nas proteções.

**Como atacamos**
- Fixar versões; revisar cada lib de cripto quanto a manutenção e auditoria.
- Testar no build **release** as invariantes de segurança, não só no debug.
- Checklist de release confirma `allowBackup`, `FLAG_SECURE`, logs desativados.

---

## R10 🟡 UX que induz o usuário ao erro

**O que pode dar errado**
- Criar cofre sem deixar claro que esquecer senha + recovery = perda total.
- Botão de exportar sem avisar onde o arquivo vai parar.
- Mensagem de erro que revela demais (se o cofre existe, quantas tentativas restam).

**Por que é grave**
A criptografia pode estar perfeita e o usuário ainda perder tudo por não entender as
consequências. Num cofre offline, não há suporte para reverter.

**Como atacamos**
- Textos de consequência na criação e na exportação.
- Mensagens de erro genéricas por padrão.
- QA valida a clareza nos testes exploratórios.

---

## Mapa rápido: risco × sprint que o endereça

| Risco | Endereçado em |
|---|---|
| R1 Derivação de chave | Sprint 1, revalidado Sprint 5 |
| R2 Chave de recuperação | Sprint 2 |
| R3 Cifra / nonce | Sprint 1, invariantes na Sprint 5 |
| R4 Keystore / biometria | Sprint 1 (armazenamento) + Sprint 3 (biometria) |
| R5 Export / import | Sprint 2 |
| R6 Migração de esquema | Sprint 1 (formato v1) + toda sprint que mexe no schema |
| R7 Memória / ciclo de vida | Sprint 3 |
| R8 Aleatoriedade | Sprint 1 |
| R9 Stack / release | contínuo, fecha na Sprint 5 |
| R10 UX de erro | Sprints 1–2 (textos), validado na 5 |
