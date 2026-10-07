"""Desbloqueio com senha mestra (H1.2)."""

import re

import allure
import pytest

from pages.desbloqueio_page import DesbloqueioPage
from support import config

TENTATIVAS_ATE_BLOQUEAR = 5
# Primeiro bloqueio é de 30 s; a contagem começa em 0:30 ou um pouco abaixo,
# dependendo de quanto tempo passou até a tela ser lida.
MENSAGEM_PRIMEIRO_BLOQUEIO = re.compile(
    r"^Bloqueado por excesso de tentativas\. Tente novamente em 0:(30|[12]\d)\.$"
)


def _errar_ate_bloquear(desbloqueio: DesbloqueioPage, senha_mestra: str) -> None:
    for _ in range(TENTATIVAS_ATE_BLOQUEAR):
        desbloqueio.errar_senha(senha_mestra + "x")


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


@allure.feature("Cofre")
@allure.story("H1.2 — bloqueio progressivo por tentativas")
def test_quinta_senha_errada_ja_mostra_o_bloqueio(driver, cofre_aberto, senha_mestra):
    # Arrange
    cofre_aberto.trancar()
    desbloqueio = DesbloqueioPage(driver)

    # Act — 5 erradas; NENHUMA tentativa a mais depois disso.
    _errar_ate_bloquear(desbloqueio, senha_mestra)

    # Assert — a própria 5ª errada já mostra a contagem regressiva exata, e
    # campo e botão ficam travados: não dá nem para tentar a senha certa.
    mensagem = desbloqueio.mensagem_bloqueio()
    assert MENSAGEM_PRIMEIRO_BLOQUEIO.match(mensagem), f"mensagem inesperada: {mensagem!r}"
    assert not desbloqueio.botao_desbloquear_habilitado(), "botão deveria ficar desabilitado"
    assert not desbloqueio.campo_senha_editavel(), "campo de senha deveria ficar travado"


@allure.feature("Cofre")
@allure.story("H1.2 — bloqueio progressivo por tentativas")
def test_reabrir_o_app_durante_o_bloqueio_ja_mostra_a_contagem(driver, cofre_aberto, senha_mestra):
    # Arrange — bloqueia e fecha o app (como alguém tentando "zerar" o bloqueio).
    cofre_aberto.trancar()
    desbloqueio = DesbloqueioPage(driver)
    _errar_ate_bloquear(desbloqueio, senha_mestra)
    driver.terminate_app(config.APP_PACKAGE)

    # Act — só reabre; nenhuma tentativa.
    driver.activate_app(config.APP_PACKAGE)

    # Assert — o bloqueio foi persistido (não estava só na memória da tela) e
    # a tela já o mostra ao abrir, sem esperar alguém tentar para descobrir.
    mensagem = desbloqueio.mensagem_bloqueio()
    assert MENSAGEM_PRIMEIRO_BLOQUEIO.match(mensagem), f"mensagem inesperada: {mensagem!r}"
    assert not desbloqueio.botao_desbloquear_habilitado(), "botão deveria abrir desabilitado"


@pytest.mark.lento
@allure.feature("Cofre")
@allure.story("H1.2 — bloqueio progressivo por tentativas")
def test_senha_certa_volta_a_funcionar_quando_o_bloqueio_termina(
    driver, cofre_aberto, senha_mestra
):
    # Arrange — bloqueia e espera os 30 s reais (a tela reabre o botão sozinha).
    cofre_aberto.trancar()
    desbloqueio = DesbloqueioPage(driver)
    _errar_ate_bloquear(desbloqueio, senha_mestra)
    desbloqueio.aguardar_fim_do_bloqueio()

    # Act
    desbloqueio.desbloquear(senha_mestra)

    # Assert — bloqueio é temporário, nunca permanente (decisão do H1.2).
    assert cofre_aberto.esta_aberta(), "terminado o bloqueio, a senha certa deveria abrir o cofre"
