# Preparação do ambiente — Windows 11

Passo a passo comando por comando. Cada etapa tem **Verificar** (como saber que deu
certo) e **Se falhar** (o que fazer).

Convenções:
- `PS>` = rode no **PowerShell** (o terminal que você já usa).
- Onde disser "PowerShell **como Administrador**", abra o menu Iniciar, digite
  `PowerShell`, clique com o botão direito → *Executar como administrador*.
- Depois de mexer em variável de ambiente, **feche e reabra o PowerShell** (ele só lê as
  variáveis ao abrir).

---

## 0. O que já está instalado nesta máquina (checado em 2026-09-25)

| Ferramenta | Estado | Ação |
|---|---|---|
| Git 2.53 | ✅ instalado | nada |
| Node v24.14.1 + npm 11 | ✅ instalado | nada (é linha LTS, serve) |
| Java JDK 21 (`JAVA_HOME` definido) | ✅ instalado | serve; se o Gradle reclamar, ver etapa 3.6 |
| winget 1.29 | ✅ instalado | é o instalador que vamos usar |
| Android Studio 2026.1.4.7 / SDK (API 37.2) / `adb` / emulador `Pixel_10a` | ✅ instalado e testado (emulador liga, `adb devices` mostra `device`) | nada |
| Python | ❌ ausente | etapa 4 |
| Appium | ❌ ausente | etapa 5 |
| Detox | ❌ ausente (é dependência do projeto, etapa 6) | etapa 6 |

> Etapa 3 (Android Studio) foi seguida de verdade nesta máquina em 2026-09-25 — os
> ajustes que a interface real exigiu (diferente do que a etapa previa) estão marcados
> com **"[testado 2026-09-25]"** abaixo.

---

## 1. Git (já instalado — só configurar)

```powershell
PS> git config --global user.name "João Vitor"
PS> git config --global user.email "joaovitorzanca1997@gmail.com"
PS> git config --global init.defaultBranch main
PS> git config --global core.autocrlf input
```

**Verificar:**
```powershell
PS> git config --global --list
```
Deve listar as 4 linhas acima.

`core.autocrlf input` = ao commitar, converte quebra de linha Windows (CRLF) para Unix
(LF). Evita que o CI Linux veja "o arquivo inteiro mudou".

---

## 2. Node.js (já instalado — recomendação opcional)

Está com Node 24. Funciona. **Opcional, mas recomendado:** instalar o `nvm-windows` para
poder trocar de versão de Node por projeto (o CI vai fixar uma versão; bom espelhar
localmente).

```powershell
PS> winget install CoreyButler.NVMforWindows
```
Feche e reabra o PowerShell.
```powershell
PS> nvm install 22.14.0
PS> nvm use 22.14.0
```

**Verificar:**
```powershell
PS> node -v      # v22.14.0 (ou v24 se você não instalou o nvm)
PS> npm -v
PS> corepack enable   # habilita yarn/pnpm sem instalar global
```

**Se falhar** (`nvm` não reconhecido): a instalação não atualizou o PATH. Faça logout do
Windows e login de novo, ou reinicie.

> Decisão: não travamos a versão agora. Quando montarmos o CI (Sprint com pipeline) a
> gente fixa `node` no `.nvmrc` e no workflow do GitHub Actions ao mesmo tempo.

---

## 3. Android Studio + SDK + emulador

### 3.1 Instalar o Android Studio

```powershell
PS> winget install Google.AndroidStudio
```
Isso baixa ~1 GB. Ao terminar, **abra o Android Studio uma vez** (menu Iniciar). No
assistente inicial:
- escolha *Standard*;
- aceite as licenças;
- deixe ele baixar: *Android SDK*, *Android SDK Platform*, *Android Virtual Device*,
  *Android SDK Build-Tools*, *Android Emulator*, *Android SDK Platform-Tools*.

### 3.2 Instalar os pacotes de SDK que a automação precisa

