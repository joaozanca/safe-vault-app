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


def nova_credencial() -> Credencial:
    return Credencial(
        titulo=f"{fake.company()} {fake.random_int(100, 999)}",
        usuario=fake.user_name(),
        senha=fake.password(length=20),
    )
