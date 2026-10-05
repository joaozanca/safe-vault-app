from pages.base_page import BasePage
from support.dados import Credencial


class FormularioCredencialPage(BasePage):
    TITULO = "creds.form.title-input"
    USUARIO = "creds.form.username-input"
    SENHA = "creds.form.password-input"
    BOTAO_SALVAR = "creds.form.submit-button"
    MENSAGEM_ERRO = "creds.form.error-message"

    def preencher(self, credencial: Credencial) -> None:
        self.digitar(self.TITULO, credencial.titulo)
        self.digitar(self.USUARIO, credencial.usuario)
        self.digitar(self.SENHA, credencial.senha)

    def salvar(self) -> None:
        self.tocar(self.BOTAO_SALVAR)
