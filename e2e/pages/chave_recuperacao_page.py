from pages.base_page import BasePage


class ChaveRecuperacaoPage(BasePage):
    CHAVE = "vault.recovery.key-text"
    CHECKBOX_GUARDEI = "vault.recovery.confirm-checkbox"
    BOTAO_CONTINUAR = "vault.recovery.submit-button"

    def chave_exibida(self) -> str:
        return self.texto_de(self.CHAVE)

    def marcar_que_guardou(self) -> None:
        self.tocar(self.CHECKBOX_GUARDEI)

    def botao_continuar_habilitado(self) -> bool:
        return self.elemento(self.BOTAO_CONTINUAR).is_enabled()

    def continuar(self) -> None:
        self.tocar(self.BOTAO_CONTINUAR)

    def confirmar_que_guardou(self) -> None:
        self.marcar_que_guardou()
        self.continuar()
