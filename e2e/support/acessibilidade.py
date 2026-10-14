"""Auditoria automática de acessibilidade pela árvore da tela (H5.4).

Regras (Android / WCAG 2.1):
- área de toque de todo controle tocável ≥ 48 × 48 dp;
- todo controle tocável tem nome para o leitor de tela (TalkBack): texto
  próprio, texto de um filho ou rótulo de acessibilidade (`content-desc`);
- nenhum texto ou controle do app fica POR BAIXO da barra de status (desde o
  Android 15 o app é desenhado atrás dela; defeito da v1.0.0);
- controles obrigatórios da tela são ALCANÇÁVEIS: visíveis ou, numa tela
  rolável, alcançáveis rolando. Um controle fora da tela nem aparece na
  árvore — a regra de tamanho sozinha não o pegaria.
"""

import re
import xml.etree.ElementTree as ET

from pages.base_page import aguardar_rolagem_assentar, por_test_id_rolando
from support import config

ALVO_MINIMO_DP = 48


def _densidade(driver) -> float:
    """Pixels por dp do aparelho (ex.: 420 dpi → 2,625)."""
    saida = driver.execute_script("mobile: deviceInfo")
    return saida["displayDensity"] / 160


def _fim_da_barra_de_status(driver) -> int:
    """Coordenada (px) onde a barra de status termina, segundo o Android."""
    barras = driver.execute_script("mobile: getSystemBars")
    barra = barras.get("statusBar", {})
    return int(barra.get("y", 0)) + int(barra.get("height", 0)) if barra.get("visible", True) else 0


def _limites(el) -> list[int]:
    return list(map(int, re.findall(r"\d+", el.get("bounds", "[0,0][0,0]"))))


def _cortado_pela_rolagem(el, pais: dict, y1: int, y2: int) -> bool:
    """O elemento encosta na borda de cima/baixo de um contêiner rolável?"""
    pai = pais.get(el)
    while pai is not None:
        if pai.get("scrollable") == "true":
            _, topo, _, base = _limites(pai)
            return y1 <= topo or y2 >= base
        pai = pais.get(pai)
    return False


def violacoes(driver, tela: str, obrigatorios: tuple[str, ...] = ()) -> list[str]:
    """Problemas de acessibilidade da tela atual, um texto por controle.

    `obrigatorios`: testIDs que precisam estar visíveis nesta tela.
    """
    px_por_dp = _densidade(driver)
    fim_barra_status = _fim_da_barra_de_status(driver)
    raiz = ET.fromstring(driver.page_source.encode("utf-8"))
    problemas = []
    pais = {filho: pai for pai in raiz.iter() for filho in pai}
    for el in raiz.iter():
        tocavel = el.get("clickable") == "true" or el.get("checkable") == "true"
        if not tocavel or el.get("package") != config.APP_PACKAGE:
            continue
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", el.get("bounds", "[0,0][0,0]")))
        largura, altura = round((x2 - x1) / px_por_dp), round((y2 - y1) / px_por_dp)
        nome = el.get("content-desc") or " ".join(filter(None, (d.get("text") for d in el.iter())))
        identificacao = el.get("resource-id") or nome[:30] or el.get("class")
        # Cortado pela borda de cima/baixo da área rolável = parte dele está
        # fora da área visível; a altura medida não é a real. A borda é a do
        # contêiner rolável, não a da tela: o app termina acima das barras.
        cortado_na_vertical = _cortado_pela_rolagem(el, pais, y1, y2)
        if largura < ALVO_MINIMO_DP or (altura < ALVO_MINIMO_DP and not cortado_na_vertical):
            problemas.append(f"[{tela}] {identificacao}: área de toque {largura}x{altura} dp (mínimo 48x48)")
        if not nome.strip():
            problemas.append(f"[{tela}] {identificacao}: sem nome para o leitor de tela")
    # Conteúdo sob a barra de status: qualquer texto ou controle do app que
    # comece acima do fim dela (o relógio e a câmera ficam por cima).
    for el in raiz.iter():
        if el.get("package") != config.APP_PACKAGE:
            continue
        tem_conteudo = bool(el.get("text") or el.get("content-desc")) or el.get("clickable") == "true"
        if not tem_conteudo:
            continue
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", el.get("bounds", "[0,0][0,0]")))
        if y2 > 0 and y1 < fim_barra_status:
            nome = el.get("resource-id") or el.get("text") or el.get("content-desc")
            problemas.append(f"[{tela}] {nome[:40]}: por baixo da barra de status")

    ids_visiveis = {el.get("resource-id") for el in raiz.iter()}
    for test_id in obrigatorios:
        if test_id in ids_visiveis:
            continue
        # Fora da tela: só é problema se nem rolando a pessoa alcança.
        if not driver.find_elements(*por_test_id_rolando(test_id)):
            problemas.append(f"[{tela}] {test_id}: fora da tela e inalcançável (nem rolando)")
            continue
        # A tela fica parada para o próximo passo do teste tocar com segurança.
        aguardar_rolagem_assentar(driver, test_id)
    return problemas
