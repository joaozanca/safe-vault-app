"""Análise de screenshots em Python puro (pypng).

Sem Pillow de propósito: a DLL nativa dela é bloqueada pelo Smart App Control
do Windows na máquina do QA; a pypng não tem código nativo.
"""

import png

# Brilho (0–255) acima do qual um pixel conta como "conteúdo visível". Folga
# acima de 0 para não confundir preto com quase-preto de compressão.
LIMIAR_CLARO = 30


def linhas_com_conteudo(png_bytes: bytes, de: float = 0.1, ate: float = 0.9) -> tuple[int, int]:
    """Quantas linhas da faixa [de, ate] da altura têm algum pixel claro.

    A faixa padrão (10%–90%) exclui as barras do sistema (status e navegação
    por gestos), que não pertencem à janela do app e não são afetadas pelo
    FLAG_SECURE. Devolve (linhas_com_conteudo, linhas_analisadas).
    """
    _largura, altura, linhas, _info = png.Reader(bytes=png_bytes).asRGBA8()
    inicio, fim = int(altura * de), int(altura * ate)
    com_conteudo = analisadas = 0
    for y, linha in enumerate(linhas):
        if not inicio <= y < fim:
            continue
        analisadas += 1
        # RGBA: ignora o canal alfa (índice 3 de cada pixel).
        if max(v for i, v in enumerate(linha) if i % 4 != 3) > LIMIAR_CLARO:
            com_conteudo += 1
    return com_conteudo, analisadas
