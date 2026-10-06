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


@allure.feature("Cofre")
@allure.story("H1.1 — criar cofre")
def test_criar_cofre_com_confirmacao_diferente_mostra_erro(driver, senha_mestra):
    # Arrange
    criar_cofre = CriarCofrePage(driver)

    # Act — a confirmação difere da senha só no último caractere: é o erro de
    # digitação real que a tela existe para pegar.
    criar_cofre.criar(senha_mestra, confirmacao=senha_mestra + "x")

    # Assert — mensagem exata E continua na mesma tela (o cofre não foi criado).
    assert criar_cofre.mensagem_erro() == "As senhas digitadas não são iguais."
    assert criar_cofre.esta_aberta(), "com senhas diferentes o app não pode sair da criação"


@allure.feature("Cofre")
@allure.story("H1.1 — política de senha mestra")
@pytest.mark.parametrize(
    "senha_fraca, problema",
    [
        ("SenhaSemNumero", "precisa ter ao menos 1 número"),
        ("senhasemmaiuscula1", "precisa ter ao menos 1 letra maiúscula"),
        ("Curta1", "precisa ter no mínimo 8 caracteres"),
    ],
    ids=["sem-numero", "sem-maiuscula", "curta-demais"],
)
def test_criar_cofre_com_senha_fraca_mostra_o_problema(driver, senha_fraca, problema):
    # Arrange — cada senha quebra UMA regra só, então a mensagem é previsível.
    criar_cofre = CriarCofrePage(driver)

    # Act — mesma senha nos dois campos: o que está em teste é a política,
    # não a confirmação (essa é o exercício 1).
    criar_cofre.criar(senha_fraca)

    # Assert — mensagem inteira e exata, e o cofre não foi criado.
    assert criar_cofre.mensagem_erro() == f"Senha mestra inválida: {problema}."
    assert criar_cofre.esta_aberta(), "senha fraca não pode criar o cofre"
