"""Exemplo de teste de credenciais — modelo para os demais cenários de CRUD."""

import allure
import pytest

from pages.desbloqueio_page import DesbloqueioPage
from pages.formulario_credencial_page import FormularioCredencialPage
from support.dados import nova_credencial


@pytest.mark.smoke
@allure.feature("Credenciais")
@allure.story("H3.1 — cadastrar credencial")
def test_credencial_cadastrada_persiste_apos_trancar_e_destrancar(
    driver, cofre_aberto, senha_mestra
):
    # Arrange — dados gerados na hora (Faker): nenhum teste depende de um
    # título fixo que outro teste poderia ter criado ou apagado.
    credencial = nova_credencial()

    # Act — cadastra, tranca e destranca de novo. Trancar fecha o banco;
    # se a credencial só existisse em memória, sumiria aqui.
    cofre_aberto.nova_credencial()
    formulario = FormularioCredencialPage(driver)
    formulario.preencher(credencial)
    formulario.salvar()
    cofre_aberto.trancar()
    DesbloqueioPage(driver).desbloquear(senha_mestra)

    # Assert — a lista inteira, não só "contém": prova que entrou exatamente
    # uma credencial e com o título certo (sem duplicar no salvar).
    assert cofre_aberto.titulos() == [credencial.titulo]