No Android Studio: ícone de engrenagem → **SDK Manager** (ou *More Actions → SDK Manager*
na tela inicial).

**[testado 2026-09-25]** Nessa versão do Android Studio (2026.1.4.7), não existe uma
janela separada chamada "SDK Manager" na tela inicial — o mesmo conteúdo mora em
**Settings → Languages & Frameworks → Android SDK** (o botão *Settings*/engrenagem na
tela "Welcome" abre direto ali). As abas **SDK Platforms** / **SDK Tools** /
**SDK Update Sites** continuam existindo, só que dentro dessa janela de Settings.

Aba **SDK Platforms** → marque *Show Package Details* → na versão estável mais recente
disponível (era "Android 17.0 (CinnamonBun)" / API 37.2 em 2026-09-25 — vai mudar com o
tempo, use sempre a mais recente não-preview), marque:
- `Android SDK Platform <versão>`
- a imagem de sistema com **"Google APIs"** no nome, **não** "Google Play" — pode
  aparecer como `Google APIs Intel x86_64 Atom System Image` ou, em versões que já
  migraram pra página de 16KB, `16 KB Page Size Google APIs Intel x86_64 Atom System
  Image`. O nome muda, a regra não: **Google APIs, nunca Google Play**.

Aba **SDK Tools** → *Show Package Details* → confirme marcados:
- `Android SDK Build-Tools` (a mais recente já vem marcada)
- `Android SDK Command-line Tools (latest)`  ← **essencial**, o instalador não marca por padrão
- `Android SDK Platform-Tools`
- `Android Emulator`

Clique **Apply** e aguarde o download.

> Por que imagem "Google APIs" e não "Google Play": a imagem Play tem o `adb root`
> bloqueado. A imagem Google APIs permite `adb root`, que o Appium/UiAutomator2 usa para
> instalar o servidor de automação e injetar eventos sem atrito. A versão exata da API
> importa menos que isso — priorize a mais recente estável disponível; ajustamos a
> versão do CI pra bater com a local quando montarmos o pipeline (Sprint 5), não o
> contrário.

### 3.3 Definir as variáveis de ambiente

O SDK costuma ficar em `C:\Users\joaov\AppData\Local\Android\Sdk`. Confirme no SDK
Manager (campo *Android SDK Location* no topo).

Abra **"Editar as variáveis de ambiente do sistema"** (menu Iniciar, digite isso) →
botão *Variáveis de Ambiente*. Em **Variáveis de usuário**:

1. *Novo…* → Nome `ANDROID_HOME`, Valor `C:\Users\joaov\AppData\Local\Android\Sdk`
2. Selecione `Path` → *Editar…* → *Novo* e adicione, uma por linha:
   ```
   %ANDROID_HOME%\platform-tools
   %ANDROID_HOME%\emulator
   %ANDROID_HOME%\cmdline-tools\latest\bin
   ```

Alternativa por linha de comando (PowerShell **como Administrador** não é necessário,
são variáveis de usuário):
```powershell
PS> setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
PS> setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator;$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin"
```
⚠️ `setx PATH` trunca o PATH em 1024 caracteres. Se o seu PATH já for grande, **use a
interface gráfica** para não perder entradas.

**Feche e reabra o PowerShell.**

**Verificar:**
```powershell
PS> $env:ANDROID_HOME
PS> adb version                 # Android Debug Bridge version 1.0.41
PS> emulator -version           # Android emulator version 35.x
PS> sdkmanager --version        # um número de versão
```

**Se falhar** (`adb` não reconhecido): o PATH não pegou. Confira em
`Variáveis de Ambiente` se as 3 linhas estão lá e se `ANDROID_HOME` aponta para a pasta
certa (tem que existir `platform-tools\adb.exe` dentro dela). Reabra o terminal.

### 3.4 Aceitar as licenças do SDK pela linha de comando

```powershell
PS> sdkmanager --licenses
```
Responda `y` em todas. (O Appium reclama se sobrar licença não aceita.)

