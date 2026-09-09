# Arquitetura do SafeVault e escolhas de criptografia

> Este documento é uma **proposta** para o QA revisar e questionar. Nada foi implementado.
> Onde uma decisão afeta a segurança da sua senha real, há um bloco **Trade-off** em
> português claro.

---

## 1. Visão geral em uma frase

O app guarda suas credenciais dentro de um banco SQLite **inteiro cifrado**; a chave que
abre esse banco só existe na memória enquanto o cofre está destravado, e é reconstruída a
partir da sua senha mestra (ou da biometria, ou da chave de recuperação) toda vez que
você abre o app.

---

## 2. Camadas do aplicativo

```
┌─────────────────────────────────────────────────────────────┐
│  UI (React Native + Expo Router)                             │
│  telas: criar cofre · desbloquear · lista · formulário ·     │
│         gerador · exportar/importar · configurações          │
├─────────────────────────────────────────────────────────────┤
│  Camada de domínio (TypeScript puro, testável isolada)       │
│  VaultService · CredentialService · GeneratorService ·       │
│  BackupService · AutoLockController                          │
├─────────────────────────────────────────────────────────────┤
│  Camada de criptografia (isola TODA chamada de cripto)       │
│  KdfProvider (Argon2id) · Cipher (AES-256-GCM) · Csprng ·    │
│  KeyStore (wrapper do expo-secure-store)                     │
├─────────────────────────────────────────────────────────────┤
│  Persistência                                                │
│  SQLCipher (banco cifrado) · sistema de arquivos (backups)   │
├─────────────────────────────────────────────────────────────┤
│  Plataforma Android (via Expo config plugins / dev client)   │
│  Android Keystore · BiometricPrompt · FLAG_SECURE · Clipboard│
└─────────────────────────────────────────────────────────────┘
```

**Por que uma "camada de criptografia" separada:** nenhum outro arquivo do app chama uma
função de cripto diretamente. Tudo passa por essa camada. Assim, quando o QA for auditar
"onde entra e sai segredo", há um único lugar para olhar — e se um dia trocarmos de
biblioteca, muda só ali.

Ancoragem no que você conhece: é o mesmo princípio de um **Page Object** no Cypress/
Playwright, ou de um **client REST** único no REST Assured — você não espalha
`RestAssured.given()` por 200 testes, você encapsula. Aqui encapsulamos a cripto.

---

## 3. Glossário mínimo (cada termo é usado depois)

| Termo | O que é, sem jargão |
|---|---|
| **Texto claro / plaintext** | O dado legível: sua senha "S3nh@doBanco". |
| **Texto cifrado / ciphertext** | O mesmo dado embaralhado; sem a chave é lixo. |
| **Chave** | Um número de 256 bits (32 bytes) que embaralha e desembaralha. |
| **Senha mestra** | O que você digita. **Não é** a chave — é a matéria-prima para gerar a chave. |
| **KDF (Key Derivation Function)** | Função que transforma a senha mestra (curta, fraca) numa chave (longa, forte), de propósito **devagar**, para atrapalhar quem tenta adivinhar. |
| **Salt** | Um valor aleatório público, guardado junto do cofre, misturado na senha antes do KDF. Impede que duas pessoas com a mesma senha gerem a mesma chave e impede ataques com tabelas pré-calculadas. |
| **Nonce / IV** | "Número usado uma vez". Valor que acompanha cada trecho cifrado e **nunca pode se repetir** com a mesma chave. |
| **AEAD** | Cifra que, além de esconder o dado, **detecta adulteração**: se um byte do texto cifrado mudar, a decifragem falha em vez de devolver lixo. AES-GCM é AEAD. |
| **Auth tag** | O "selo" de 16 bytes que o AEAD gera; é ele que denuncia adulteração. |
| **CSPRNG** | Gerador de números aleatórios bom para segurança (não é o `Math.random`). |
| **KEK / DEK** | Key-Encryption-Key (chave que cifra outra chave) e Data-Encryption-Key (chave que cifra os dados). Explicado na seção 5. |
| **Keystore (Android)** | Cofre de chaves do próprio sistema operacional, com apoio de hardware. O app pede "guarde isto" e nem o app consegue extrair depois. |

