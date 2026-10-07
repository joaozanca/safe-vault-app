"""Busca na lista de credenciais (H4.4)."""

import allure

from support.dados import nova_credencial, termo_unico


@allure.feature("Credenciais")
@allure.story("H4.4 — busca")
def test_buscar_por_parte_do_titulo_mostra_so_a_credencial_correspondente(
    cofre_aberto, cadastrar_credencial
):
    # Arrange — duas credenciais; só a "alvo" tem o termo no título. O termo é
    # aleatório (não um nome fixo) para nunca coincidir com o título da outra.
    termo = termo_unico()
    alvo = cadastrar_credencial(nova_credencial(titulo=f"Conta {termo}"))
    cadastrar_credencial()

    # Act — busca só por PARTE do título (o termo, sem o "Conta").
    cofre_aberto.buscar(termo)

    # Assert — exatamente a alvo: pega tanto "busca não filtrou" (2 itens)
    # quanto "filtrou demais" (lista vazia).
    assert cofre_aberto.aguardar_titulos([alvo.titulo]) == [alvo.titulo]


@allure.feature("Credenciais")
@allure.story("H4.4 — busca")
def test_buscar_termo_inexistente_esvazia_a_lista(cofre_aberto, cadastrar_credencial):
    # Arrange — duas credenciais, para a lista vazia ser efeito da busca e não
    # de um cofre sem nada.
    cadastrar_credencial()
    cadastrar_credencial()

    # Act
    cofre_aberto.buscar(termo_unico())

    # Assert
    assert cofre_aberto.aguardar_titulos([]) == [], "termo que não existe não pode trazer resultado"
