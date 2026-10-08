import { StyleSheet } from 'react-native';

/**
 * Regras de acessibilidade compartilhadas pelas telas (H5.4), num lugar só.
 *
 * Origem dos números: auditoria de 2026-10-08 (97 elementos tocáveis em 12
 * telas) — a maioria dos links e botões tinha área de toque entre 18 e 40 dp,
 * e o placeholder dos campos tinha contraste de 3,07:1.
 */

/** Área de toque mínima recomendada pelo Android (e WCAG 2.5.5): 48 × 48 dp. */
export const ALVO_DE_TOQUE_MINIMO_DP = 48;

/** Placeholder: 5,71:1 sobre o fundo dos campos (#1e293b) — WCAG pede ≥ 4,5:1. */
export const COR_PLACEHOLDER = '#94a3b8';

export const acessivel = StyleSheet.create({
  /** Todo controle tocável (botão, link, chip, interruptor). */
  alvoDeToque: {
    minHeight: ALVO_DE_TOQUE_MINIMO_DP,
    minWidth: ALVO_DE_TOQUE_MINIMO_DP,
    justifyContent: 'center',
  },
  /** Campos de texto: só a altura (a largura já é a da tela). */
  campo: { minHeight: ALVO_DE_TOQUE_MINIMO_DP },
});
