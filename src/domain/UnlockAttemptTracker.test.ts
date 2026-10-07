// Mesmo dublê funcional de secureStore.test.ts — o auto-mock do jest-expo
// pra expo-secure-store não guarda estado, precisa de um Map de verdade por
// trás pra testar round-trip.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import {
  consumirAvisoDeTentativas,
  getLockoutState,
  recordFailedAttempt,
  recordSuccessfulUnlock,
  remainingLockoutMs,
} from './UnlockAttemptTracker';

const NOW = 1_700_000_000_000; // qualquer epoch fixo, só precisa ser estável
const fixedNow = () => NOW;

describe('UnlockAttemptTracker', () => {
  // O dublê de expo-secure-store guarda estado num Map que sobrevive entre
  // testes deste arquivo (não é recriado a cada `it`) — sem isto, as
  // tentativas de um teste se somariam às do teste seguinte. Reaproveita a
  // própria função que estamos testando para zerar: mata dois coelhos, já
  // que recordSuccessfulUnlock() também precisa ser exercitada.
  beforeEach(async () => {
    await recordSuccessfulUnlock();
    // E descarta o aviso que esse zerar possa ter gerado (H1.2), pelo mesmo motivo.
    await consumirAvisoDeTentativas();
  });

  it('estado inicial: zero tentativas, sem bloqueio', async () => {
    const state = await getLockoutState();
    expect(state).toEqual({ failedCount: 0, lockedUntil: null });
    expect(remainingLockoutMs(state, NOW)).toBe(0);
  });

  it('4 tentativas erradas: conta, mas não bloqueia', async () => {
    let state;
    for (let i = 0; i < 4; i++) {
      state = await recordFailedAttempt({ now: fixedNow });
    }
    expect(state).toEqual({ failedCount: 4, lockedUntil: null });
  });

  it('a 5ª tentativa errada bloqueia por 30s (bloco 1)', async () => {
    let state;
    for (let i = 0; i < 5; i++) {
      state = await recordFailedAttempt({ now: fixedNow });
    }
    expect(state!.failedCount).toBe(5);
    expect(state!.lockedUntil).toBe(NOW + 30_000);
    expect(remainingLockoutMs(state!, NOW)).toBe(30_000);
  });

  it('bloco 2 (10ª errada) dobra para 1 minuto', async () => {
    let state;
    for (let i = 0; i < 10; i++) {
      state = await recordFailedAttempt({ now: fixedNow });
    }
    expect(state!.lockedUntil).toBe(NOW + 60_000);
  });

  it('bloco 5 (25ª errada) chega a 8 minutos', async () => {
    let state;
    for (let i = 0; i < 25; i++) {
      state = await recordFailedAttempt({ now: fixedNow });
    }
    expect(state!.lockedUntil).toBe(NOW + 8 * 60_000);
  });

  it('bloco 6 em diante trava em 15 minutos, nunca passa disso', async () => {
    let state;
    for (let i = 0; i < 35; i++) {
      state = await recordFailedAttempt({ now: fixedNow });
    }
    expect(state!.lockedUntil).toBe(NOW + 15 * 60_000);
  });

  it('remainingLockoutMs devolve 0 quando o bloqueio já venceu', () => {
    const state = { failedCount: 5, lockedUntil: NOW - 1 };
    expect(remainingLockoutMs(state, NOW)).toBe(0);
  });

  it('recordSuccessfulUnlock zera tudo, mesmo depois de bloqueado', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt({ now: fixedNow });
    }
    await recordSuccessfulUnlock();

    const state = await getLockoutState();
    expect(state).toEqual({ failedCount: 0, lockedUntil: null });
  });

  describe('aviso de tentativas erradas (H1.2)', () => {
    it('entrar depois de 3 erradas avisa 3, uma vez só', async () => {
      for (let i = 0; i < 3; i++) await recordFailedAttempt({ now: fixedNow });
      await recordSuccessfulUnlock();

      expect(await consumirAvisoDeTentativas()).toBe(3);
      expect(await consumirAvisoDeTentativas()).toBe(0);
    });

    it('entrar sem nenhuma errada não gera aviso', async () => {
      await recordSuccessfulUnlock();

      expect(await consumirAvisoDeTentativas()).toBe(0);
    });

    it('conta as erradas de todos os blocos de bloqueio, não só do último', async () => {
      for (let i = 0; i < 7; i++) await recordFailedAttempt({ now: fixedNow });
      await recordSuccessfulUnlock();

      expect(await consumirAvisoDeTentativas()).toBe(7);
    });

    it('aviso ainda não exibido soma com as erradas da entrada seguinte', async () => {
      // Ex.: o app fechou entre entrar e a tela principal mostrar o aviso.
      for (let i = 0; i < 2; i++) await recordFailedAttempt({ now: fixedNow });
      await recordSuccessfulUnlock();
      await recordFailedAttempt({ now: fixedNow });
      await recordSuccessfulUnlock();

      expect(await consumirAvisoDeTentativas()).toBe(3);
    });
  });
});
