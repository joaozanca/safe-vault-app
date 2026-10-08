"""Copiar senha com limpeza automática da área de transferência (H3.2)."""

import re
import time

import allure
import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait

from pages.formulario_credencial_page import FormularioCredencialPage

LIMPEZA_S = 30
# Tolerância da medição: o tempo de cada leitura do Appium (~1 s) entra na conta.
TOLERANCIA_S = 5
AVISO_ESPERADO = re.compile(r"^Senha copiada — apagada em (30|29|28)s$")


@pytest.fixture
def formulario_da_credencial(driver, cofre_aberto, credencial_cadastrada) -> FormularioCredencialPage:
    """Credencial salva aberta para edição (é onde existe o botão Copiar)."""
    cofre_aberto.abrir(credencial_cadastrada.titulo)
    return FormularioCredencialPage(driver)


@pytest.mark.lento
@allure.feature("Segurança")
@allure.story("H3.2 — copiar com limpeza automática em 30 s")
def test_senha_copiada_some_da_area_de_transferencia_em_30_s(
    driver, formulario_da_credencial, credencial_cadastrada
):
    # Act — copia e mede quanto tempo a senha fica na área de transferência.
    formulario_da_credencial.copiar_senha()
    copiada_em = time.monotonic()
    aviso = formulario_da_credencial.aviso_de_copia()
    conteudo_logo_apos = driver.get_clipboard_text()
    try:
        WebDriverWait(driver, LIMPEZA_S + TOLERANCIA_S + 5, poll_frequency=1).until(
            lambda d: d.get_clipboard_text() != credencial_cadastrada.senha
        )
    except TimeoutException:
        pytest.fail(f"a senha continuou na área de transferência por mais de {LIMPEZA_S + TOLERANCIA_S} s")
    durou = time.monotonic() - copiada_em

    # Assert — aviso com contagem, senha exata copiada, e limpeza no prazo.
    assert AVISO_ESPERADO.match(aviso), f"aviso inesperado: {aviso!r}"
    assert conteudo_logo_apos == credencial_cadastrada.senha, "deveria copiar exatamente a senha"
    assert driver.get_clipboard_text() == "", "a área de transferência deveria ficar vazia"
    assert LIMPEZA_S - TOLERANCIA_S <= durou <= LIMPEZA_S + TOLERANCIA_S, (
        f"limpou em {durou:.1f} s; esperado {LIMPEZA_S} s ± {TOLERANCIA_S}"
    )


@pytest.mark.lento
@allure.feature("Segurança")
@allure.story("H3.2 — copiar com limpeza automática em 30 s")
def test_limpeza_nao_apaga_o_que_o_usuario_copiou_depois(driver, formulario_da_credencial):
    # Arrange — copia a senha e, antes dos 30 s, o usuário copia outra coisa.
    formulario_da_credencial.copiar_senha()
    formulario_da_credencial.aviso_de_copia()
    texto_do_usuario = "endereço que eu copiei de outro app"
    driver.set_clipboard_text(texto_do_usuario)

    # Act — espera o prazo da limpeza vencer (o aviso some quando ele vence) e
    # observa mais alguns segundos, para a limpeza ter tido chance de agir.
    formulario_da_credencial.aguardar_aviso_de_copia_sumir(timeout=LIMPEZA_S + TOLERANCIA_S + 5)
    observar_ate = time.monotonic() + TOLERANCIA_S
    while time.monotonic() < observar_ate:
        assert driver.get_clipboard_text() == texto_do_usuario, (
            "a limpeza apagou um conteúdo que não era a senha copiada pelo app"
        )