### 3.5 Criar o emulador (AVD)

Opção A — pela interface: Android Studio → **Device Manager** → *Create Device* →
*Pixel 7* → imagem *API 34 / Google APIs / x86_64* → *Finish*.

Opção B — linha de comando:
```powershell
PS> sdkmanager "system-images;android-34;google_apis;x86_64"
PS> avdmanager create avd -n Pixel_7_API_34 -k "system-images;android-34;google_apis;x86_64" -d pixel_7
```

**Verificar:**
```powershell
PS> emulator -list-avds          # deve aparecer: Pixel_7_API_34
```

Suba o emulador:
```powershell
PS> emulator -avd Pixel_7_API_34
```
(abre uma janela com o Android; a primeira vez demora 1–3 min)

Em outro PowerShell:
```powershell
PS> adb devices
```
Deve mostrar `emulator-5554   device`. Se mostrar `offline`, espere o Android terminar de
bootar.

**Se falhar** — emulador não abre ou fica travado no boot:
- Painel de Controle → *Programas* → *Ativar ou desativar recursos do Windows* → marque
  **Plataforma do Hipervisor do Windows** e **Plataforma de Máquina Virtual**. Reinicie.
- Se você usa WSL2/Docker/Hyper-V, o emulador usa o WHPX e convive com eles nas versões
  atuais. Se ainda assim travar, no `Device Manager` edite o AVD → *Graphics: Software*.
- Erro `PANIC: Cannot find AVD system path`: a variável `ANDROID_HOME` ou
  `ANDROID_SDK_ROOT` está errada.

### 3.6 (Se necessário) Java 17 para o Gradle

Está com JDK 21. React Native / Android Gradle Plugin recentes aceitam 17–21. Se ao
buildar o app o Gradle disser algo como *"Unsupported class file major version"* ou
*"incompatible Java"*, instale o 17 lado a lado:
```powershell
PS> winget install EclipseAdoptium.Temurin.17.JDK
```
E aponte o Gradle para ele (sem mexer no `JAVA_HOME` global) criando
`android/gradle.properties` no projeto com:
```
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.x.x-hotspot
```
Deixamos essa decisão para quando o app existir (Sprint 1).

---

## 4. Python + pytest + cliente Appium

### 4.1 Instalar o Python

```powershell
PS> winget install Python.Python.3.12
```
Feche e reabra o PowerShell.

**Verificar:**
```powershell
PS> python --version          # Python 3.12.x
PS> pip --version             # pip 24.x ... (python 3.12)
```

**Se falhar** (`python` abre a Microsoft Store): Configurações do Windows → *Aplicativos*
→ *Configurações avançadas de aplicativo* → *Aliases de execução de aplicativo* →
desligue os dois `python.exe` / `python3.exe` da Store. Reabra o terminal.

### 4.2 Permitir ativar ambientes virtuais no PowerShell

