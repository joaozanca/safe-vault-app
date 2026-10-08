"""Ajustes do aparelho via adb, para testes que dependem de configuração do sistema."""

import os
import shutil
import subprocess

from support import config


def _adb() -> str:
    """adb do PATH; senão, o do Android SDK (ANDROID_HOME), como na pipeline."""
    no_path = shutil.which("adb")
    if no_path:
        return no_path
    return os.path.join(os.environ["ANDROID_HOME"], "platform-tools", "adb")


def adb_shell(*comando: str) -> str:
    alvo = ["-s", config.DEVICE_UDID] if config.DEVICE_UDID else []
    saida = subprocess.run(
        [_adb(), *alvo, "shell", *comando], capture_output=True, text=True, check=True
    )
    return saida.stdout.strip()


def definir_escala_de_fonte(escala: float) -> None:
    """Tamanho da fonte do sistema (Configurações → Tela → Tamanho da fonte)."""
    adb_shell("settings", "put", "system", "font_scale", str(escala))
