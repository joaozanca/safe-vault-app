import re

import allure
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import BasePage
from support.config import TIMEOUT_PADRAO


class GeradorSenhaPage(BasePage):
    RESULTADO = "generator.form.result-text"
    MENSAGEM_ERRO = "generator.form.error-message"
    TAMANHO = "generator.form.length-slider.value-text"
    DIMINUIR = "generator.form.length-slider.decrease-button"
    AUMENTAR = "generator.form.length-slider.increase-button"
    TOGGLE_MAIUSCULAS = "generator.form.uppercase-toggle"
    TOGGLE_MINUSCULAS = "generator.form.lowercase-toggle"
    TOGGLE_NUMEROS = "generator.form.digits-toggle"
    TOGGLE_SIMBOLOS = "generator.form.symbols-toggle"
    TOGGLE_AMBIGUOS = "generator.form.ambiguous-toggle"
    BOTAO_USAR = "generator.form.use-button"

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

    def resultado_exibido(self) -> str:
        """Texto cru do resultado, inclusive o traço de "sem senha"."""
        return self.texto_de(self.RESULTADO)

    def alternar_maiusculas(self) -> None:
        self.tocar(self.TOGGLE_MAIUSCULAS)

    def maiusculas_ligadas(self) -> bool:
        # Switch do Android expõe o estado no atributo `checked` ("true"/"false").
        return self.elemento(self.TOGGLE_MAIUSCULAS).get_attribute("checked") == "true"

    def desligar_todas_as_classes(self) -> None:
        for toggle in (
            self.TOGGLE_MAIUSCULAS,
            self.TOGGLE_MINUSCULAS,
            self.TOGGLE_NUMEROS,
            self.TOGGLE_SIMBOLOS,
        ):
            if self.elemento(toggle).get_attribute("checked") == "true":
                self.tocar(toggle)

    def alternar_excluir_ambiguos(self) -> None:
        self.tocar(self.TOGGLE_AMBIGUOS)

    def tamanho(self) -> int:
        """Número do texto "Tamanho: N"."""
        return int(re.search(r"\d+", self.texto_de(self.TAMANHO)).group())

    def mudar_tamanho(self, passos: int) -> None:
        """Toca `passos` vezes no + (positivo) ou no − (negativo)."""
        botao = self.AUMENTAR if passos > 0 else self.DIMINUIR
        for _ in range(abs(passos)):
            self.tocar(botao)

    def aguardar_tamanho(self, esperado: int, timeout: int = 5) -> int:
        """Relê o tamanho até bater com `esperado` (ou o tempo acabar) e devolve
        a última leitura — a tela atualiza um instante depois de cada toque."""
        try:
            WebDriverWait(self.driver, timeout, poll_frequency=0.3).until(
                lambda _d: self.tamanho() == esperado
            )
        except TimeoutException:
            pass
        return self.tamanho()

    def mensagem_erro(self) -> str:
        return self.texto_de(self.MENSAGEM_ERRO)

    def botao_usar_habilitado(self) -> bool:
        return self.elemento(self.BOTAO_USAR).is_enabled()

    def usar_senha(self) -> None:
        self.tocar(self.BOTAO_USAR)
