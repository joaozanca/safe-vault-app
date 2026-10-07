from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import BasePage, por_test_id
from support.config import TIMEOUT_PADRAO


class DesbloqueioPage(BasePage):
    SENHA = "unlock.password.password-input"
    BOTAO_DESBLOQUEAR = "unlock.password.submit-button"
    MENSAGEM_ERRO = "unlock.password.error-message"

    def esta_aberta(self) -> bool:
        return self.esta_visivel(self.BOTAO_DESBLOQUEAR, timeout=15)

    def desbloquear(self, senha: str) -> None:
        self.digitar(self.SENHA, senha)
        self.tocar(self.BOTAO_DESBLOQUEAR)

    def errar_senha(self, senha_errada: str) -> None:
        """Tenta uma senha errada e só devolve quando a tentativa TERMINOU.

        Enquanto confere a senha, a tela desabilita campo e botão. Sem esperar,
        a próxima tentativa seria digitada num campo travado e se perderia —
        e o teste contaria uma tentativa que o app nunca recebeu.
        """
        self.desbloquear(senha_errada)
        botao = por_test_id(self.BOTAO_DESBLOQUEAR)
        try:
            # 1º: o botão desabilita (conferência começou). A conferência é
            # rápida no emulador e pode acabar antes desta checagem — por isso
            # o timeout curto e o "tudo bem se não viu".
            WebDriverWait(self.driver, 2).until_not(EC.element_to_be_clickable(botao))
        except TimeoutException:
            pass
        # 2º: o botão habilita de novo e a mensagem de erro está na tela.
        WebDriverWait(self.driver, TIMEOUT_PADRAO).until(EC.element_to_be_clickable(botao))
        self.elemento(self.MENSAGEM_ERRO)

    def mensagem_erro(self) -> str:
        return self.texto_de(self.MENSAGEM_ERRO)
