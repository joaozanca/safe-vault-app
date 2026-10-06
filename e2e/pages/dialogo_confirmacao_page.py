from pages.base_page import BasePage


class DialogoConfirmacaoPage(BasePage):
    BOTAO_CONFIRMAR = "common.confirm-dialog.confirm-button"
    BOTAO_CANCELAR = "common.confirm-dialog.cancel-button"

    # Os dois métodos só devolvem o controle depois que o diálogo FECHA: ao
    # confirmar uma exclusão o app fecha o diálogo e recarrega a lista em
    # seguida, e ler a lista antes disso poderia ainda mostrar o item excluído.

    def confirmar(self) -> None:
        self.tocar(self.BOTAO_CONFIRMAR)
        self.aguardar_sumir(self.BOTAO_CONFIRMAR)

    def cancelar(self) -> None:
        self.tocar(self.BOTAO_CANCELAR)
        self.aguardar_sumir(self.BOTAO_CANCELAR)
