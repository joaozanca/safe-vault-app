"""Ajustes do aparelho via adb, para testes que dependem de configuração do sistema."""

import os
import re
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
    # encoding explícito: no Windows o padrão (cp1252) falha em silêncio com a
    # saída UTF-8 do Android e o stdout volta None.
    saida = subprocess.run(
        [_adb(), *alvo, "shell", *comando],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return saida.stdout.strip()


def definir_escala_de_fonte(escala: float) -> None:
    """Tamanho da fonte do sistema (Configurações → Tela → Tamanho da fonte)."""
    adb_shell("settings", "put", "system", "font_scale", str(escala))


# Constantes de android.text.InputType.
_MASCARA_VARIACAO = 0xFF0
_FLAG_SEM_SUGESTOES = 0x80000  # TYPE_TEXT_FLAG_NO_SUGGESTIONS
_VARIACOES_DE_SENHA = {0x80: "senha", 0x90: "senha visível"}


def tipo_do_campo_focado() -> int:
    """`inputType` do campo com foco, como o Android o informa ao teclado."""
    saida = adb_shell("dumpsys", "input_method")
    tipos = re.findall(r"inputType=0x([0-9a-f]+)", saida)
    if not tipos:
        raise AssertionError("nenhum campo com foco encontrado no dumpsys input_method")
    return int(tipos[-1], 16)


def protege_do_teclado(tipo: int) -> bool:
    """Campo de senha/senha visível (o teclado não sugere nem aprende) ou, no
    mínimo, sem sugestões. Este é o máximo que o React Native expõe para uma
    senha REVELADA: a flag Android de "não aprender" (IME_FLAG_NO_PERSONALIZED_
    LEARNING) não é acessível por TextInput — limitação registrada no H5.5.
    """
    return (tipo & _MASCARA_VARIACAO) in _VARIACOES_DE_SENHA or bool(tipo & _FLAG_SEM_SUGESTOES)


def descrever_tipo(tipo: int) -> str:
    variacao = _VARIACOES_DE_SENHA.get(tipo & _MASCARA_VARIACAO, "texto comum")
    sugestoes = "sem sugestões" if tipo & _FLAG_SEM_SUGESTOES else "COM sugestões"
    return f"{variacao}, {sugestoes} (0x{tipo:x})"
