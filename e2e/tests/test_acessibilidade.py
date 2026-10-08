"""Regressão de acessibilidade em todas as telas (H5.4).

Um teste só, percorrendo as telas na ordem de uso, e falhando no fim com a
lista COMPLETA de problemas (não para no primeiro), para a correção ser feita
de uma vez.
"""

import allure

from pages.chave_recuperacao_page import ChaveRecuperacaoPage
from pages.criar_cofre_page import CriarCofrePage
from pages.desbloqueio_page import DesbloqueioPage
from pages.dialogo_confirmacao_page import DialogoConfirmacaoPage
from pages.formulario_credencial_page import FormularioCredencialPage
from pages.lista_credenciais_page import ListaCredenciaisPage
from support.acessibilidade import violacoes
from support.dados import nova_credencial_completa


@allure.feature("Acessibilidade")
@allure.story("H5.4 — área de toque e nome para o leitor de tela")
def test_todas_as_telas_tem_alvos_de_toque_de_48dp_e_controles_com_nome(driver, senha_mestra):
    problemas: list[str] = []

    problemas += violacoes(driver, "criar cofre")
    CriarCofrePage(driver).criar(senha_mestra)
    chave = ChaveRecuperacaoPage(driver)
    chave.chave_exibida()
    problemas += violacoes(driver, "chave de recuperação")
    chave.confirmar_que_guardou()

    lista = ListaCredenciaisPage(driver)
    lista.esta_aberta()
    problemas += violacoes(driver, "lista vazia")

    lista.nova_credencial()
    formulario = FormularioCredencialPage(driver)
    formulario.esta_aberta()
    problemas += violacoes(driver, "formulário (nova)")
    formulario.abrir_gerador()
    formulario.elemento("generator.form.result-text")
    problemas += violacoes(driver, "gerador")
    formulario.tocar("generator.form.cancel-link")

    credencial = nova_credencial_completa()  # com categoria: aparecem os chips de filtro
    formulario.preencher(credencial)
    formulario.salvar()
    lista.elemento(lista.ITEM)
    problemas += violacoes(driver, "lista com credencial")

    lista.abrir(credencial.titulo)
    formulario.elemento(formulario.BOTAO_COPIAR_SENHA)
    problemas += violacoes(driver, "formulário (edição)")
    formulario.tocar("creds.form.cancel-link")

    lista.excluir(credencial.titulo)
    dialogo = DialogoConfirmacaoPage(driver)
    dialogo.elemento(dialogo.BOTAO_CONFIRMAR)
    problemas += violacoes(driver, "diálogo de confirmação")
    dialogo.cancelar()

    lista.tocar("settings.main.open-link")
    lista.elemento("settings.main.biometric-toggle")
    problemas += violacoes(driver, "configurações")
    lista.tocar("settings.main.back-link")

    lista.tocar("vault.unlocked.export-button")
    lista.elemento("backup.export.submit-button")
    problemas += violacoes(driver, "exportar")
    lista.tocar("backup.export.cancel-link")

    lista.trancar()
    desbloqueio = DesbloqueioPage(driver)
    desbloqueio.esta_aberta()
    problemas += violacoes(driver, "desbloqueio")
    desbloqueio.esqueci_a_senha()
    desbloqueio.elemento("unlock.recovery.submit-button")
    problemas += violacoes(driver, "recuperação")

    assert problemas == [], "problemas de acessibilidade:\n" + "\n".join(problemas)
