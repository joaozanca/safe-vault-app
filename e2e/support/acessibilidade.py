"""Auditoria automática de acessibilidade pela árvore da tela (H5.4).

Regras (Android / WCAG 2.1):
- área de toque de todo controle tocável ≥ 48 × 48 dp;
- todo controle tocável tem nome para o leitor de tela (TalkBack): texto
  próprio, texto de um filho ou rótulo de acessibilidade (`content-desc`);
- controles obrigatórios da tela são ALCANÇÁVEIS: visíveis ou, numa tela
  rolável, alcançáveis rolando. Um controle fora da tela nem aparece na
  árvore — a regra de tamanho sozinha não o pegaria.
"""

import re
import xml.etree.ElementTree as ET

from pages.base_page import por_test_id_rolando
from support import config

ALVO_MINIMO_DP = 48


def _densidade(driver) -> float:
    """Pixels por dp do aparelho (ex.: 420 dpi → 2,625)."""
    saida = driver.execute_script("mobile: deviceInfo")
    return saida["displayDensity"] / 160


def violacoes(driver, tela: str, obrigatorios: tuple[str, ...] = ()) -> list[str]:
    """Problemas de acessibilidade da tela atual, um texto por controle.

    `obrigatorios`: testIDs que precisam estar visíveis nesta tela.
    """
    px_por_dp = _densidade(driver)
    altura_tela = driver.get_window_size()["height"]
    raiz = ET.fromstring(driver.page_source.encode("utf-8"))
    problemas = []
    for el in raiz.iter():
        tocavel = el.get("clickable") == "true" or el.get("checkable") == "true"
        if not tocavel or el.get("package") != config.APP_PACKAGE:
            continue
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", el.get("bounds", "[0,0][0,0]")))
        largura, altura = round((x2 - x1) / px_por_dp), round((y2 - y1) / px_por_dp)
        nome = el.get("content-desc") or " ".join(filter(None, (d.get("text") for d in el.iter())))
        identificacao = el.get("resource-id") or nome[:30] or el.get("class")
        # Cortado pela borda de cima/baixo = parte dele está fora da área
        # visível de uma tela rolável; a altura medida não é a real.
        cortado_na_vertical = y1 <= 0 or y2 >= altura_tela - 1
        if largura < ALVO_MINIMO_DP or (altura < ALVO_MINIMO_DP and not cortado_na_vertical):
            problemas.append(f"[{tela}] {identificacao}: área de toque {largura}x{altura} dp (mínimo 48x48)")
        if not nome.strip():
            problemas.append(f"[{tela}] {identificacao}: sem nome para o leitor de tela")
    ids_visiveis = {el.get("resource-id") for el in raiz.iter()}
    for test_id in obrigatorios:
        if test_id in ids_visiveis:
            continue
        # Fora da tela: só é problema se nem rolando a pessoa alcança.
        if not driver.find_elements(*por_test_id_rolando(test_id)):
            problemas.append(f"[{tela}] {test_id}: fora da tela e inalcançável (nem rolando)")
    return problemas
