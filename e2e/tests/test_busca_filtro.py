"""Busca por usuário/URL, maiúsculas, filtro por categoria e busca não persistida (H4.4)."""

from dataclasses import replace

import allure
import pytest

from pages.desbloqueio_page import DesbloqueioPage
from support.dados import nova_credencial, termo_unico


@allure.feature("Credenciais")
@allure.story("H4.4 — busca")
@pytest.mark.parametrize("campo", ["usuario", "url"], ids=["por-usuario", "por-url"])
def test_busca_tambem_encontra_por_usuario_e_por_url(cofre_aberto, cadastrar_credencial, campo):
    # Arrange — o termo único aparece SÓ no campo em teste da credencial alvo;
    # o título dela não o contém, então só o campo em teste pode explicar o achado.
    termo = termo_unico()
    valor = f"user{termo}" if campo == "usuario" else f"https://{termo}.exemplo.com"
    alvo = cadastrar_credencial(replace(nova_credencial(), **{campo: valor}))
    cadastrar_credencial()

    # Act
    cofre_aberto.buscar(termo)

    # Assert
    assert cofre_aberto.aguardar_titulos([alvo.titulo]) == [alvo.titulo]


@allure.feature("Credenciais")
@allure.story("H4.4 — busca")
def test_busca_ignora_maiusculas_e_minusculas(cofre_aberto, cadastrar_credencial):
    # Arrange — título em minúsculas, busca em MAIÚSCULAS.
    termo = termo_unico().lower()
    alvo = cadastrar_credencial(nova_credencial(titulo=f"conta {termo}"))
    cadastrar_credencial()

    # Act
    cofre_aberto.buscar(termo.upper())

    # Assert
    assert cofre_aberto.aguardar_titulos([alvo.titulo]) == [alvo.titulo]


@allure.feature("Credenciais")
@allure.story("H4.4 — filtro por categoria")
def test_filtro_por_categoria_mostra_so_as_dela_e_todas_volta_tudo(
    cofre_aberto, cadastrar_credencial
):
    # Arrange — duas categorias diferentes e uma credencial sem categoria.
    # Títulos "A/B/C" controlam a ordem alfabética esperada da lista.
    termo = termo_unico()
    trabalho, pessoal = f"Trabalho{termo}", f"Pessoal{termo}"
    a = cadastrar_credencial(replace(nova_credencial(), titulo=f"A {termo}", categoria=trabalho))
    b = cadastrar_credencial(replace(nova_credencial(), titulo=f"B {termo}", categoria=pessoal))
    c = cadastrar_credencial(nova_credencial(titulo=f"C {termo}"))

    # Act + Assert em etapas: filtrar e depois desfazer o filtro.
    # A lista é redesenhada um instante depois do toque no chip; por isso
    # aguardar_titulos (com nova tentativa) em vez de uma leitura única.
    cofre_aberto.filtrar_por_categoria(trabalho)
    so_trabalho = [a.titulo]
    assert cofre_aberto.aguardar_titulos(so_trabalho) == so_trabalho, (
        "o filtro deveria mostrar só a categoria escolhida"
    )

    cofre_aberto.mostrar_todas_as_categorias()
    todas = [a.titulo, b.titulo, c.titulo]
    assert cofre_aberto.aguardar_titulos(todas) == todas, "'Todas' deveria voltar tudo"


@allure.feature("Credenciais")
@allure.story("H4.4 — busca não persistida")
def test_busca_nao_fica_salva_depois_de_trancar(
    driver, cofre_aberto, cadastrar_credencial, senha_mestra
):
    # Arrange — busca ativa filtrando a lista para uma credencial.
    termo = termo_unico()
    a = cadastrar_credencial(nova_credencial(titulo=f"A {termo}"))
    b = cadastrar_credencial(nova_credencial(titulo=f"B {termo[::-1]}"))
    cofre_aberto.buscar(termo)
    assert cofre_aberto.aguardar_titulos([a.titulo]) == [a.titulo], "pré-condição: a busca deveria filtrar"

    # Act
    cofre_aberto.trancar()
    DesbloqueioPage(driver).desbloquear(senha_mestra)

    # Assert — o termo de busca é dado sensível de uso (diz o que a pessoa
    # procurou); não pode sobreviver ao trancar. A lista volta completa.
    assert cofre_aberto.titulos() == [a.titulo, b.titulo]
