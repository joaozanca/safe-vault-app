"""Entrar com a chave de recuperação (H2.2)."""

import secrets

import allure
import pytest

from pages.chave_recuperacao_page import ChaveRecuperacaoPage
from pages.desbloqueio_page import DesbloqueioPage
from pages.lista_credenciais_page import ListaCredenciaisPage
from pages.recuperacao_page import RecuperacaoPage
from support.dados import senha_mestra_valida
from support.formatos import FORMATO_CHAVE_RECUPERACAO

MENSAGEM_CHAVE_INVALIDA = "Chave de recuperação inválida."


def _recuperar_acesso(driver, lista: ListaCredenciaisPage, chave: str, nova_senha: str) -> str:
    """Tranca, entra pela chave definindo `nova_senha`, confirma a chave nova
    e devolve essa chave nova (a recuperação sempre rotaciona a chave)."""
    lista.trancar()
    DesbloqueioPage(driver).esqueci_a_senha()
    RecuperacaoPage(driver).recuperar(chave, nova_senha)
    tela_chave = ChaveRecuperacaoPage(driver)
    chave_nova = tela_chave.chave_exibida()
    tela_chave.confirmar_que_guardou()
    return chave_nova


@pytest.mark.smoke
@allure.feature("Recuperação")
@allure.story("H2.2 — entrar com a chave de recuperação")
@pytest.mark.parametrize("com_tracos", [True, False], ids=["chave-com-tracos", "chave-sem-tracos"])
def test_recuperar_com_a_chave_define_senha_nova_e_gera_chave_nova(
    driver, cofre_aberto, chave_de_recuperacao, com_tracos
):
    # Arrange — a chave pode ser colada como exibida ou só com os dígitos;
    # o app aceita os dois formatos.
    chave_digitada = chave_de_recuperacao if com_tracos else chave_de_recuperacao.replace("-", "")
    senha_nova = senha_mestra_valida()

    # Act — recupera, tranca de novo e entra com a senha NOVA.
    chave_nova = _recuperar_acesso(driver, cofre_aberto, chave_digitada, senha_nova)
    cofre_aberto.trancar()
    DesbloqueioPage(driver).desbloquear(senha_nova)

    # Assert
    assert FORMATO_CHAVE_RECUPERACAO.match(chave_nova), f"chave nova fora do formato: {chave_nova!r}"
    assert chave_nova != chave_de_recuperacao, "a recuperação deveria gerar uma chave nova"
    assert cofre_aberto.esta_aberta(), "a senha nova deveria abrir o cofre"


@allure.feature("Recuperação")
@allure.story("H2.2 — entrar com a chave de recuperação")
def test_senha_antiga_deixa_de_abrir_o_cofre_apos_recuperacao(
    driver, cofre_aberto, chave_de_recuperacao, senha_mestra
):
    # Arrange — recupera o acesso definindo uma senha nova.
    _recuperar_acesso(driver, cofre_aberto, chave_de_recuperacao, senha_mestra_valida())
    cofre_aberto.trancar()
    desbloqueio = DesbloqueioPage(driver)

    # Act — tenta a senha de ANTES da recuperação.
    desbloqueio.desbloquear(senha_mestra)

    # Assert
    assert desbloqueio.mensagem_erro() == "Senha incorreta."
    assert desbloqueio.esta_aberta(), "a senha antiga não pode mais abrir o cofre"


@allure.feature("Recuperação")
@allure.story("H2.2 — rotação da chave de recuperação")
def test_chave_ja_usada_deixa_de_funcionar(driver, cofre_aberto, chave_de_recuperacao):
    # Arrange — usa a chave uma vez (o que gera uma chave nova e invalida esta).
    _recuperar_acesso(driver, cofre_aberto, chave_de_recuperacao, senha_mestra_valida())
    cofre_aberto.trancar()
    DesbloqueioPage(driver).esqueci_a_senha()
    recuperacao = RecuperacaoPage(driver)

    # Act — tenta a MESMA chave de novo (ex.: uma cópia antiga vazada).
    recuperacao.recuperar(chave_de_recuperacao, senha_mestra_valida())

    # Assert — a cópia antiga não é mais porta de entrada.
    assert recuperacao.mensagem_erro() == MENSAGEM_CHAVE_INVALIDA
    assert recuperacao.esta_aberta(), "chave já usada não pode recuperar o acesso"


@allure.feature("Recuperação")
@allure.story("H2.2 — entrar com a chave de recuperação")
@pytest.mark.parametrize(
    "chave_invalida",
    [
        "isto-nao-e-uma-chave",
        # Formato perfeito, mas não é a chave deste cofre.
        "-".join(secrets.token_hex(2) for _ in range(16)),
    ],
    ids=["formato-errado", "chave-de-outro-cofre"],
)
def test_chave_invalida_mostra_a_mesma_mensagem_generica(driver, cofre_aberto, chave_invalida):
    # Arrange
    cofre_aberto.trancar()
    DesbloqueioPage(driver).esqueci_a_senha()
    recuperacao = RecuperacaoPage(driver)

    # Act
    recuperacao.recuperar(chave_invalida, senha_mestra_valida())

    # Assert — mesma mensagem nos dois casos: o app não revela se a chave
    # "quase" serviu (formato certo) ou nem chegou perto.
    assert recuperacao.mensagem_erro() == MENSAGEM_CHAVE_INVALIDA
    assert recuperacao.esta_aberta(), "chave inválida não pode recuperar o acesso"
