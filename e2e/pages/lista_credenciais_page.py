from pages.base_page import BasePage


class ListaCredenciaisPage(BasePage):
    LISTA = "creds.list"
    ITEM = "creds.list.item"
    BOTAO_NOVA = "creds.list.add-button"
    BOTAO_TRANCAR = "vault.unlocked.lock-button"
    CAMPO_BUSCA = "creds.list.search-field"
    AVISO_TENTATIVAS = "vault.unlocked.failed-attempts-notice"

    def esta_aberta(self) -> bool:
        return self.esta_visivel(self.LISTA, timeout=15)

    def titulos(self) -> list[str]:
        """Títulos visíveis na lista. Cada item expõe o título como
        `accessibilityLabel`, que no Android vira o atributo `content-desc`."""
        self.elemento(self.LISTA)
        return [item.get_attribute("content-desc") for item in self.elementos(self.ITEM)]

    def aviso_de_tentativas(self) -> str | None:
        """Texto do aviso de tentativas erradas (H1.2), ou None se não há aviso."""
        self.elemento(self.LISTA)  # garante que a tela terminou de abrir antes de concluir "não há"
        if not self.esta_visivel(self.AVISO_TENTATIVAS):
            return None
        return self.texto_de(self.AVISO_TENTATIVAS)

    def nova_credencial(self) -> None:
        self.tocar(self.BOTAO_NOVA)

    def trancar(self) -> None:
        self.tocar(self.BOTAO_TRANCAR)

    def buscar(self, termo: str) -> None:
        self.digitar(self.CAMPO_BUSCA, termo)

    def abrir(self, titulo: str) -> None:
        """Abre a credencial para edição tocando na linha dela. O rótulo da
        linha é o próprio título (o do botão de excluir é "Excluir <título>")."""
        self.tocar_por_rotulo(titulo)

    def excluir(self, titulo: str) -> None:
        """Toca no 'Excluir' da linha da credencial com esse título."""
        self.tocar_por_rotulo(f"Excluir {titulo}")
