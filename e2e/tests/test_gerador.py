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


TAMANHO_MINIMO, TAMANHO_MAXIMO = 8, 64
AMBIGUOS = set("0O1lI")


@allure.feature("Gerador de senhas")
@allure.story("H4.1 — limites de tamanho")
@pytest.mark.parametrize(
    "passos, limite",
    [
        (-(TAMANHO_PADRAO - TAMANHO_MINIMO) - 2, TAMANHO_MINIMO),  # 2 toques além do mínimo
        (TAMANHO_MAXIMO - TAMANHO_PADRAO + 2, TAMANHO_MAXIMO),  # 2 toques além do máximo
    ],
    ids=["minimo-8", "maximo-64"],
)
def test_tamanho_para_nos_limites_e_a_senha_acompanha(gerador, passos, limite):
    # Arrange — guarda a senha atual para saber quando a do novo tamanho ficou pronta.
    senha_anterior = gerador.senha_gerada()

    # Act — toca ALÉM do limite: o tamanho tem que parar nele, não passar.
    gerador.mudar_tamanho(passos)

    # Assert
    assert gerador.aguardar_tamanho(limite) == limite, f"o tamanho deveria parar em {limite}"
    assert len(gerador.senha_gerada(diferente_de=senha_anterior)) == limite


@allure.feature("Gerador de senhas")
@allure.story("H4.1 — opções inválidas")
def test_desligar_todas_as_classes_mostra_erro_e_bloqueia_usar(gerador):
    # Act
    gerador.desligar_todas_as_classes()

    # Assert — sem senha (o traço), mensagem exata e "Usar" travado.
    assert gerador.mensagem_erro() == (
        "Opções inválidas: selecione ao menos uma classe de caractere."
    )
    assert gerador.resultado_exibido() == GeradorSenhaPage.SEM_SENHA
    assert not gerador.botao_usar_habilitado(), "sem senha gerada, 'Usar' tem que estar desabilitado"


@allure.feature("Gerador de senhas")
@allure.story("H4.1 — excluir caracteres ambíguos")
def test_excluir_ambiguos_gera_senha_sem_0_O_1_l_I(gerador):
    # Arrange — tamanho máximo (64): com a opção DESLIGADA, a chance de uma
    # senha de 64 sair sem nenhum ambíguo por acaso é ~3% — então este teste
    # realmente distingue "opção funcionando" de "sorte".
    gerador.mudar_tamanho(TAMANHO_MAXIMO - TAMANHO_PADRAO)
    gerador.aguardar_tamanho(TAMANHO_MAXIMO)
    senha_anterior = gerador.senha_gerada()

    # Act
    gerador.alternar_excluir_ambiguos()
    senha = gerador.senha_gerada(diferente_de=senha_anterior)

    # Assert
    encontrados = sorted(set(senha) & AMBIGUOS)
    assert encontrados == [], f"senha com caracteres ambíguos: {encontrados}"


@pytest.mark.smoke
@allure.feature("Gerador de senhas")
@allure.story("H4.1 — usar a senha gerada")
def test_usar_senha_gerada_preenche_o_campo_senha_do_formulario(driver, gerador):
    # Arrange
    senha = gerador.senha_gerada()

    # Act
    gerador.usar_senha()

    # Assert — o campo é mascarado; revela para conferir o conteúdo exato.
    formulario = FormularioCredencialPage(driver)
    formulario.alternar_visibilidade_da_senha()
    assert formulario.texto_do_campo_senha() == senha
