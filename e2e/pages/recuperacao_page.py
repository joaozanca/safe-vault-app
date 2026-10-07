from pages.base_page import BasePage


class RecuperacaoPage(BasePage):
    """Tela "Entrar com a chave de recuperação" (H2.2)."""

    CHAVE = "unlock.recovery.key-input"
    NOVA_SENHA = "unlock.recovery.password-input.new"
    CONFIRMACAO = "unlock.recovery.password-input.confirm"
    BOTAO_ENTRAR = "unlock.recovery.submit-button"
    MENSAGEM_ERRO = "unlock.recovery.error-message"

    def esta_aberta(self) -> bool:
        return self.esta_visivel(self.BOTAO_ENTRAR, timeout=15)

    def recuperar(self, chave: str, nova_senha: str) -> None:
        self.digitar(self.CHAVE, chave)
        self.digitar(self.NOVA_SENHA, nova_senha)
        self.digitar(self.CONFIRMACAO, nova_senha)
        self.tocar(self.BOTAO_ENTRAR)

    def mensagem_erro(self) -> str:
        return self.texto_de(self.MENSAGEM_ERRO)
