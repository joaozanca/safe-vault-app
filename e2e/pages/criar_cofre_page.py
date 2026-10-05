from pages.base_page import BasePage


class CriarCofrePage(BasePage):
    SENHA = "vault.create.password-input.master"
    CONFIRMACAO = "vault.create.password-input.confirm"
    BOTAO_CRIAR = "vault.create.submit-button"
    MENSAGEM_ERRO = "vault.create.error-message"

    def esta_aberta(self) -> bool:
        return self.esta_visivel(self.BOTAO_CRIAR, timeout=15)

    def criar(self, senha: str, confirmacao: str | None = None) -> None:
        """Preenche e envia. `confirmacao` diferente da senha serve para os
        cenários negativos; por padrão repete a senha."""
        self.digitar(self.SENHA, senha)
        self.digitar(self.CONFIRMACAO, senha if confirmacao is None else confirmacao)
        self.tocar(self.BOTAO_CRIAR)

    def mensagem_erro(self) -> str:
        return self.texto_de(self.MENSAGEM_ERRO)
