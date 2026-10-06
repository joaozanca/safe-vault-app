"""Edição de credencial."""

import allure

from pages.formulario_credencial_page import FormularioCredencialPage
from support.dados import nova_credencial


@allure.feature("Credenciais")
@allure.story("H3.1 — editar credencial")
def test_editar_titulo_da_credencial_atualiza_a_lista(
    driver, cofre_aberto, credencial_cadastrada
):
    # Arrange — as fixtures já deixaram o cofre aberto com 1 credencial; só
    # falta o título novo, gerado na hora (Faker) como todo dado de teste.
    novo_titulo = nova_credencial().titulo

    # Act — abre a credencial pela lista, troca só o título e salva.
    cofre_aberto.abrir(credencial_cadastrada.titulo)
    formulario = FormularioCredencialPage(driver)
    formulario.alterar_titulo(novo_titulo)
    formulario.salvar()

    # Assert — lista inteira igual a [novo_titulo] pega os 3 defeitos possíveis
    # de uma vez: não editou (título antigo), duplicou (2 itens) ou salvou errado.
    assert cofre_aberto.titulos() == [novo_titulo]
