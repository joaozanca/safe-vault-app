from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import BasePage
from support.config import TIMEOUT_PADRAO
from support.dados import Credencial


class FormularioCredencialPage(BasePage):
    TITULO = "creds.form.title-input"
    USUARIO = "creds.form.username-input"
    SENHA = "creds.form.password-input"
    URL = "creds.form.url-input"
    NOTAS = "creds.form.notes-input"
    CATEGORIA = "creds.form.category-input"
    BOTAO_REVELAR = "creds.form.reveal-toggle"
    BOTAO_SALVAR = "creds.form.submit-button"
    BOTAO_GERADOR = "creds.form.open-generator-button"
    MENSAGEM_ERRO = "creds.form.error-message"
    FORCA = "creds.form.strength-text"

    def esta_aberta(self) -> bool:
        return self.esta_visivel(self.BOTAO_SALVAR, timeout=15)

    def preencher(self, credencial: Credencial) -> None:
        """Preenche os obrigatórios e, se a credencial trouxer, os opcionais."""
        self.digitar(self.TITULO, credencial.titulo)
        self.digitar(self.USUARIO, credencial.usuario)
        self.digitar(self.SENHA, credencial.senha)
        for campo, valor in (
            (self.URL, credencial.url),
            (self.NOTAS, credencial.notas),
            (self.CATEGORIA, credencial.categoria),
        ):
            if valor is not None:
                self.digitar(campo, valor)

    def alterar_titulo(self, novo_titulo: str) -> None:
        """Troca só o título. No Android o `send_keys` SUBSTITUI o texto do
        campo (não soma ao que já estava), então não precisa limpar antes."""
        self.digitar(self.TITULO, novo_titulo)

    def campos_opcionais(self) -> dict[str, str]:
        """Texto atual de URL, notas e categoria.

        Atenção: num campo VAZIO o Android devolve o placeholder (ex.: "URL
        (opcional)") como texto — use só para campos que se espera preenchidos.
        """
        return {
            "url": self.texto_de(self.URL),
            "notas": self.texto_de(self.NOTAS),
            "categoria": self.texto_de(self.CATEGORIA),
        }

    def senha_esta_mascarada(self) -> bool:
        # Campo de senha do Android expõe o atributo `password` ("true"/"false").
        return self.elemento(self.SENHA).get_attribute("password") == "true"

    def texto_do_campo_senha(self) -> str:
        return self.texto_de(self.SENHA)

    def digitar_senha(self, senha: str) -> None:
        self.digitar(self.SENHA, senha)

    def forca_da_senha(self) -> str:
        """Texto do indicador de força (ex.: "Força: Média"), H4.2."""
        return self.texto_de(self.FORCA)

    def alternar_visibilidade_da_senha(self) -> None:
        """Toca em Mostrar/Ocultar e só devolve quando o campo MUDOU de estado.

        A tela redesenha o campo um instante depois do toque; ler o texto antes
        disso ainda pegaria a máscara (ou a senha) do estado anterior.
        """
        estava_mascarada = self.senha_esta_mascarada()
        self.tocar(self.BOTAO_REVELAR)
        WebDriverWait(self.driver, TIMEOUT_PADRAO).until(
            lambda _d: self.senha_esta_mascarada() != estava_mascarada
        )

    def abrir_gerador(self) -> None:
        self.tocar(self.BOTAO_GERADOR)

    def salvar(self) -> None:
        self.tocar(self.BOTAO_SALVAR)

    def mensagem_erro(self) -> str:
        return self.texto_de(self.MENSAGEM_ERRO)