---

## 4. Escolha 1 — Derivação de chave: Argon2id

**O que vamos usar:** Argon2id, com parâmetros calibrados no device
(alvo inicial: memória 46 MiB, 3 iterações, paralelismo 1), via a biblioteca nativa
`react-native-argon2` (que empacota a implementação de referência do Argon2, a mesma
premiada na Password Hashing Competition).

**Fallback aprovado:** se a biblioteca nativa se mostrar instável no CI ou em algum
device, caímos para **PBKDF2-HMAC-SHA256 com 600.000 iterações** (o piso que você
definiu), via `react-native-quick-crypto` (que usa OpenSSL por baixo).

### Trade-off: Argon2id vs PBKDF2

Quem rouba seu celular ou um backup do cofre vai tentar **adivinhar sua senha mestra**
testando bilhões de possibilidades numa placa de vídeo ou máquina alugada na nuvem.

- **PBKDF2** só custa *tempo de CPU*. Placas de vídeo e ASICs fazem isso MUITO mais
  rápido que um celular. 600.000 iterações é o mínimo aceitável hoje, não o confortável.
- **Argon2id** custa *tempo E memória*. Ele obriga o atacante a reservar dezenas de MB
  por tentativa. Isso mata o paralelismo barato de GPU/ASIC. Para o mesmo "incômodo"
  sentido por você ao destravar (uns 0,5–1s), o Argon2id encarece o ataque em ordens de
  grandeza.

**Por que "id" e não "i" ou "d":** a variante `id` é híbrida — resiste tanto a ataque de
canal lateral (quem observa o uso de memória) quanto a ataque de GPU. É a recomendação
padrão da OWASP e do RFC 9106.

**O que descartamos e por quê:**
- **scrypt** — bom, mas o Argon2id é mais novo, mais analisado e com recomendação
  oficial mais clara. Sem motivo para escolher o mais antigo.
- **bcrypt** — limite de 72 bytes na entrada e sem custo de memória ajustável. Feito
  para senhas de servidor, não para derivar chave de cofre. Descartado.
- **PBKDF2 como opção principal** — só fica como rede de segurança pela portabilidade.

### Trade-off: parâmetros do Argon2id no celular

Memória alta = mais seguro, mas celular fraco pode **travar ou estourar memória** ao
destravar. Se colocarmos pouco, fica fácil demais de atacar.

Decisão: na criação do cofre, o app roda uma **calibração** — mede quanto tempo o Argon2id
leva neste aparelho e escolhe o maior custo que ainda fecha em ~0,7s. Os parâmetros
usados ficam gravados junto do cofre (não são segredo), para que a decifragem futura use
exatamente os mesmos. Piso absoluto: 19 MiB / 2 iterações (mínimo OWASP). Isso é
requisito de aceite testável na Sprint 1.

---

## 5. Escolha 2 — Hierarquia de chaves (KEK / DEK)

Não usamos a chave da senha mestra para cifrar os dados diretamente. Usamos **duas
chaves**:

```
  Senha mestra ──Argon2id(salt, params)──►  KEK  (Key Encryption Key)
                                              │
                                              │ AES-256-GCM (cifra/decifra)
                                              ▼
  DEK aleatória (32 bytes do CSPRNG) ──────►  "DEK embrulhada"  ──► gravada em disco
        │
        │ é ela que abre o SQLCipher e cifra campos
        ▼
     Seus dados
```

- **DEK** (Data Encryption Key): sorteada uma única vez, na criação do cofre. É a chave
  que realmente abre o banco.
- **KEK** (Key Encryption Key): derivada da senha mestra. Só serve para **embrulhar/
  desembrulhar a DEK**.

### Por que essa volta a mais (o trade-off explicado)

