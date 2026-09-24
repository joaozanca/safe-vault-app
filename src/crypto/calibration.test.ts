// calibration.ts importa kdf.ts, que importa react-native-argon2 — mesmo que
// a gente injete deriveKeyFn e nunca chame o deriveKey de verdade, o simples
// `import` de kdf.ts já executa o index.js do módulo nativo, que quebra fora
// de um device/emulador real. Precisa deste mock aqui também (não só em
// kdf.test.ts), pela mesma razão: import é avaliado antes de qualquer
// código do teste rodar.
jest.mock('react-native-argon2', () => jest.fn());

import { ARGON2_FLOOR } from './kdf';
import { calibrateParams, MAX_ITERATIONS, TARGET_MS } from './calibration';

/**
 * `calibrateParams` mede tempo real (Date.now) e chama um módulo nativo
 * (deriveKey -> react-native-argon2). Nenhum dos dois é determinístico nem
 * rápido o bastante para um teste unitário confiável. Em vez de usar timers
 * de verdade, injetamos as duas dependências (deps.now, deps.deriveKeyFn)
 * com dublês que devolvem exatamente os valores que cada cenário precisa —
 * o teste fica instantâneo e 100% previsível.
 */

function fakeClock(...timestamps: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= timestamps.length) {
      throw new Error('fakeClock: now() chamado mais vezes do que o teste previu');
    }
    return timestamps[i++];
  };
}

describe('calibrateParams', () => {
  it('device lento: piso já >= TARGET_MS, aceita e para sem tentar subir custo', async () => {
    const deriveKeyFn = jest.fn().mockResolvedValue(new Uint8Array(32));
    // uma única medição: início em 0, fim em TARGET_MS (limite exato conta como "lento")
    const now = fakeClock(0, TARGET_MS);

    const result = await calibrateParams(new Uint8Array([1]), { deriveKeyFn, now });

    expect(result.params).toEqual(ARGON2_FLOOR);
    expect(result.elapsedMs).toBe(TARGET_MS);
    expect(deriveKeyFn).toHaveBeenCalledTimes(1);
  });

  it('device com folga: sobe iterations até chegar perto do alvo', async () => {
    const deriveKeyFn = jest.fn().mockResolvedValue(new Uint8Array(32));
    // piso: 300ms (rápido, elapsed = 300-0) -> sobe para iterations 3: 700ms
    // (elapsed = 1000-300 == TARGET_MS) -> para, porque essa medição já não é
    // mais "< alvo".
    const now = fakeClock(
      0,
      300, // medição do piso: elapsed = 300ms
      300,
      1000, // medição com iterations 3: elapsed = 700ms
    );

    const result = await calibrateParams(new Uint8Array([1]), { deriveKeyFn, now });

    expect(result.params).toEqual({ ...ARGON2_FLOOR, iterations: 3 });
    expect(result.elapsedMs).toBe(TARGET_MS);
    expect(deriveKeyFn).toHaveBeenCalledTimes(2);
  });

  it('nunca aceita um candidato que estoura 1,5x o alvo — fica com o último bom', async () => {
    const deriveKeyFn = jest.fn().mockResolvedValue(new Uint8Array(32));
    // piso: 200ms (rápido) -> tenta iterations 3: 1300ms (> 1,5x de 700 = 1050) -> descarta e para
    const now = fakeClock(0, 200, 200, 1500);

    const result = await calibrateParams(new Uint8Array([1]), { deriveKeyFn, now });

    expect(result.params).toEqual(ARGON2_FLOOR);
    expect(result.elapsedMs).toBe(200);
    expect(deriveKeyFn).toHaveBeenCalledTimes(2);
  });

  it('nunca escala iterations além do teto MAX_ITERATIONS, mesmo com device muito rápido', async () => {
    const deriveKeyFn = jest.fn().mockResolvedValue(new Uint8Array(32));
    // sempre "instantâneo" (1ms) — sem teto, isto subiria iterations pra sempre.
    const chamadas = 1 + (MAX_ITERATIONS - ARGON2_FLOOR.iterations);
    const now = fakeClock(...Array.from({ length: chamadas * 2 }, (_, i) => i));

    const result = await calibrateParams(new Uint8Array([1]), { deriveKeyFn, now });

    expect(result.params.iterations).toBe(MAX_ITERATIONS);
    expect(deriveKeyFn).toHaveBeenCalledTimes(chamadas);
  });

  it('nunca usa memória ou paralelismo abaixo do piso, em nenhum cenário', async () => {
    const deriveKeyFn = jest.fn().mockResolvedValue(new Uint8Array(32));
    const now = fakeClock(0, 300, 300, 1000);

    const result = await calibrateParams(new Uint8Array([1]), { deriveKeyFn, now });

    expect(result.params.memoryKiB).toBe(ARGON2_FLOOR.memoryKiB);
    expect(result.params.parallelism).toBe(ARGON2_FLOOR.parallelism);
  });
});
