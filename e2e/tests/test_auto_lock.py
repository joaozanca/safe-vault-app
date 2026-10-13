"""Bloqueio automático por inatividade (H3.3) — timer único de 3 minutos."""

import time

import allure
import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import por_test_id
from pages.chave_recuperacao_page import ChaveRecuperacaoPage
from pages.criar_cofre_page import CriarCofrePage
from pages.desbloqueio_page import DesbloqueioPage
from support import config
from support.tempo import deixar_o_tempo_passar

AUTO_LOCK_S = 3 * 60
TOLERANCIA_S = 15
KEYCODE_HOME = 3

pytestmark = pytest.mark.lento


@allure.feature("Segurança")
@allure.story("H3.3 — bloqueio automático por inatividade")
def test_cofre_tranca_sozinho_depois_de_3_minutos_parado(driver, cofre_aberto):
    # Arrange — cofre aberto; a partir daqui ninguém toca na tela.
    cofre_aberto.esta_aberta()
    parado_desde = time.monotonic()

    # Act — espera a tela de desbloqueio aparecer sozinha (com folga).
    try:
        WebDriverWait(driver, AUTO_LOCK_S + TOLERANCIA_S + 30, poll_frequency=2).until(
            lambda d: d.find_elements(*por_test_id(DesbloqueioPage.BOTAO_DESBLOQUEAR))
        )
    except TimeoutException:
        pytest.fail(f"o cofre não trancou em {AUTO_LOCK_S + TOLERANCIA_S} s de inatividade")
    trancou_em = time.monotonic() - parado_desde

    # Assert — tranca, e NÃO antes da hora: trancar cedo demais também é
    # defeito (atrapalha quem está usando).
    assert AUTO_LOCK_S - TOLERANCIA_S <= trancou_em <= AUTO_LOCK_S + TOLERANCIA_S, (
        f"trancou em {trancou_em:.0f} s; esperado {AUTO_LOCK_S} s ± {TOLERANCIA_S}"
    )


@allure.feature("Segurança")
@allure.story("H3.3 — bloqueio automático por inatividade")
def test_ir_a_outro_app_e_voltar_antes_de_3_minutos_nao_tranca(driver, cofre_aberto):
    # Arrange — o caso de uso do refinamento: sair para copiar algo em outro app.
    driver.press_keycode(KEYCODE_HOME)

    # Act — fica 1 minuto fora e volta.
    deixar_o_tempo_passar(driver, 60)
    driver.activate_app(config.APP_PACKAGE)

    # Assert — voltou dentro do prazo: o cofre continua aberto.
    assert cofre_aberto.esta_aberta(), "voltar antes de 3 minutos não deveria trancar o cofre"


@allure.feature("Segurança")
@allure.story("H3.3 — bloqueio automático por inatividade")
def test_ficar_mais_de_3_minutos_em_outro_app_tranca_ao_voltar(driver, cofre_aberto):
    # Arrange
    driver.press_keycode(KEYCODE_HOME)

    # Act — tempo em background conta no mesmo timer (relógio de parede).
    deixar_o_tempo_passar(driver, AUTO_LOCK_S + TOLERANCIA_S)
    driver.activate_app(config.APP_PACKAGE)

    # Assert — ao voltar, a tela é a de desbloqueio, não a lista.
    assert DesbloqueioPage(driver).esta_aberta(), "depois de 3 minutos fora, o cofre deveria estar trancado"


@allure.feature("Segurança")
@allure.story("H2.1 / H3.3 — tempo para anotar a chave de recuperação")
def test_tela_da_chave_nao_tranca_em_3_minutos_parada(driver, senha_mestra):
    # Arrange — achado do QA em aparelho real: copiando a chave no papel, sem
    # tocar na tela, o cofre trancava aos 3 min e a chave mudava.
    CriarCofrePage(driver).criar(senha_mestra)
    tela_chave = ChaveRecuperacaoPage(driver)
    chave = tela_chave.chave_exibida()

    # Act — o tempo de anotar: 3 min + folga, sem tocar em nada.
    deixar_o_tempo_passar(driver, AUTO_LOCK_S + TOLERANCIA_S)

    # Assert — continua na MESMA chave (nesta tela o limite é de 15 min).
    assert tela_chave.chave_exibida() == chave, "a tela da chave não pode trancar aos 3 minutos"
    assert not DesbloqueioPage(driver).esta_visivel(DesbloqueioPage.BOTAO_DESBLOQUEAR, timeout=2)