1. **Trocar a senha mestra fica barato.** Sem hierarquia, mudar a senha exigiria
   decifrar e recifrar TUDO. Com hierarquia, só reembrulhamos a DEK com a nova KEK.
   Menos risco de corromper o cofre numa operação longa.
2. **Múltiplos caminhos de desbloqueio.** Biometria e chave de recuperação são só
   **outras cópias da DEK embrulhada**, cada uma com um embrulho diferente:
   - embrulho por senha mestra (KEK do Argon2id)
   - embrulho por chave de recuperação (KEK derivada da recovery key)
   - embrulho por biometria (DEK guardada no Android Keystore, liberada pelo
     BiometricPrompt)
3. **Revogar biometria não afeta o resto.** Some a cópia guardada no Keystore, as outras
   continuam.

Custo: mais código e mais casos de teste (cada embrulho é um fluxo). Aceitamos porque
recuperação é requisito de primeira classe neste projeto.

---

## 6. Escolha 3 — Cifra do conteúdo: AES-256-GCM

**O que vamos usar:** AES-256-GCM, com **nonce de 96 bits sorteado pelo CSPRNG para cada
operação de escrita**, via `react-native-quick-crypto` (OpenSSL). O nonce é gravado ao
lado do texto cifrado; a auth tag de 128 bits é verificada em toda decifragem — se falhar,
o app trata como **cofre corrompido/adulterado**, nunca ignora.

Uso concreto:
- embrulho da DEK (seção 5)
- chave do SQLCipher (o banco todo — ver seção 7)
- arquivo de exportação/backup (seção 8)

### Trade-off: o perigo do nonce repetido

No AES-GCM, **usar o mesmo nonce com a mesma chave duas vezes é catastrófico**: vaza
informação do conteúdo e permite forjar dados. Com nonce de 96 bits sorteado, a chance de
repetir só fica perceptível depois de ~2³² (4 bilhões) de operações com a mesma chave —
muito além do que um cofre pessoal atinge. Ainda assim:

- **Regra de projeto:** nonce sempre do CSPRNG, nunca um contador que possa reiniciar,
  nunca "zero".
- Onde o volume de escritas for alto (ex.: rotação de chave), consideramos derivar uma
  subchave nova, mantendo a folga.
- Isto vira **caso de teste de segurança**: garantir que dois registros nunca
  compartilham nonce.

**O que descartamos e por quê:**
- **AES-CBC + HMAC** — funciona, mas exige montar a verificação de integridade à mão
  (fácil errar a ordem "encrypt-then-MAC"). GCM já traz isso pronto.
- **XChaCha20-Poly1305** (libsodium) — tecnicamente seria uma escolha ligeiramente
  melhor: nonce de 192 bits torna a colisão praticamente impossível mesmo sorteando.
  **Descartado só porque você fixou AES-256-GCM no enunciado.** Fica registrado como
  alternativa caso você reavalie.
- **Cifrar campo a campo em vez do banco todo** — deixaria títulos/URLs em claro no
  índice do SQLite. Preferimos cifrar o banco inteiro (seção 7).

---

## 7. Escolha 4 — Banco: SQLCipher (banco inteiro cifrado)

**O que vamos usar:** SQLite com extensão **SQLCipher** (AES-256, cifragem por página),
via `op-sqlite` (suporta SQLCipher e roda com Expo dev client). A chave do SQLCipher **é a
DEK**.

**Por que o banco inteiro e não só a coluna da senha:** num password manager, o *título*
("Banco Inter"), a *URL* e as *notas* também são sensíveis — revelam onde você tem conta.
Cifrando só a coluna `password`, esses metadados ficariam legíveis para quem abrisse o
arquivo `.db`. Cifrando o banco todo, o arquivo em repouso é ruído — inclusive índices e
o journal de transações.

**O que descartamos:**
- **`expo-sqlite` puro + cifrar campos na aplicação** — mais simples, mas deixa
  metadados em claro (acima) e espalha chamadas de cripto pelo código.
