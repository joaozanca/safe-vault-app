"""Indicador de força (H4.2) e alerta de senha repetida (H4.3)."""

from dataclasses import replace

import allure
import pytest

from pages.formulario_credencial_page import FormularioCredencialPage
from support.dados import nova_credencial, termo_unico


@allure.feature("Senhas")
@allure.story("H4.2 — indicador de força da senha")
@pytest.mark.parametrize(
    "senha, forca",
    [
        ("abc123", "Fraca"),  # menos de 8 caracteres
        ("abcdefgh", "Fraca"),  # 8 caracteres, 1 classe
        ("abcdefg1", "Média"),  # 8 caracteres, 2 classes
        ("Abcdefghijklmn1", "Média"),  # 15 caracteres, 3 classes: 1 abaixo do limite
        ("Abcdefghijklmno1", "Forte"),  # 16 caracteres, 3 classes: exatamente no limite
    ],
    ids=["curta", "uma-classe", "duas-classes", "15-caracteres", "16-caracteres"],
)
def test_indicador_mostra_a_forca_da_senha_digitada(driver, cofre_aberto, senha, forca):
    # Arrange — senhas fixas DE PROPÓSITO: cada uma representa uma regra da
    # heurística; uma aleatória poderia cair em outra faixa.
    cofre_aberto.nova_credencial()
    formulario = FormularioCredencialPage(driver)

    # Act
    formulario.digitar_senha(senha)

    # Assert
    assert formulario.forca_da_senha() == f"Força: {forca}"


@allure.feature("Senhas")
@allure.story("H4.3 — alerta de senha repetida")
def test_mesma_senha_em_duas_credenciais_gera_aviso_com_os_titulos(
    cofre_aberto, cadastrar_credencial
):
    # Arrange — duas credenciais com a mesma senha e uma terceira diferente.
    # Títulos controlados ("A"/"B"): o aviso lista em ordem alfabética, e um
    # título sorteado com acento tornaria a ordem esperada incerta.
    termo = termo_unico()
    senha_repetida = nova_credencial().senha
    a = cadastrar_credencial(replace(nova_credencial(), titulo=f"A {termo}", senha=senha_repetida))
    b = cadastrar_credencial(replace(nova_credencial(), titulo=f"B {termo}", senha=senha_repetida))
    cadastrar_credencial()

    # Act
    avisos = cofre_aberto.avisos_de_senha_repetida()

    # Assert — um aviso só (a terceira não entra), com quantidade e títulos,
    # e NUNCA a senha em si: o aviso não pode virar um vazamento.
    assert avisos == [f"⚠ 2 credenciais com a mesma senha: {a.titulo}, {b.titulo}"]
    assert senha_repetida not in avisos[0], "o aviso não pode exibir a senha repetida"


@allure.feature("Senhas")
@allure.story("H4.3 — alerta de senha repetida")
def test_senhas_diferentes_nao_geram_aviso(cofre_aberto, cadastrar_credencial):
    # Arrange — duas credenciais, cada uma com a sua senha (Faker, 20 caracteres).
    cadastrar_credencial()
    cadastrar_credencial()

    # Act + Assert
    assert cofre_aberto.avisos_de_senha_repetida() == []