Uma vez só, na sua conta:
```powershell
PS> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Responda `S`. Isso libera rodar scripts locais assinados/seus (o script de ativação do
venv é um `.ps1`). Não abre a máquina para scripts baixados da internet.

### 4.3 Criar o ambiente virtual do projeto de testes

Um **virtualenv** (`venv`) é uma pasta com um Python isolado e suas bibliotecas próprias —
para o projeto não depender do Python global e o CI reproduzir exatamente as mesmas
versões. É o análogo do `node_modules` para Python, ou de um `pom.xml` isolando
dependências no mundo Java.

```powershell
PS> cd C:\Users\joaov\Documents\Projetos\projeto-mobile
PS> python -m venv .venv
PS> .\.venv\Scripts\Activate.ps1
```
O prompt passa a mostrar `(.venv)` na frente. (Para sair: `deactivate`.)

### 4.4 Instalar as bibliotecas de teste

Com `(.venv)` ativo:
```powershell
(.venv) PS> python -m pip install --upgrade pip
(.venv) PS> pip install Appium-Python-Client pytest pytest-xdist allure-pytest selenium
(.venv) PS> pip freeze > requirements.txt
```

- **Appium-Python-Client** — a biblioteca que fala com o Appium Server (já traz o
  `selenium` como dependência, mas fixamos explícito).
- **pytest** — o runner de testes. É o seu JUnit do mundo Python: descobre funções que
  começam com `test_`, roda, reporta. `assert x == y` puro, sem `assertEquals`.
- **pytest-xdist** — roda testes em paralelo (`pytest -n 2`).
- **allure-pytest** — plugin que gera os dados para o relatório Allure.
- `requirements.txt` — trava as versões; o CI instala a partir dele.

**Verificar:**
```powershell
(.venv) PS> pytest --version           # pytest 8.x
(.venv) PS> python -c "import appium; print(appium.__version__)"
```

---

## 5. Appium Server + driver UiAutomator2

O Appium 2 é um programa Node. Instalamos global (ele não faz parte do app nem do venv
Python — é uma ferramenta de linha de comando, como o `allure`).

```powershell
PS> npm install -g appium
```

**Verificar:**
```powershell
PS> appium -v                 # 2.x.x
```

### 5.1 Instalar o driver do Android

O Appium sozinho não sabe falar com Android. Um **driver** é o plugin que traduz os
comandos genéricos ("clique nesse elemento") para a tecnologia da plataforma — no Android,
o **UiAutomator2** (framework de automação do próprio Google).

```powershell
PS> appium driver install uiautomator2
```

**Verificar:**
```powershell
PS> appium driver list --installed        # uiautomator2@x.x.x [installed (npm)]
```

### 5.2 Rodar o "doctor" do driver

O Appium 2.4+ tem diagnóstico embutido:
```powershell
PS> appium driver doctor uiautomator2
```
Ele checa `ANDROID_HOME`, `JAVA_HOME`, `adb`, licenças do SDK. Corrija o que aparecer com
❌ antes de seguir. Tudo ✅ = ambiente Android pronto para automação.

### 5.3 Subir o servidor e testar contra o emulador

Com o emulador rodando (etapa 3.5):
```powershell
PS> appium
```
Deixe rodando. Saída esperada termina com
`Appium REST http interface listener started on http://0.0.0.0:4723`.

Em outro PowerShell, teste a conexão (é o "hello world" do Appium):
```powershell
PS> curl http://127.0.0.1:4723/status
```
Deve voltar um JSON com `"ready": true`.

### 5.4 Appium Inspector (para achar seletores)

Baixe o **Appium Inspector** (instalador `.exe` separado, do repositório
`appium/appium-inspector` no GitHub → *Releases*). É a ferramenta gráfica onde você
conecta num app rodando e clica nos elementos para ver o `resource-id` / `testID`,
xpath, etc.

Ancoragem: é o equivalente ao **seletor playground** do Cypress ou ao
`npx playwright codegen`. Você usa para *descobrir* o seletor; depois escreve o teste à
mão.

---

## 6. Detox (dependência do projeto, instala na Sprint 1)

O Detox precisa do código do app para compilar um APK instrumentado. Registrando aqui o
que será feito quando o app existir:

```powershell
# dentro do projeto, quando houver package.json:
PS> npm install --save-dev detox jest
PS> npm install -g detox-cli        # opcional, dá o comando `detox` global
```

Detox no Android roda no Windows (o Detox só exige macOS para iOS). Ele usa Espresso por
baixo (caixa-cinza: enxerga o estado interno do app e sincroniza sozinho — menos
`sleep`).

**Verificar (na Sprint 1):**
```powershell
PS> npx detox --version
PS> npx detox build --configuration android.emu.debug
PS> npx detox test  --configuration android.emu.debug
```

---

## 7. Allure (relatório)

Precisa de Java (você tem). Duas formas:

Opção A — via npm (mais simples):
```powershell
PS> npm install -g allure-commandline
PS> allure --version
```