- **Realm / WatermelonDB** — camadas de abstração grandes demais para um cofre que
  precisa ser auditável linha a linha.
- **Guardar tudo em um único arquivo JSON cifrado** — sem índice, busca fica lenta e
  toda gravação reescreve o arquivo inteiro (risco de corromper em queda de energia).

---

## 8. Escolha 5 — Chaves no dispositivo: expo-secure-store + Android Keystore

`expo-secure-store` guarda valores pequenos usando, no Android, o **Keystore** +
`EncryptedSharedPreferences`. O Keystore pode ser respaldado por hardware (TEE/StrongBox):
a chave entra, mas **não sai** — o app só pede "use essa chave para decifrar isto".

O que fica no secure-store:
- a **DEK embrulhada por biometria** (liberada pelo `BiometricPrompt`)
- o **salt** e os **parâmetros do Argon2id**
- metadados não-secretos do cofre (versão do formato)

O que **nunca** fica no secure-store: a senha mestra, a KEK, a DEK "crua", qualquer
credencial. Limite prático de tamanho (~2 KB no Android) reforça isso: só cabe chave.

### Trade-off: biometria é conveniência, não é a senha

Se o app permite abrir só com digital, a segurança do cofre passa a depender da
digital/PIN do aparelho e da implementação do Keystore. Decisão:
- Biometria **nunca** substitui a senha mestra na primeira abertura após reiniciar o
  aparelho — aí exigimos a senha (padrão dos gerenciadores sérios).
- Trocar a senha mestra **invalida** a cópia biométrica (força re-cadastro).
- Se o usuário adicionar/remover digitais no Android, o Keystore invalida a chave
  automaticamente (`setInvalidatedByBiometricEnrollment(true)`) — o app cai para senha.

---

## 9. Escolha 6 — Aleatoriedade: CSPRNG do sistema

Todo valor aleatório (salt, nonce, DEK, chave de recuperação, senhas geradas) vem de
`react-native-quick-crypto` `randomBytes` / `expo-crypto` `getRandomValues`, que usam o
CSPRNG do SO (`/dev/urandom` no Android). **`Math.random()` é proibido no projeto** — é
previsível e quebraria o gerador de senhas e os nonces. Isto vira regra de lint e caso de
teste.

---

## 10. Chave de recuperação

- Gerada na criação do cofre: 256 bits do CSPRNG, apresentada como ~24 palavras
  (lista BIP-39) ou 32 caracteres em grupos — **decidir com o QA na Sprint 2**.
- Serve para criar uma KEK alternativa que embrulha a **mesma DEK**.
- Exibida **uma única vez**, com confirmação de que foi guardada. Nunca gravada em claro,
  nunca em log, nunca em screenshot (tela com `FLAG_SECURE`).
- Fluxo de uso: "esqueci a senha mestra" → digita a chave de recuperação → desembrulha a
  DEK → obriga a definir nova senha mestra.

### Trade-off: a chave de recuperação é o ponto único de perda

Se você perder a senha mestra **e** a chave de recuperação, os dados estão
**matematicamente perdidos** — não existe "resetar senha" num cofre offline de verdade.
Isso é uma escolha de segurança: qualquer backdoor de recuperação seria também um
backdoor para um atacante. O app precisa comunicar isso com clareza na criação do cofre,
e o backup cifrado (seção 11) é a segunda rede de proteção.

---

## 11. Backup, exportação e importação

- **Exportação:** arquivo `.safevault` = cabeçalho com versão + parâmetros KDF + salt +
  nonce, seguido do conteúdo do cofre cifrado com AES-256-GCM sob uma chave derivada de
  uma **senha de exportação** que o usuário escolhe na hora (pode ser a mestra ou outra).
- **Importação:** pede a senha de exportação, valida a auth tag antes de tocar no cofre
  atual, importa para um cofre novo ou mescla (decidir na Sprint 2).
- **Backup manual:** mesma coisa da exportação, disparado pelo usuário, salvo via
  `expo-file-system` / Storage Access Framework.
