"""Desbloqueio com senha mestra (H1.2)."""

import allure
import pytest

from pages.desbloqueio_page import DesbloqueioPage


@allure.feature("Cofre")
@allure.story("H1.2 — aviso de tentativas erradas")
@pytest.mark.parametrize(
    "erradas, aviso_esperado",
    [
        (1, "Houve 1 tentativa errada desde a última vez que você entrou."),
        (3, "Houve 3 tentativas erradas desde a última vez que você entrou."),
    ],
    ids=["singular", "plural"],
)
def test_entrar_depois_de_tentativas_erradas_avisa_quantas_foram(
    driver, cofre_aberto, senha_mestra, erradas, aviso_esperado
):
    # Arrange — tranca o cofre e erra a senha N vezes (abaixo de 5, para não
    # disparar o bloqueio, que é outro cenário).
    cofre_aberto.trancar()
    desbloqueio = DesbloqueioPage(driver)
    for _ in range(erradas):
        desbloqueio.errar_senha(senha_mestra + "x")

    # Act
    desbloqueio.desbloquear(senha_mestra)

    # Assert — texto exato, incluindo a concordância de singular/plural.
    assert cofre_aberto.aviso_de_tentativas() == aviso_esperado


@allure.feature("Cofre")
@allure.story("H1.2 — aviso de tentativas erradas")
def test_aviso_de_tentativas_aparece_uma_vez_so(driver, cofre_aberto, senha_mestra):
    # Arrange — uma tentativa errada e a entrada que mostra o aviso.
    cofre_aberto.trancar()
    desbloqueio = DesbloqueioPage(driver)
    desbloqueio.errar_senha(senha_mestra + "x")
    desbloqueio.desbloquear(senha_mestra)
    assert cofre_aberto.aviso_de_tentativas() is not None, "pré-condição: o aviso deveria aparecer"

    # Act — tranca e entra de novo, agora sem nenhum erro.
    cofre_aberto.trancar()
    desbloqueio.desbloquear(senha_mestra)

    # Assert — o aviso já foi visto; repetir faria o usuário achar que houve
    # novas tentativas.
    assert cofre_aberto.aviso_de_tentativas() is None
