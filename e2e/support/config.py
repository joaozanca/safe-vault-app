"""Configuração da suíte vinda de variáveis de ambiente — nada fixo no código.

Mesma ideia do `cypress.env.json`: o teste não sabe em qual máquina roda.
Localmente valem os padrões abaixo; na pipeline o workflow só exporta as
variáveis que mudam (ex.: caminho do APK gerado no build).
"""

import os

APP_PACKAGE = "com.joaozanca.safevault"
APP_ACTIVITY = ".MainActivity"

APPIUM_URL = os.environ.get("APPIUM_URL", "http://127.0.0.1:4723")

# Caminho de um APK de release. Se vazio, a suíte usa o app que já está
# instalado no emulador (útil para depurar sem reinstalar a cada execução).
#
# Convertido para caminho absoluto AQUI, do lado do teste: quem abre o arquivo
# é o servidor Appium, que resolveria um caminho relativo (`..\android\...`) a
# partir da pasta onde o SERVIDOR foi iniciado — não de onde o pytest roda.
_apk = os.environ.get("SAFEVAULT_APK", "")
APK_PATH = os.path.abspath(_apk) if _apk else ""

# Serial do aparelho no `adb devices`. Vazio = o único aparelho conectado.
DEVICE_UDID = os.environ.get("ANDROID_UDID", "")

# Tempo máximo de espera por um elemento. Criar o cofre roda o Argon2id
# (calibração + derivação), então o padrão é folgado.
TIMEOUT_PADRAO = int(os.environ.get("E2E_TIMEOUT", "30"))
