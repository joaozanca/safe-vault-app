import allure
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import BasePage
from support.config import TIMEOUT_PADRAO


class GeradorSenhaPage(BasePage):
    RESULTADO = "generator.form.result-text"
    TOGGLE_MAIUSCULAS = "generator.form.uppercase-toggle"

    # Enquanto não há senha, a tela mostra este traço no lugar do resultado.
    SEM_SENHA = "—"

    def senha_gerada(self, diferente_de: str | None = None) -> str:
        """Lê a senha gerada, esperando ela existir.

        Com `diferente_de`, espera também o resultado MUDAR em relação a essa
        senha: o app gera a senha nova um instante DEPOIS de uma opção mudar,
        e ler cedo demais devolveria a senha antiga (gerada com as opções de
        antes).
        """

        def pronta(_driver):
            texto = self.elemento(self.RESULTADO).text
            return texto if texto not in (self.SEM_SENHA, diferente_de) else False

        with allure.step("Ler senha gerada"):
            return WebDriverWait(self.driver, TIMEOUT_PADRAO).until(pronta)

    def alternar_maiusculas(self) -> None:
        self.tocar(self.TOGGLE_MAIUSCULAS)

    def maiusculas_ligadas(self) -> bool:
        # Switch do Android expõe o estado no atributo `checked` ("true"/"false").
        return self.elemento(self.TOGGLE_MAIUSCULAS).get_attribute("checked") == "true"
