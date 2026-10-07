"""Bloqueio de captura de tela (H3.4)."""

import allure
import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait

from support import config
from support.imagem import linhas_com_conteudo

KEYCODE_HOME = 3


@allure.feature("Segurança")
@allure.story("H3.4 — bloqueio de screenshot")
def test_screenshot_do_app_sai_preta_e_a_da_tela_inicial_nao(
    driver, cofre_aberto, cadastrar_credencial
):
    # Arrange — uma credencial na lista garante que HÁ conteúdo para vazar.
    cadastrar_credencial()
    cofre_aberto.elemento(cofre_aberto.ITEM)

    # Act — captura com o app aberto.
    captura_app = driver.get_screenshot_as_png()

    # Assert 1 — FLAG_SECURE: a janela do app sai inteiramente preta.
    com_conteudo, analisadas = linhas_com_conteudo(captura_app)
    assert com_conteudo == 0, f"{com_conteudo} de {analisadas} linhas do app vazaram na captura"

    # Assert 2 — controle positivo: a MESMA medição enxerga conteúdo quando ele
    # existe (tela inicial do Android). Sem isso, uma medição quebrada que
    # sempre diz "preto" passaria. Captura de novo até a tela inicial aparecer
    # na imagem: logo após o Home a captura ainda pega a animação de saída do
    # app (preta), mesmo com o pacote em primeiro plano já trocado.
    driver.press_keycode(KEYCODE_HOME)
    try:
        WebDriverWait(driver, config.TIMEOUT_PADRAO, poll_frequency=1).until(
            lambda d: linhas_com_conteudo(d.get_screenshot_as_png())[0] > 0
        )
    except TimeoutException:
        pytest.fail("controle falhou: a medição não viu conteúdo nem na tela inicial")
