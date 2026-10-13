from pages.base_page import BasePage


class ChaveRecuperacaoPage(BasePage):
    CHAVE = "vault.recovery.key-text"
    CHECKBOX_GUARDEI = "vault.recovery.confirm-checkbox"
    BOTAO_CONTINUAR = "vault.recovery.submit-button"
    AVISO_CHAVE_NOVA = "vault.recovery.replaced-warning"

    def chave_exibida(self) -> str:
        return self.texto_de(self.CHAVE)

    def aviso_de_chave_nova(self) -> str | None:
        """Aviso de que esta chave substitui outra (None na criação do cofre)."""
        self.elemento(self.CHAVE)  # a tela terminou de abrir antes de concluir "não há"
        if not self.esta_visivel(self.AVISO_CHAVE_NOVA, timeout=2):
            return None
        return self.texto_de(self.AVISO_CHAVE_NOVA)

    def marcar_que_guardou(self) -> None:
        self.tocar(self.CHECKBOX_GUARDEI)

    def botao_continuar_habilitado(self) -> bool:
        return self.elemento(self.BOTAO_CONTINUAR).is_enabled()

    def continuar(self) -> None:
        self.tocar(self.BOTAO_CONTINUAR)

    def confirmar_que_guardou(self) -> None:
        self.marcar_que_guardou()
        self.continuar()
