"""Fixtures compartilhadas — o equivalente ao `support/e2e.js` + `beforeEach` do Cypress.

Cada teste recebe uma sessão Appium nova, com os dados do app APAGADOS antes de
começar (`noReset: False`). Isso garante independência: nenhum teste herda
cofre, credencial ou bloqueio deixado por outro, e a ordem de execução não importa.
"""

import os

import allure
import pytest
from appium import webdriver
from appium.webdriver.common.appiumby import AppiumBy
from appium.options.android import UiAutomator2Options
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import por_test_id
from pages.chave_recuperacao_page import ChaveRecuperacaoPage
from pages.criar_cofre_page import CriarCofrePage
from pages.formulario_credencial_page import FormularioCredencialPage
from pages.lista_credenciais_page import ListaCredenciaisPage
from support import config
from support.dados import Credencial, nova_credencial, senha_mestra_valida


def _opcoes() -> UiAutomator2Options:
    opcoes = UiAutomator2Options()
    opcoes.app_package = config.APP_PACKAGE
    opcoes.app_activity = config.APP_ACTIVITY
    if config.APK_PATH:
        if not os.path.isfile(config.APK_PATH):
            pytest.exit(
                f"APK não encontrado em {config.APK_PATH}. Confira a variável "
                "SAFEVAULT_APK ou gere o APK (ver e2e/README.md).",
                returncode=4,
            )
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
    # Folga para emulador lento (longas execuções locais e, principalmente, o
    # emulador da pipeline): os padrões de 20 s para comandos adb e 30 s para
    # subir o driver estouraram numa suíte longa, com o app em si saudável.
    opcoes.set_capability("appium:adbExecTimeout", 60_000)
    opcoes.set_capability("appium:uiautomator2ServerLaunchTimeout", 60_000)
    return opcoes


# Telas que podem ser a primeira depois de abrir o app: criar cofre (dados
# apagados, o caso normal) ou desbloquear (se um dia `no_reset` mudar).
PRIMEIRAS_TELAS = ("vault.create.submit-button", "unlock.password.submit-button")


def _dispensar_travamento_de_outro_app(sessao) -> None:
    """Fecha o diálogo "<app> isn't responding" de OUTRO app, tocando em "Wait".

    Na pipeline, o launcher do Android (a tela inicial do sistema) às vezes
    trava no arranque do emulador lento, e o diálogo fica por cima do nosso app
    — que abriu normalmente por baixo ("Running main" no logcat). Travamento do
    PRÓPRIO SafeVault não é dispensado: isso seria defeito e o teste deve falhar.
    """
    esperar = sessao.find_elements(AppiumBy.ID, "android:id/aerr_wait")
    if not esperar:
        return
    textos = " ".join(e.text for e in sessao.find_elements(AppiumBy.ID, "android:id/alertTitle"))
    if "SafeVault" in textos:
        return
    print(f"[ARRANQUE] diálogo do sistema por cima do app: '{textos}'; tocando em 'Wait'.", flush=True)
    allure.attach(textos, name="dialogo-do-sistema-no-arranque", attachment_type=allure.attachment_type.TEXT)
    esperar[0].click()


def _primeira_tela_apareceu(sessao) -> bool:
    def apareceu(d) -> bool:
        if any(d.find_elements(*por_test_id(t)) for t in PRIMEIRAS_TELAS):
            return True
        _dispensar_travamento_de_outro_app(d)
        return False

    try:
        WebDriverWait(sessao, config.TIMEOUT_ARRANQUE, poll_frequency=1).until(apareceu)
        return True
    except TimeoutException:
        return False


def _registrar_tela_no_arranque(sessao, nome: str) -> str:
    """Anexa a árvore da tela ao relatório e devolve quem está em primeiro plano."""
    allure.attach(sessao.page_source, name=nome, attachment_type=allure.attachment_type.XML)
    return f"{sessao.current_package}/{sessao.current_activity}"


