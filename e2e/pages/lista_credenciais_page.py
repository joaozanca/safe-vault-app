from pages.base_page import BasePage


class ListaCredenciaisPage(BasePage):
    LISTA = "creds.list"
    ITEM = "creds.list.item"
    BOTAO_NOVA = "creds.list.add-button"
    BOTAO_TRANCAR = "vault.unlocked.lock-button"

    def esta_aberta(self) -> bool:
        return self.esta_visivel(self.LISTA, timeout=15)

    def titulos(self) -> list[str]:
        """Títulos visíveis na lista. Cada item expõe o título como
        `accessibilityLabel`, que no Android vira o atributo `content-desc`."""
        self.elemento(self.LISTA)
        return [item.get_attribute("content-desc") for item in self.elementos(self.ITEM)]

    def nova_credencial(self) -> None:
        self.tocar(self.BOTAO_NOVA)

    def trancar(self) -> None:
        self.tocar(self.BOTAO_TRANCAR)

    def excluir(self, titulo: str) -> None:
        """Toca no 'Excluir' da linha da credencial com esse título."""
        self.tocar_por_rotulo(f"Excluir {titulo}")
