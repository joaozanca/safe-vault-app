"""Regressão de acessibilidade em todas as telas (H5.4).

Um teste só, percorrendo as telas na ordem de uso, e falhando no fim com a
lista COMPLETA de problemas (não para no primeiro), para a correção ser feita
de uma vez.
"""

import allure
import pytest

from pages.chave_recuperacao_page import ChaveRecuperacaoPage
from pages.criar_cofre_page import CriarCofrePage
from pages.desbloqueio_page import DesbloqueioPage
from pages.dialogo_confirmacao_page import DialogoConfirmacaoPage
from pages.formulario_credencial_page import FormularioCredencialPage
from pages.lista_credenciais_page import ListaCredenciaisPage
from support.acessibilidade import violacoes
from support.dados import nova_credencial_completa
from support.dispositivo import definir_densidade_de_tela, definir_escala_de_fonte

# Botões que a pessoa PRECISA alcançar em cada tela (visíveis ou rolando).
OBRIGATORIOS = {
    "criar cofre": ("vault.create.submit-button", "vault.create.import-link"),
    "chave de recuperação": ("vault.recovery.confirm-checkbox", "vault.recovery.submit-button"),
    "lista vazia": (
        "vault.unlocked.quick-backup-button",
        "vault.unlocked.export-button",
        "vault.unlocked.import-button",
        "settings.main.open-link",
        "vault.unlocked.lock-button",
        "creds.list.add-button",
    ),
    "lista com credencial": ("creds.list.add-button", "vault.unlocked.lock-button"),
    "formulário (nova)": ("creds.form.submit-button", "creds.form.cancel-link"),
    "gerador": ("generator.form.use-button", "generator.form.cancel-link"),
    "formulário (edição)": ("creds.form.submit-button", "creds.form.cancel-link"),
    "diálogo de confirmação": (
        "common.confirm-dialog.confirm-button",
        "common.confirm-dialog.cancel-button",
    ),
    "configurações": ("settings.main.biometric-toggle", "settings.main.back-link"),
    "exportar": ("backup.export.submit-button", "backup.export.cancel-link"),
    "desbloqueio": ("unlock.password.submit-button", "unlock.password.forgot-link"),
    "recuperação": ("unlock.recovery.submit-button", "unlock.recovery.cancel-link"),
}

DENSIDADE_PADRAO = None


@pytest.fixture(
    params=[(1.0, DENSIDADE_PADRAO), (2.0, DENSIDADE_PADRAO), (1.3, 546)],
    ids=["fonte-normal", "fonte-200%", "tela-ampliada"],
)
def ajustes_de_exibicao(request):
    """Fonte do sistema e "Tamanho da tela" com que o teste roda.

    - fonte-200%: fonte no máximo (achado do QA: menu fora da tela).
    - tela-ampliada: fonte 130% + "Tamanho da tela" 30% maior (densidade 420 →
      546), como no aparelho real em que o QA achou o gerador sem o botão
      "Usar" — telas sem rolagem cortavam o que ficava embaixo.

    Vem ANTES de `driver` na assinatura: precisa valer quando o app abre.
    Sempre volta ao padrão no fim, mesmo se o teste falhar.
    """
    escala, densidade = request.param
    definir_escala_de_fonte(escala)
    definir_densidade_de_tela(densidade)
    yield request.param
    definir_escala_de_fonte(1.0)
    definir_densidade_de_tela(None)


def _auditar(driver, tela: str) -> list[str]:
    return violacoes(driver, tela, obrigatorios=OBRIGATORIOS[tela])


@allure.feature("Acessibilidade")
@allure.story("H5.4 — área de toque, nome, fonte grande e tela ampliada")
def test_todas_as_telas_tem_alvos_de_toque_de_48dp_e_controles_com_nome(
    ajustes_de_exibicao, driver, senha_mestra
):
    problemas: list[str] = []

    problemas += _auditar(driver, "criar cofre")
    CriarCofrePage(driver).criar(senha_mestra)
    chave = ChaveRecuperacaoPage(driver)
    chave.chave_exibida()
    problemas += _auditar(driver, "chave de recuperação")
    chave.confirmar_que_guardou()

    lista = ListaCredenciaisPage(driver)
    lista.esta_aberta()
    problemas += _auditar(driver, "lista vazia")

    lista.nova_credencial()
    formulario = FormularioCredencialPage(driver)
    formulario.esta_aberta()
    problemas += _auditar(driver, "formulário (nova)")
    formulario.abrir_gerador()
    formulario.elemento("generator.form.result-text")
    problemas += _auditar(driver, "gerador")
    formulario.tocar("generator.form.cancel-link")

    credencial = nova_credencial_completa()  # com categoria: aparecem os chips de filtro
    formulario.preencher(credencial)
    formulario.salvar()
    lista.elemento(lista.ITEM)
    problemas += _auditar(driver, "lista com credencial")

    lista.abrir(credencial.titulo)
    formulario.elemento(formulario.BOTAO_COPIAR_SENHA)
    problemas += _auditar(driver, "formulário (edição)")
    formulario.tocar("creds.form.cancel-link")

    lista.excluir(credencial.titulo)
    dialogo = DialogoConfirmacaoPage(driver)
    dialogo.elemento(dialogo.BOTAO_CONFIRMAR)
    problemas += _auditar(driver, "diálogo de confirmação")
    dialogo.cancelar()

    lista.tocar("settings.main.open-link")
    lista.elemento("settings.main.biometric-toggle")
    problemas += _auditar(driver, "configurações")
    lista.tocar("settings.main.back-link")

    lista.tocar("vault.unlocked.export-button")
    lista.elemento("backup.export.submit-button")
    problemas += _auditar(driver, "exportar")
    lista.tocar("backup.export.cancel-link")

    lista.trancar()
    desbloqueio = DesbloqueioPage(driver)
    desbloqueio.esta_aberta()
    problemas += _auditar(driver, "desbloqueio")
    desbloqueio.esqueci_a_senha()
    desbloqueio.elemento("unlock.recovery.submit-button")
    problemas += _auditar(driver, "recuperação")

    assert problemas == [], "problemas de acessibilidade:\n" + "\n".join(problemas)
