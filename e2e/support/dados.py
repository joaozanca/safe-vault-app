"""Massa de dados dinâmica (Faker) — cada teste gera os seus, nada fixo."""

from dataclasses import dataclass

from faker import Faker

fake = Faker("pt_BR")


def senha_mestra_valida() -> str:
    """Senha que atende a política do app: 8+ caracteres, maiúscula,
    minúscula e número, sem acento nem emoji. Os parâmetros do Faker
    garantem pelo menos 1 caractere de cada classe ligada."""
    return fake.password(
        length=16, special_chars=False, digits=True, upper_case=True, lower_case=True
    )


@dataclass(frozen=True)
class Credencial:
    titulo: str
    usuario: str
    senha: str


def termo_unico() -> str:
    """8 letras aleatórias — chance desprezível de aparecer por acaso em outro
    título gerado, então serve de termo de busca que casa com UM item só."""
    return fake.lexify("????????")


def nova_credencial(titulo: str | None = None) -> Credencial:
    """Credencial com dados do Faker. `titulo` permite fixar só o título quando
    o teste depende dele (ex.: busca), mantendo o resto gerado."""
    return Credencial(
        titulo=titulo or f"{fake.company()} {fake.random_int(100, 999)}",
        usuario=fake.user_name(),
        senha=fake.password(length=20),
    )
