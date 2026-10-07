from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import BasePage


class ListaCredenciaisPage(BasePage):
    LISTA = "creds.list"
    ITEM = "creds.list.item"
    BOTAO_NOVA = "creds.list.add-button"
    BOTAO_TRANCAR = "vault.unlocked.lock-button"
    CAMPO_BUSCA = "creds.list.search-field"
    AVISO_TENTATIVAS = "vault.unlocked.failed-attempts-notice"
    LINHA_AVISO_SENHA_REPETIDA = "creds.list.reuse-warning.item"

    def esta_aberta(self) -> bool:
        return self.esta_visivel(self.LISTA, timeout=15)

    def titulos(self) -> list[str]:
        """Títulos visíveis na lista. Cada item expõe o título como
        `accessibilityLabel`, que no Android vira o atributo `content-desc`."""
        self.elemento(self.LISTA)
        return [item.get_attribute("content-desc") for item in self.elementos(self.ITEM)]

    def aguardar_titulos(self, esperados: list[str], timeout: int = 5) -> list[str]:
        """Relê a lista até ela ficar igual a `esperados` (ou o tempo acabar) e
        devolve a última leitura — o teste faz o assert com ela.

        É o "retry" que o Cypress faz sozinho no `.should()`. Necessário depois
        de ações que filtram a lista na hora (busca, chip de categoria): o app
        redesenha um instante depois do toque, e uma leitura imediata ainda
        pegaria a lista anterior.
        """
        try:
            WebDriverWait(self.driver, timeout, poll_frequency=0.3).until(
                lambda _driver: self.titulos() == esperados
            )
        except TimeoutException:
            pass  # devolve o que está na tela; o assert do teste mostra a diferença
        return self.titulos()

    def aviso_de_tentativas(self) -> str | None:
        """Texto do aviso de tentativas erradas (H1.2), ou None se não há aviso."""
        self.elemento(self.LISTA)  # garante que a tela terminou de abrir antes de concluir "não há"
        if not self.esta_visivel(self.AVISO_TENTATIVAS):
            return None
        return self.texto_de(self.AVISO_TENTATIVAS)

    def avisos_de_senha_repetida(self) -> list[str]:
        """Linhas do aviso de senha repetida (H4.3), uma por grupo; [] se não há aviso.

        Cada linha tem testID próprio: no Android o RN achata o contêiner do
        aviso e as linhas não aparecem como filhas dele na árvore da automação.
        """
        self.elemento(self.LISTA)  # a tela terminou de abrir antes de concluir "não há"
        if not self.esta_visivel(self.LINHA_AVISO_SENHA_REPETIDA):
            return []
        return [linha.text for linha in self.elementos(self.LINHA_AVISO_SENHA_REPETIDA)]

    def nova_credencial(self) -> None:
        self.tocar(self.BOTAO_NOVA)

    def trancar(self) -> None:
        self.tocar(self.BOTAO_TRANCAR)

    def buscar(self, termo: str) -> None:
        self.digitar(self.CAMPO_BUSCA, termo)

    def filtrar_por_categoria(self, categoria: str) -> None:
        """Toca no chip da categoria (o rótulo do chip é o nome dela), H4.4."""
        self.tocar_por_rotulo(categoria)

    def mostrar_todas_as_categorias(self) -> None:
        self.tocar_por_rotulo("Todas")

    def abrir(self, titulo: str) -> None:
        """Abre a credencial para edição tocando na linha dela. O rótulo da
        linha é o próprio título (o do botão de excluir é "Excluir <título>")."""
        self.tocar_por_rotulo(titulo)

    def excluir(self, titulo: str) -> None:
        """Toca no 'Excluir' da linha da credencial com esse título."""
        self.tocar_por_rotulo(f"Excluir {titulo}")
