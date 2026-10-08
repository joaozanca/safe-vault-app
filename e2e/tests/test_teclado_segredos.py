"""O teclado não pode aprender segredos (H5.4 / risco R7).

Com sugestões ligadas, o teclado do Android (ex.: Gboard) pode guardar o que
foi digitado no dicionário pessoal — fora da proteção do cofre. Campo de
segredo tem que se apresentar ao teclado como "senha"/"senha visível" ou, no
mínimo (senha revelada, limite do React Native), sem sugestões.
"""

import allure

from pages.criar_cofre_page import CriarCofrePage
from pages.desbloqueio_page import DesbloqueioPage
from pages.recuperacao_page import RecuperacaoPage
from support.dispositivo import descrever_tipo, protege_do_teclado, tipo_do_campo_focado


def _focar_e_ler(pagina, test_id: str) -> int:
    pagina.elemento(test_id).click()
    return tipo_do_campo_focado()


@allure.feature("Segurança")
@allure.story("H5.4 / R7 — teclado sem sugestão nos campos de segredo")
def test_campos_de_segredo_nao_deixam_o_teclado_aprender(driver, cofre_aberto, senha_mestra):
    medicoes: dict[str, int] = {}

    # Senha mestra no desbloqueio: mascarada e depois revelada.
    cofre_aberto.trancar()
    desbloqueio = DesbloqueioPage(driver)
    medicoes["desbloqueio: senha mascarada"] = _focar_e_ler(desbloqueio, desbloqueio.SENHA)
    desbloqueio.tocar("unlock.password.reveal-toggle")
    medicoes["desbloqueio: senha revelada"] = _focar_e_ler(desbloqueio, desbloqueio.SENHA)

    # Chave de recuperação (campo de texto comum, não mascarado).
    desbloqueio.esqueci_a_senha()
    recuperacao = RecuperacaoPage(driver)
    medicoes["recuperação: chave"] = _focar_e_ler(recuperacao, recuperacao.CHAVE)

    problemas = [
        f"{campo}: teclado vê {descrever_tipo(tipo)}"
        for campo, tipo in medicoes.items()
        if not protege_do_teclado(tipo)
    ]
    assert problemas == [], "campos de segredo que deixam o teclado aprender:\n" + "\n".join(problemas)


@allure.feature("Segurança")
@allure.story("H5.4 / R7 — teclado sem sugestão nos campos de segredo")
def test_senha_mestra_revelada_na_criacao_nao_deixa_o_teclado_aprender(driver):
    criar = CriarCofrePage(driver)
    criar.tocar("vault.create.reveal-toggle")

    tipo = _focar_e_ler(criar, criar.SENHA)

    assert protege_do_teclado(tipo), f"teclado vê {descrever_tipo(tipo)}"
