import { ARGON2_FLOOR, Argon2Params, deriveKey } from './kdf';

/**
 * Resultado de uma medição: os parâmetros usados e quanto tempo levaram.
 */
export interface CalibrationResult {
  params: Argon2Params;
  elapsedMs: number;
}

/** Tempo de conforto ao destravar o cofre (arquitetura.md seção 4). */
export const TARGET_MS = 700;

/**
 * Teto de segurança para `iterations` — sem isso, um device muito rápido
 * ficaria escalando o custo indefinidamente em busca de 700ms.
 */
export const MAX_ITERATIONS = 6;

/** Senha só usada para medir tempo — nunca deriva uma chave real com ela. */
const CALIBRATION_PASSWORD = '__safevault_calibration__';

/**
 * Injeção de dependências para testes: permite substituir `deriveKey` (que
 * chama um módulo nativo) e a fonte de tempo por dublês determinísticos, sem
 * precisar de timers reais nem de um device de verdade rodando o Jest.
 */
export interface CalibrationDeps {
  deriveKeyFn?: typeof deriveKey;
  now?: () => number;
}

/**
 * Mede quanto tempo o Argon2id leva neste device no piso mínimo (H1.1) e,
 * se sobrar folga, escala `iterations` até chegar perto de `TARGET_MS` — sem
 * nunca ir abaixo do piso e sem nunca recusar o device por ele ser lento
 * (decisão do refinamento da Sprint 1: "aceita mesmo assim, só mais lento").
 *
 * Retorna os `params` a usar de fato na derivação da chave real (uma segunda
 * chamada a `deriveKey`, feita por quem chama esta função — a calibração em
 * si só mede, nunca deriva a chave definitiva).
 */
export async function calibrateParams(
  salt: Uint8Array,
  deps: CalibrationDeps = {},
): Promise<CalibrationResult> {
  const derive = deps.deriveKeyFn ?? deriveKey;
  const now = deps.now ?? Date.now;

  const measure = async (params: Argon2Params): Promise<CalibrationResult> => {
    const start = now();
    await derive(CALIBRATION_PASSWORD, salt, params);
    return { params, elapsedMs: now() - start };
  };

  let best = await measure(ARGON2_FLOOR);

  // Device já lento no piso: aceitamos e paramos aqui. Nunca vamos abaixo do
  // piso, então não há "mais fraco" para oferecer — só mais devagar, e isso
  // é uma escolha consciente, não um bug.
  if (best.elapsedMs >= TARGET_MS) {
    return best;
  }

  // Device com folga: sobe iterations um passo de cada vez (mantendo memória
  // e paralelismo no piso) até chegar perto do alvo de conforto ou bater o
  // teto de segurança. Escalar iterations em vez de memória é a escolha mais
  // previsível de medir sem arriscar estourar a memória do aparelho.
  let iterations = ARGON2_FLOOR.iterations;
  while (iterations < MAX_ITERATIONS && best.elapsedMs < TARGET_MS) {
    iterations += 1;
    const candidate: Argon2Params = { ...ARGON2_FLOOR, iterations };
    const measured = await measure(candidate);

    // Passou muito do alvo (1,5x): o passo anterior já era o ideal, para
    // sem aceitar este candidato.
    if (measured.elapsedMs > TARGET_MS * 1.5) {
      break;
    }
    best = measured;
  }

  return best;
}