- **Backup automático do sistema DESLIGADO:** `android:allowBackup="false"` e regras de
  `dataExtractionRules` para o cofre nunca subir para o Google Drive sem cifragem nossa.

### Trade-off: exportação é o momento mais perigoso do app

O arquivo exportado sai do sandbox do app e vai para Downloads/Drive/e-mail. Se a senha
de exportação for fraca ou o arquivo for salvo sem cifra, a proteção toda evapora.
Regras: sem opção de "exportar sem senha"; indicador de força obrigatório na senha de
exportação; aviso explícito de "onde você vai guardar este arquivo?".

---

## 12. Proteções de tela e memória

| Proteção | Como | Sprint |
|---|---|---|
| Bloqueio de screenshot + ocultar no app switcher | `expo-screen-capture` `preventScreenCaptureAsync()` (aplica `FLAG_SECURE` no Android) | 3 |
| Copiar com limpeza em 30s | `expo-clipboard` + timer; flag `IS_SENSITIVE` no Android 13+ | 3 |
| Bloqueio automático por inatividade | `AppState` + timer; zera KEK/DEK da memória e navega para tela de desbloqueio | 3 |
| Sem segredo em log | regra de lint proíbe `console.log` na camada de domínio/cripto; logs de release desativados | todas |
| Sem segredo em crash report | não adotar Sentry/Crashlytics com captura de estado; se adotar, scrubbing | todas |

---

## 13. Formato de dados em repouso (rascunho)

```
Arquivo do cofre (SQLCipher):   vault.db          -> cifrado com a DEK
Cópias embrulhadas da DEK:      key_wraps         -> tabela: {metodo, salt, params, nonce, dek_cifrada, tag}
Segredos no Keystore:           secure-store      -> {dek_wrap_biometria, kdf_salt, kdf_params, formato_versao}
Backup:                         cofre-AAAA-MM-DD.safevault  -> cabeçalho + blob AES-256-GCM
```

Versionar o **formato** desde o dia 1 (`formato_versao = 1`): toda migração futura do
esquema precisa saber de onde partiu, ou corrompe cofre — este é um dos maiores riscos do
projeto (ver [analise-de-risco.md](analise-de-risco.md)).

---

## 14. Bibliotecas propostas (resumo para aprovar)

| Necessidade | Biblioteca | Por quê |
|---|---|---|
| Argon2id | `react-native-argon2` | empacota implementação de referência; nativa (rápida) |
| AES-256-GCM, randomBytes, PBKDF2 (fallback) | `react-native-quick-crypto` | OpenSSL por baixo; API igual ao `crypto` do Node |
| Banco cifrado | `op-sqlite` (com SQLCipher) | SQLCipher consagrado; compatível com Expo dev client |
| Chaves no SO | `expo-secure-store` | Keystore/Keychain sem escrever código nativo |
| Biometria | `expo-local-authentication` | BiometricPrompt encapsulado |
| Bloqueio de screenshot | `expo-screen-capture` | aplica FLAG_SECURE |
| Área de transferência | `expo-clipboard` | flag de conteúdo sensível |
| Aleatório para digest simples | `expo-crypto` | `getRandomValues`, SHA para indicador de força |

**Consequência da stack:** não dá para usar Expo Go (app pré-compilado da loja). Vamos de
**Expo prebuild + dev client** — geramos nosso próprio APK de desenvolvimento. Isso
também é o que o Detox e o `FLAG_SECURE` exigem. Explicado no
[setup](setup-ambiente-windows.md).

---

## 15. O que fica FORA de propósito nesta arquitetura

- Sincronização em nuvem / multi-device (o produto é offline-first por decisão).
- Preenchimento automático (Android Autofill Framework) — funcionalidade grande, fica
  para depois da Sprint 5.
- iOS — o alvo de automação é Android; o código será escrito com iOS em mente, mas sem
  garantia de teste.
- Compartilhamento de credenciais entre usuários.
