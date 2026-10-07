"""Gerador de senhas (H4.1)."""

import allure
import pytest

from pages.formulario_credencial_page import FormularioCredencialPage
from pages.gerador_senha_page import GeradorSenhaPage

TAMANHO_PADRAO = 16


@pytest.fixture
def gerador(driver, cofre_aberto) -> GeradorSenhaPage:
    """Gerador aberto a partir do formulário de nova credencial.

    Fica aqui e não no conftest.py porque só este arquivo usa.
    """
    cofre_aberto.nova_credencial()
    FormularioCredencialPage(driver).abrir_gerador()
    return GeradorSenhaPage(driver)


@allure.feature("Gerador de senhas")
@allure.story("H4.1 — gerador de senhas")
def test_senha_gerada_tem_o_tamanho_padrao(gerador):
    # Act
    senha = gerador.senha_gerada()

    # Assert — a mensagem mostra o tamanho real; a senha em si é descartável
    # (gerada só para o teste), então aparecer no relatório não é problema.
    assert len(senha) == TAMANHO_PADRAO, f"tamanho {len(senha)}, esperado {TAMANHO_PADRAO}"


@allure.feature("Gerador de senhas")
@allure.story("H4.1 — gerador de senhas")
def test_desligar_maiusculas_gera_senha_sem_letra_maiuscula(gerador):
    # Arrange — guarda a senha atual para saber quando a nova ficou pronta.
    senha_anterior = gerador.senha_gerada()

    # Act
    gerador.alternar_maiusculas()
    senha = gerador.senha_gerada(diferente_de=senha_anterior)

    # Assert — 1º confirma que o toque desligou mesmo a opção; 2º, a regra.
    # Uma senha basta: com maiúsculas LIGADAS o gerador garante ao menos uma,
    # então se o toggle não funcionasse a falha seria certa, não questão de sorte.
    assert not gerador.maiusculas_ligadas(), "o interruptor de maiúsculas deveria estar desligado"
    maiusculas = [c for c in senha if c.isupper()]
    assert maiusculas == [], f"senha gerada com maiúsculas: {maiusculas}"
