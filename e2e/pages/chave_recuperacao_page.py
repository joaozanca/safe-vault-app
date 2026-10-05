from pages.base_page import BasePage


class ChaveRecuperacaoPage(BasePage):
    CHAVE = "vault.recovery.key-text"
    CHECKBOX_GUARDEI = "vault.recovery.confirm-checkbox"
    BOTAO_CONTINUAR = "vault.recovery.submit-button"

    def chave_exibida(self) -> str:
        return self.texto_de(self.CHAVE)

    def confirmar_que_guardou(self) -> None:
        self.tocar(self.CHECKBOX_GUARDEI)
        self.tocar(self.BOTAO_CONTINUAR)
