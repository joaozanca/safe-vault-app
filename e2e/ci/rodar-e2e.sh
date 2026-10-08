#!/usr/bin/env bash
# Roda a suíte E2E dentro do emulador da pipeline (chamado pelo
# android-emulator-runner, que executa cada linha do `script` em um shell
# separado — por isso a lógica fica neste arquivo).
#
# Variáveis: SUITE=rapida (padrão, pula a marca `lento`) | completa
set -uo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
diagnostico="$raiz/diagnostico"
mkdir -p "$diagnostico"

# O servidor Appium foi iniciado num passo anterior; garante que já responde.
for _ in $(seq 1 30); do
  curl -sf http://127.0.0.1:4723/status > /dev/null && break
  sleep 2
done

# "Boot completo" do emulador não garante os serviços do Android prontos: numa
# execução o `settings` travou por 60 s logo depois do boot e todos os testes
# deram ERROR na abertura da sessão. Espera os serviços responderem de verdade
# (configurações e pacotes, com tempo curto cada) por até 3 minutos.
pronto=0
for _ in $(seq 1 36); do
  if timeout 10 adb shell settings get global device_provisioned > /dev/null 2>&1     && timeout 10 adb shell pm path android > /dev/null 2>&1; then
    pronto=1
    break
  fi
  sleep 5
done
if [ "$pronto" != 1 ]; then
  echo "::error::o emulador não ficou pronto (settings/pm sem resposta em 3 min)"
  adb logcat -d > "$diagnostico/logcat.txt" 2>&1 || true
  exit 1
fi

export SAFEVAULT_APK="$raiz/android/app/build/outputs/apk/release/app-release.apk"
# Emulador da pipeline é bem mais lento que o local: dobra a espera por elemento.
export E2E_TIMEOUT=60

marcador=()
if [ "${SUITE:-rapida}" != "completa" ]; then
  marcador=(-m "not lento")
fi

cd "$raiz/e2e"
# --maxfail=3: se o ambiente quebrou (ex.: o app não abre), para cedo em vez
# de gastar 2 h com todos os testes esperando o limite de arranque.
python -m pytest -v --maxfail=3 "${marcador[@]}"
resultado=$?

# Retrato do emulador no fim, para diagnosticar falhas (vira artefato).
adb logcat -d > "$diagnostico/logcat.txt" 2>&1 || true
adb shell uiautomator dump /sdcard/tela.xml > /dev/null 2>&1 \
  && adb pull /sdcard/tela.xml "$diagnostico/tela.xml" > /dev/null 2>&1 || true
adb exec-out screencap -p > "$diagnostico/tela.png" 2>/dev/null || true

exit $resultado
