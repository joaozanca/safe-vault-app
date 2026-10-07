from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import BasePage, por_test_id
from support.config import TIMEOUT_PADRAO


class DesbloqueioPage(BasePage):
    SENHA = "unlock.password.password-input"
    BOTAO_DESBLOQUEAR = "unlock.password.submit-button"
    MENSAGEM_ERRO = "unlock.password.error-message"
    LINK_ESQUECI = "unlock.password.forgot-link"
    MENSAGEM_BLOQUEIO = "unlock.password.lockout-message"

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

    def mensagem_bloqueio(self) -> str:
        """Mensagem do bloqueio por tentativas, com a contagem regressiva."""
        return self.texto_de(self.MENSAGEM_BLOQUEIO)

    def botao_desbloquear_habilitado(self) -> bool:
        return self.elemento(self.BOTAO_DESBLOQUEAR).is_enabled()

    def aguardar_fim_do_bloqueio(self, timeout: int = 60) -> None:
        """Espera a contagem acabar: a tela tira a mensagem e reabre o botão.

        Em duas fases de propósito. Esperar só "botão habilitado" logo após o
        toque passaria na hora — o botão ainda está habilitado antes de a tela
        processar o bloqueio — e o teste seguiria com o cofre bloqueado.
        """
        self.elemento(self.MENSAGEM_BLOQUEIO)  # 1º: o bloqueio começou na tela
        self.aguardar_sumir(self.MENSAGEM_BLOQUEIO, timeout)  # 2º: a contagem acabou
        WebDriverWait(self.driver, TIMEOUT_PADRAO).until(
            EC.element_to_be_clickable(por_test_id(self.BOTAO_DESBLOQUEAR))
        )

    def esqueci_a_senha(self) -> None:
        self.tocar(self.LINK_ESQUECI)

    def mensagem_erro(self) -> str:
        return self.texto_de(self.MENSAGEM_ERRO)
