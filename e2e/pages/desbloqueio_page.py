from pages.base_page import BasePage


class DesbloqueioPage(BasePage):
    SENHA = "unlock.password.password-input"
    BOTAO_DESBLOQUEAR = "unlock.password.submit-button"
    MENSAGEM_ERRO = "unlock.password.error-message"

    def esta_aberta(self) -> bool:
        return self.esta_visivel(self.BOTAO_DESBLOQUEAR, timeout=15)

    def desbloquear(self, senha: str) -> None:
        self.digitar(self.SENHA, senha)
        self.tocar(self.BOTAO_DESBLOQUEAR)

    def mensagem_erro(self) -> str:
        return self.texto_de(self.MENSAGEM_ERRO)
