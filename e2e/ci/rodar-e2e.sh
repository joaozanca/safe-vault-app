#!/usr/bin/env bash
# Roda a suíte E2E dentro do emulador da pipeline (chamado pelo
# android-emulator-runner, que executa cada linha do `script` em um shell
# separado — por isso a lógica fica neste arquivo).
#
# Variáveis: SUITE=rapida (padrão, pula a marca `lento`) | completa
set -euo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"

# O servidor Appium foi iniciado num passo anterior; garante que já responde.
for _ in $(seq 1 30); do
  curl -sf http://127.0.0.1:4723/status > /dev/null && break
  sleep 2
done

export SAFEVAULT_APK="$raiz/android/app/build/outputs/apk/release/app-release.apk"
# Emulador da pipeline é bem mais lento que o local: dobra a espera por elemento.
export E2E_TIMEOUT=60

marcador=()
if [ "${SUITE:-rapida}" != "completa" ]; then
  marcador=(-m "not lento")
fi

cd "$raiz/e2e"
python -m pytest -v "${marcador[@]}"
