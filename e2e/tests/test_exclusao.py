"""Exclusão de credencial: o caminho confirmado e o cancelado."""

import allure

from pages.dialogo_confirmacao_page import DialogoConfirmacaoPage


@allure.feature("Credenciais")
@allure.story("H3.1 — excluir credencial")
def test_excluir_credencial_confirmando_remove_da_lista(
    driver, cofre_aberto, credencial_cadastrada
):
    # Arrange — as fixtures já deixaram o cofre aberto com 1 credencial.

    # Act — "Excluir" da linha certa (localizada pelo título) e confirmar.
    cofre_aberto.excluir(credencial_cadastrada.titulo)
    DialogoConfirmacaoPage(driver).confirmar()

    # Assert — lista inteira vazia: prova que saiu a credencial certa e que
    # não sobrou nada (comparar com [] é mais forte que "título não está lá").
    assert cofre_aberto.titulos() == [], "a credencial excluída ainda aparece na lista"


@allure.feature("Credenciais")
@allure.story("H3.1 — excluir credencial")
def test_cancelar_exclusao_mantem_credencial_na_lista(
    driver, cofre_aberto, credencial_cadastrada
):
    # Arrange — as fixtures já deixaram o cofre aberto com 1 credencial.

    # Act — abre o diálogo de exclusão, mas desiste.
    cofre_aberto.excluir(credencial_cadastrada.titulo)
    DialogoConfirmacaoPage(driver).cancelar()

    # Assert — a credencial continua lá, sozinha e com o mesmo título.
    assert cofre_aberto.titulos() == [credencial_cadastrada.titulo], (
        "cancelar o diálogo não pode excluir a credencial"
    )
