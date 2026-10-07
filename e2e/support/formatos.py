"""Formatos esperados de dados exibidos pelo app, compartilhados entre testes."""

import re

# Chave de recuperação (H2.1): 32 bytes em hex = 64 dígitos, exibidos em 16
# blocos de 4 separados por traço.
FORMATO_CHAVE_RECUPERACAO = re.compile(r"^[0-9a-f]{4}(-[0-9a-f]{4}){15}$")
