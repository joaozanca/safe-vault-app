"""Fixtures compartilhadas — o equivalente ao `support/e2e.js` + `beforeEach` do Cypress.

Cada teste recebe uma sessão Appium nova, com os dados do app APAGADOS antes de
começar (`noReset: False`). Isso garante independência: nenhum teste herda
cofre, credencial ou bloqueio deixado por outro, e a ordem de execução não importa.
"""

import allure
import pytest
from appium import webdriver
from appium.options.android import UiAutomator2Options

from pages.chave_recuperacao_page import ChaveRecuperacaoPage
from pages.criar_cofre_page import CriarCofrePage
from pages.lista_credenciais_page import ListaCredenciaisPage
from support import config
from support.dados import senha_mestra_valida


def _opcoes() -> UiAutomator2Options:
    opcoes = UiAutomator2Options()
    opcoes.app_package = config.APP_PACKAGE
    opcoes.app_activity = config.APP_ACTIVITY
    if config.APK_PATH:
        opcoes.app = config.APK_PATH
    if config.DEVICE_UDID:
        opcoes.udid = config.DEVICE_UDID
    # Limpa os dados do app (como `adb shell pm clear`) antes de cada sessão.
    opcoes.no_reset = False
    opcoes.full_reset = False
    opcoes.auto_grant_permissions = True
    # O cofre roda Argon2id ao criar/abrir; sem isso o Appium pode encerrar a
    # sessão achando que o teste "travou" durante a derivação de chave.
    opcoes.new_command_timeout = 120
    return opcoes


@pytest.fixture
def driver():
    sessao = webdriver.Remote(config.APPIUM_URL, options=_opcoes())
    yield sessao
    sessao.quit()


@pytest.fixture
def senha_mestra() -> str:
    return senha_mestra_valida()


@pytest.fixture
def cofre_aberto(driver, senha_mestra) -> ListaCredenciaisPage:
    """Pré-condição comum: cofre criado pela própria UI e já destravado.

    Não há atalho "por baixo" (API, banco pronto) de propósito — o cofre só
    existe se a criação pela tela funcionar, então essa fixture também é uma
    verificação implícita do fluxo de entrada.
    """
    CriarCofrePage(driver).criar(senha_mestra)
    ChaveRecuperacaoPage(driver).confirmar_que_guardou()
    lista = ListaCredenciaisPage(driver)
    assert lista.esta_aberta(), "pré-condição falhou: cofre não abriu após a criação"
    return lista


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Em caso de falha, anexa ao Allure a árvore de elementos da tela.

    Screenshot não ajuda aqui: o app liga FLAG_SECURE (H3.4) e qualquer captura
    sai preta — é o controle de segurança funcionando. O XML da tela (o mesmo
    do `uiautomator dump`) mostra textos, testIDs e posições de tudo que estava
    visível no momento da falha.
    """
    resultado = yield
    relatorio = resultado.get_result()
    if relatorio.when == "call" and relatorio.failed:
        sessao = item.funcargs.get("driver")
        if sessao is not None:
            allure.attach(
                sessao.page_source,
                name="tela-no-momento-da-falha",
                attachment_type=allure.attachment_type.XML,
            )