Opção B — via Scoop:
```powershell
PS> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
PS> irm get.scoop.sh | iex
PS> scoop install allure
```

**Verificar o fluxo completo** (depois de ter ao menos 1 teste):
```powershell
(.venv) PS> pytest --alluredir=allure-results
(.venv) PS> allure serve allure-results
```
Abre o navegador com o relatório. É o seu "Allure do REST Assured/JUnit", igualzinho.

---

## 8. Azure DevOps Test Plans

Nada para instalar — é web. Confirme:
- acesso a uma organização em `dev.azure.com` (crie uma grátis com sua conta Microsoft se
  não tiver);
- um **projeto** criado (ex.: `SafeVault`);
- o serviço **Test Plans** habilitado (Project Settings → Overview → *Azure Test Plans*).

Na Sprint 1 a gente cria o primeiro Plano de Teste e amarra os casos às histórias.

---

## 9. Checklist final do ambiente

Rode tudo isto num PowerShell novo, com o emulador ligado e `appium` rodando noutro:

```powershell
PS> git --version
PS> node -v
PS> java -version
PS> adb devices                       # emulator-5554  device
PS> emulator -list-avds               # Pixel_7_API_34
PS> appium -v
PS> appium driver list --installed    # uiautomator2 ... installed
PS> curl http://127.0.0.1:4723/status # {"value":{"ready":true,...}}
PS> python --version
PS> .\.venv\Scripts\Activate.ps1
(.venv) PS> pytest --version
(.venv) PS> allure --version
```

Se todos responderem sem erro, o ambiente da Sprint 0 está pronto. O primeiro teste
Appium de verdade (abrir o app, digitar a senha mestra) é conteúdo da **Sprint 1**.

---

## 10. Problemas comuns — referência rápida

| Sintoma | Causa provável | Correção |
|---|---|---|
| `adb`/`appium`/`python` "não reconhecido" | PATH não recarregado | feche e reabra o PowerShell; confira `Variáveis de Ambiente` |
| `python` abre a Microsoft Store | alias de execução do Windows | Configurações → Aliases de execução de aplicativo → desligar `python.exe` |
| `Activate.ps1 ... execução de scripts desabilitada` | ExecutionPolicy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Emulador trava no boot / tela preta | virtualização desligada | ativar *Plataforma do Hipervisor do Windows* + reiniciar |
| `adb devices` mostra `offline` | Android ainda bootando, ou o handshake do adb travou depois do boot | aguardar; se persistir mesmo com o Android já na tela inicial, `adb reconnect offline` costuma resolver na hora (**testado em 2026-09-25**: `kill-server`/`start-server` sozinho não foi suficiente, `reconnect offline` sim) |
| Tela trava com o aviso `[Refresh] Expected to find the updated module` | Fast Refresh do Metro não conseguiu trocar "a quente" um módulo depois de uma mudança grande de imports | não é bug do código — força um reload completo: `adb shell am force-stop <package>` seguido de `adb shell am start -n <package>/.MainActivity` (**testado em 2026-09-29**: chamar `POST http://127.0.0.1:8081/reload` não resolveu, matar e reabrir o processo sim) |
| Duas instâncias de `expo run:android` disputando a porta 8081 | um `expo run:android` anterior ainda está rodando (Metro não foi encerrado) quando você inicia outro | ache o processo com `netstat -ano \| findstr :8081` e derrube com `Stop-Process -Id <PID> -Force` antes de rodar `expo run:android` de novo — senão o novo build "pula" o próprio Metro e serve JS desatualizado do processo antigo |
| `appium driver doctor` acusa licença | licenças do SDK | `sdkmanager --licenses` e responder `y` |
| Gradle: "unsupported Java version" | JDK 21 vs plugin antigo | instalar Temurin 17 e apontar `org.gradle.java.home` |
| `sdkmanager`/`avdmanager` "não reconhecido" | falta `cmdline-tools;latest` no PATH | instalar no SDK Manager + adicionar `cmdline-tools\latest\bin` ao PATH |
