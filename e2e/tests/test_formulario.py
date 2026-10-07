"""Formulário de credencial: validação, limites, opcionais e senha mascarada (H3.1)."""

from dataclasses import replace

import allure
import pytest

from pages.formulario_credencial_page import FormularioCredencialPage
from support.dados import nova_credencial, nova_credencial_completa

LIMITE_TITULO = 100


@pytest.fixture
def formulario(driver, cofre_aberto) -> FormularioCredencialPage:
    """Formulário de NOVA credencial aberto. Só este arquivo usa."""
    cofre_aberto.nova_credencial()
    return FormularioCredencialPage(driver)


@allure.feature("Credenciais")
@allure.story("H3.1 — campos obrigatórios")
@pytest.mark.parametrize(
    "campo_vazio, valor, problema",
    [
        ("titulo", "", "título é obrigatório"),
        ("titulo", "   ", "título é obrigatório"),  # só espaços não vale como título
        ("usuario", "", "usuário é obrigatório"),
        ("senha", "", "senha é obrigatória"),
    ],
    ids=["sem-titulo", "titulo-so-espacos", "sem-usuario", "sem-senha"],
)
def test_salvar_sem_campo_obrigatorio_mostra_o_problema(
    formulario, cofre_aberto, campo_vazio, valor, problema
):
    # Arrange — credencial válida com UM obrigatório esvaziado: só ele está
    # em teste, então a mensagem tem que citar exatamente esse problema.
    credencial = replace(nova_credencial(), **{campo_vazio: valor})

    # Act
    formulario.preencher(credencial)
    formulario.salvar()

    # Assert — mensagem exata e nada salvo (continua no formulário).
    assert formulario.mensagem_erro() == f"Credencial inválida: {problema}."
    assert formulario.esta_aberta(), "com campo obrigatório vazio o formulário não pode fechar"


@allure.feature("Credenciais")
@allure.story("H3.1 — limites de tamanho")
def test_titulo_no_limite_de_100_caracteres_e_aceito(formulario, cofre_aberto):
    # Arrange — valor limite: exatamente o máximo permitido.
    credencial = replace(nova_credencial(), titulo="T" * LIMITE_TITULO)

    # Act
    formulario.preencher(credencial)
    formulario.salvar()

    # Assert
    assert cofre_aberto.titulos() == [credencial.titulo]


@allure.feature("Credenciais")
@allure.story("H3.1 — limites de tamanho")
def test_titulo_acima_de_100_caracteres_e_recusado(formulario):
    # Arrange — primeiro valor fora do limite: máximo + 1.
    credencial = replace(nova_credencial(), titulo="T" * (LIMITE_TITULO + 1))

    # Act
    formulario.preencher(credencial)
    formulario.salvar()

    # Assert
    assert formulario.mensagem_erro() == (
        f"Credencial inválida: título não pode passar de {LIMITE_TITULO} caracteres."
    )
    assert formulario.esta_aberta(), "título longo demais não pode ser salvo"


@allure.feature("Credenciais")
@allure.story("H3.1 — campos opcionais")
def test_campos_opcionais_sao_salvos_e_voltam_ao_reabrir(driver, formulario, cofre_aberto):
    # Arrange
    credencial = nova_credencial_completa()

    # Act — salva com URL, notas e categoria e reabre a credencial (os dados
    # voltam do banco cifrado, não do que ficou digitado na tela).
    formulario.preencher(credencial)
    formulario.salvar()
    cofre_aberto.abrir(credencial.titulo)

    # Assert
    assert FormularioCredencialPage(driver).campos_opcionais() == {
        "url": credencial.url,
        "notas": credencial.notas,
        "categoria": credencial.categoria,
    }


@allure.feature("Credenciais")
@allure.story("H3.1 — senha mascarada por padrão")
def test_senha_fica_mascarada_ate_tocar_em_mostrar(formulario):
    # Arrange
    senha = nova_credencial().senha
    formulario.preencher(replace(nova_credencial(), senha=senha))

    # Act + Assert em etapas: o que importa é o estado em cada passo.
    assert formulario.senha_esta_mascarada(), "a senha deveria começar mascarada"
    assert formulario.texto_do_campo_senha() != senha, "o texto da senha não pode aparecer"

    formulario.alternar_visibilidade_da_senha()
    assert not formulario.senha_esta_mascarada(), "depois de 'Mostrar' a senha deveria aparecer"
    assert formulario.texto_do_campo_senha() == senha

    formulario.alternar_visibilidade_da_senha()
    assert formulario.senha_esta_mascarada(), "depois de 'Ocultar' a senha deveria voltar a ser mascarada"
