"""Deixar o tempo real passar sem perder a sessão do Appium."""

import time

# O Appium encerra a sessão após `new_command_timeout` (120 s) sem comandos.
INTERVALO_S = 10


def deixar_o_tempo_passar(driver, segundos: float) -> None:
    """Espera `segundos` de relógio fazendo uma consulta leve a cada 10 s.

    Única espera de tempo FIXO da suíte, e de propósito: nos testes de auto-lock
    (H3.3) o tempo passando é o próprio requisito em teste, não uma tentativa
    de sincronizar com a tela. A consulta (`current_package`) não toca na tela,
    então não conta como interação do usuário para o app.
    """
    fim = time.monotonic() + segundos
    while (restante := fim - time.monotonic()) > 0:
        time.sleep(min(INTERVALO_S, restante))
        driver.current_package  # noqa: B018 — mantém a sessão viva
