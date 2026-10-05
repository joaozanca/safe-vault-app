"""Base de todos os Page Objects: como achar, esperar e interagir com elementos.

Regra do projeto (mesma do POM no Cypress): Page Object expõe AÇÕES e LEITURAS,
nunca asserções — quem decide se o resultado está certo é o teste.
"""

from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from support.config import TIMEOUT_PADRAO


def por_test_id(test_id: str) -> tuple[str, str]:
    """Localizador por `testID` do React Native.

    No Android o `testID` vira o `resource-id` do elemento, mas SEM o prefixo
    `pacote:id/` que o localizador `AppiumBy.ID` espera — por isso a busca é
    feita pelo UiSelector, que compara o resource-id exatamente como está.
    Equivale ao `cy.get('[data-testid=...]')` do Cypress.
    """
    return (AppiumBy.ANDROID_UIAUTOMATOR, f'new UiSelector().resourceId("{test_id}")')


class BasePage:
    def __init__(self, driver):
        self.driver = driver

    def elemento(self, test_id: str, timeout: int = TIMEOUT_PADRAO):
        """Espera o elemento existir e o devolve (espera explícita, nada de sleep)."""
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located(por_test_id(test_id))
        )

    def elementos(self, test_id: str) -> list:
        """Todos os elementos com o testID, sem esperar (lista vazia é válida)."""
        return self.driver.find_elements(*por_test_id(test_id))

    def tocar(self, test_id: str) -> None:
        self.elemento(test_id).click()

    def digitar(self, test_id: str, texto: str) -> None:
        self.elemento(test_id).send_keys(texto)
        self._esconder_teclado()

    def texto_de(self, test_id: str) -> str:
        return self.elemento(test_id).text

    def esta_visivel(self, test_id: str, timeout: int = 3) -> bool:
        """Leitura booleana para o teste decidir — não falha sozinho."""
        try:
            self.elemento(test_id, timeout)
            return True
        except TimeoutException:
            return False

    def _esconder_teclado(self) -> None:
        # O teclado aberto cobre os botões da parte de baixo da tela; fechar
        # depois de digitar evita o toque cair no teclado em vez do botão.
        if self.driver.is_keyboard_shown():
            self.driver.hide_keyboard()
