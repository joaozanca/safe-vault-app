# Suíte E2E — Appium + pytest + Allure

Testes ponta a ponta do SafeVault rodando no app Android de verdade (APK de release),
controlado pelo Appium. Cada teste começa com os dados do app apagados e monta as
próprias pré-condições pela interface.

> Primeira vez com Appium? Comece pelo [guia passo a passo](GUIA-PASSO-A-PASSO.md):
> ambiente, como ver os testes rodando (emulador, Appium Inspector, Allure) e
> exercícios guiados.

## Estrutura

```
e2e/
├── conftest.py          # fixtures: sessão Appium, senha mestra, cofre já aberto; anexo no Allure em falha
├── pytest.ini           # configuração do pytest (pasta de testes, marcadores, saída do Allure)
├── requirements.txt     # dependências Python com versão travada
├── pages/               # Page Objects — um por tela; só ações e leituras, sem asserções
├── support/
│   ├── config.py        # configuração via variáveis de ambiente
│   └── dados.py         # massa de dados dinâmica (Faker)
└── tests/               # cenários — as asserções ficam aqui
```

Localizadores usam sempre o `testID` da tela (ver
[padrão de testID](../docs/sprint-0/padrao-testid.md)), via `por_test_id()` em
`pages/base_page.py`.

## Pré-requisitos (uma vez por máquina)

- Python 3.13, Node 24, JDK 21 e Android SDK (`ANDROID_HOME`, `JAVA_HOME` definidos)
- Appium e o driver Android: `npm install -g appium` e `appium driver install uiautomator2`
- Allure: `npm install -g allure-commandline`
- Ambiente virtual da suíte (dentro de `e2e/`):

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt     # Windows
```

## Executando

1. Gerar o APK de release (só a arquitetura do emulador, para ser mais rápido):

   ```bash
   cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
   ```

2. Emulador ligado (`adb devices` mostrando o aparelho) e servidor Appium rodando
   num terminal separado: `appium`

3. Rodar os testes (dentro de `e2e/`):

   ```bash
   # PowerShell
   $env:SAFEVAULT_APK = "..\android\app\build\outputs\apk\release\app-release.apk"
   .venv\Scripts\python -m pytest            # suíte inteira
   .venv\Scripts\python -m pytest -m smoke   # só os fluxos críticos
   ```

> Ao trocar o tipo de APK (release ↔ debug), desinstale o app antes
> (`adb uninstall com.joaozanca.safevault`): com a mesma versão instalada, o
> Appium pode pular a instalação e testar o app errado.

### Alternativa: build de debug + Metro

Se o build de release falhar localmente com `hermesc.exe foi bloqueado pela política
do Device Guard` (Smart App Control do Windows 11 bloqueia o compilador do Hermes, que
não é assinado), rode a suíte contra o build de **debug**, que não usa o `hermesc` — o
JavaScript vem do Metro em vez de estar compilado no APK:

```powershell
cd android; .\gradlew assembleDebug -PreactNativeArchitectures=x86_64; cd ..
npx expo start            # Metro, num terminal separado (deixe rodando)
adb reverse tcp:8081 tcp:8081
cd e2e
$env:SAFEVAULT_APK = "..\android\app\build\outputs\apk\debug\app-debug.apk"
.\.venv\Scripts\python -m pytest -v
```

É mais lento (cada sessão carrega o JavaScript do Metro) e testa o JS do código-fonte
atual, sem precisar recompilar o APK a cada mudança em `src/`. O APK de release oficial
vem da pipeline.

### Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `SAFEVAULT_APK` | vazio | APK a instalar; vazio = usa o app já instalado |
| `APPIUM_URL` | `http://127.0.0.1:4723` | onde o servidor Appium está ouvindo |
| `ANDROID_UDID` | vazio | serial do aparelho, se houver mais de um conectado |
| `E2E_TIMEOUT` | `30` | espera máxima (s) por um elemento |

## Relatório (Allure)

Cada execução grava os resultados em `allure-results/`. Para ver o HTML:

```bash
allure serve allure-results                              # gera e abre no navegador
allure generate allure-results -o allure-report --clean  # ou só gera a pasta
```

**Por que não há screenshot no relatório:** o app liga `FLAG_SECURE` (H3.4) e
toda captura de tela sai preta. Isso é o controle de segurança funcionando, não um
defeito. Em caso de falha, o relatório anexa o XML da tela
(`tela-no-momento-da-falha`), com textos, `testID`s e posições de tudo que estava
visível.

## Escrevendo um teste novo

1. Se a tela ainda não tem Page Object, crie um em `pages/` herdando de `BasePage`,
   com os `testID`s como constantes e métodos de ação/leitura.
2. Use as fixtures do `conftest.py`: `driver` (app limpo), `senha_mestra`,
   `cofre_aberto` (cofre criado e destravado, já na lista).
3. Gere dados com `support/dados.py`, nunca com valores fixos.
4. Asserções no teste, específicas (valor exato, não só "existe") e com mensagem
   quando o motivo não for óbvio.
5. Marque com `@pytest.mark.smoke` só o que for fluxo crítico.