def _aguardar_app_pronto(sessao) -> None:
    """Espera a primeira tela do app aparecer, com folga generosa.

    Um arranque lento não é falha de produto: com o build de debug, a primeira
    sessão depois de ligar o Metro empacota todo o JavaScript do zero; na
    pipeline, o emulador é bem mais lento que o local. Esperar AQUI, uma vez,
    mantém curtos e precisos os tempos limite dentro dos testes.

    Segunda chance, uma vez só: na pipeline, o emulador com renderização por
    software às vezes trava o desenho da primeira tela ("GlContext was
    preempted" no log) — o app fica em primeiro plano e em branco, mesmo com
    o APK de release que abre em 5 s num emulador idêntico local. Reabrir o app
    resolve. A segunda tentativa NÃO é silenciosa: fica no log e no relatório.
    """
    if _primeira_tela_apareceu(sessao):
        return

    em_primeiro_plano = _registrar_tela_no_arranque(sessao, "tela-no-arranque-1a-tentativa")
    print(
        f"[ARRANQUE] primeira tela não apareceu em {config.TIMEOUT_ARRANQUE} s "
        f"({em_primeiro_plano}); reabrindo o app uma vez.",
        flush=True,
    )
    sessao.terminate_app(config.APP_PACKAGE)
    sessao.activate_app(config.APP_PACKAGE)
    if _primeira_tela_apareceu(sessao):
        print("[ARRANQUE] o app abriu na segunda tentativa.", flush=True)
        return

    em_primeiro_plano = _registrar_tela_no_arranque(sessao, "tela-no-arranque-2a-tentativa")
    sessao.quit()
    pytest.fail(
        f"o app não mostrou a primeira tela em 2 tentativas de {config.TIMEOUT_ARRANQUE} s; "
        f"em primeiro plano: {em_primeiro_plano} (Metro no ar? emulador saudável?)",
        pytrace=False,
    )


@pytest.fixture
def driver():
    sessao = webdriver.Remote(config.APPIUM_URL, options=_opcoes())
    _aguardar_app_pronto(sessao)
    yield sessao
    sessao.quit()


@pytest.fixture
def senha_mestra() -> str:
    return senha_mestra_valida()


@pytest.fixture
def chave_de_recuperacao(driver, senha_mestra) -> str:
    """Cria o cofre pela UI e devolve a chave de recuperação exibida (H2.1).

    A chave só aparece uma vez, logo após a criação — por isso é lida aqui,
    no meio da criação, e não depois. Testes de recuperação (H2.2) pedem esta
    fixture junto com `cofre_aberto`; o pytest executa a criação uma vez só.
    """
    CriarCofrePage(driver).criar(senha_mestra)
    recuperacao = ChaveRecuperacaoPage(driver)
    chave = recuperacao.chave_exibida()
    recuperacao.confirmar_que_guardou()
    return chave


@pytest.fixture
def cofre_aberto(driver, chave_de_recuperacao) -> ListaCredenciaisPage:
    """Pré-condição comum: cofre criado pela própria UI e já destravado.

    Não há atalho "por baixo" (API, banco pronto) de propósito — o cofre só
    existe se a criação pela tela funcionar, então essa fixture também é uma
    verificação implícita do fluxo de entrada. A criação em si acontece na
    fixture `chave_de_recuperacao`.
    """
    lista = ListaCredenciaisPage(driver)
    assert lista.esta_aberta(), "pré-condição falhou: cofre não abriu após a criação"
    return lista


@pytest.fixture
def cadastrar_credencial(driver, cofre_aberto):
    """Fixture FÁBRICA: devolve uma função que cadastra uma credencial pela UI.

    O teste chama quantas vezes precisar — `cadastrar_credencial()` gera os
    dados com Faker; `cadastrar_credencial(minha_credencial)` usa os dados
    dados. Devolve sempre a credencial cadastrada, para o teste comparar depois.
    """

    def _cadastrar(credencial: Credencial | None = None) -> Credencial:
        credencial = credencial or nova_credencial()
        cofre_aberto.nova_credencial()
        formulario = FormularioCredencialPage(driver)
        formulario.preencher(credencial)
        formulario.salvar()
        return credencial

    return _cadastrar


@pytest.fixture
def credencial_cadastrada(cadastrar_credencial) -> Credencial:
    """Atalho para o caso mais comum: cofre aberto com UMA credencial."""
    return cadastrar_credencial()


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
