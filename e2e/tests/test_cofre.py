"""Exemplos de teste de criação e desbloqueio do cofre.

Estrutura de todo teste: Arrange (pré-condição, quase sempre via fixture) →
Act (ações pelo Page Object) → Assert (asserções AQUI, nunca no Page Object).
"""

import re

import allure
import pytest

from pages.chave_recuperacao_page import ChaveRecuperacaoPage
from pages.criar_cofre_page import CriarCofrePage
from pages.desbloqueio_page import DesbloqueioPage
from pages.lista_credenciais_page import ListaCredenciaisPage

# 32 bytes em hex = 64 dígitos, exibidos em 16 blocos de 4 separados por traço.
FORMATO_CHAVE_RECUPERACAO = re.compile(r"^[0-9a-f]{4}(-[0-9a-f]{4}){15}$")


@pytest.mark.smoke
@allure.feature("Cofre")
@allure.story("H1.1 / H2.1 — criar cofre e gerar chave de recuperação")
def test_criar_cofre_exibe_chave_de_recuperacao_e_abre_lista_vazia(driver, senha_mestra):
    # Arrange — a fixture `driver` já entrega o app com os dados apagados,
    # então a primeira tela tem que ser a de criação.
    criar_cofre = CriarCofrePage(driver)
    assert criar_cofre.esta_aberta(), "app limpo deveria abrir na tela de criar cofre"

    # Act
    criar_cofre.criar(senha_mestra)
    recuperacao = ChaveRecuperacaoPage(driver)
    chave = recuperacao.chave_exibida()
    recuperacao.confirmar_que_guardou()

    # Assert — formato exato da chave (não só "não está vazia") e destino final.
    assert FORMATO_CHAVE_RECUPERACAO.match(chave), f"chave fora do formato esperado: {chave!r}"
    lista = ListaCredenciaisPage(driver)
    assert lista.esta_aberta(), "após confirmar a chave, a lista de credenciais deveria abrir"
    assert lista.titulos() == [], "cofre recém-criado não deveria ter credenciais"


@allure.feature("Cofre")
@allure.story("H1.2 — desbloqueio com senha mestra")
def test_desbloqueio_com_senha_errada_mantem_cofre_trancado(driver, cofre_aberto, senha_mestra):
    # Arrange — `cofre_aberto` já criou e destravou o cofre; trancamos para
    # chegar na tela de desbloqueio com um cofre real por trás.
    cofre_aberto.trancar()
    desbloqueio = DesbloqueioPage(driver)

    # Act — uma única tentativa errada (várias disparariam o bloqueio
    # progressivo do H1.2, que merece um teste próprio).
    desbloqueio.desbloquear(senha_mestra + "x")

    # Assert — mensagem específica E continua na tela de desbloqueio.
    assert desbloqueio.mensagem_erro() == "Senha incorreta."
    assert desbloqueio.esta_aberta(), "senha errada não pode sair da tela de desbloqueio"
