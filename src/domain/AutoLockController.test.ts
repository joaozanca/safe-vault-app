import { iniciarAutoLock, AUTO_LOCK_TIMEOUT_MS, type AppStateLike } from './AutoLockController';

/** `now` controlável manualmente — avança em sincronia com os timers falsos do Jest. */
function criarRelogioFalso(inicial = 0) {
  let tempo = inicial;
  return {
    now: () => tempo,
    avancar(ms: number) {
      tempo += ms;
      jest.advanceTimersByTime(ms);
    },
    /** Avança o relógio sem avançar os timers falsos — simula o Android suspendendo o JS em background. */
    avancarSoRelogio(ms: number) {
      tempo += ms;
    },
  };
}

function criarAppStateFalso(): { appState: AppStateLike; mudarPara: (state: string) => void } {
  let listener: ((state: string) => void) | null = null;
  const appState: AppStateLike = {
    addEventListener: jest.fn((_type: 'change', l: (state: string) => void) => {
      listener = l;
      return { remove: jest.fn() };
    }),
  };
  return { appState, mudarPara: (state: string) => listener?.(state) };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('timer de primeiro plano', () => {
  it('não tranca antes do timeout', () => {
    const relogio = criarRelogioFalso();
    const { appState } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    relogio.avancar(AUTO_LOCK_TIMEOUT_MS - 1);

    expect(aoTrancar).not.toHaveBeenCalled();
  });

  it('tranca exatamente ao completar o timeout sem nenhuma interação', () => {
    const relogio = criarRelogioFalso();
    const { appState } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    relogio.avancar(AUTO_LOCK_TIMEOUT_MS);

    expect(aoTrancar).toHaveBeenCalledTimes(1);
  });

  it('registrarInteracao reinicia a contagem — timeout original não tranca mais', () => {
    const relogio = criarRelogioFalso();
    const { appState } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    const controller = iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    relogio.avancar(AUTO_LOCK_TIMEOUT_MS - 1000);
    controller.registrarInteracao();
    relogio.avancar(999);

    expect(aoTrancar).not.toHaveBeenCalled();

    relogio.avancar(AUTO_LOCK_TIMEOUT_MS - 999);
    expect(aoTrancar).toHaveBeenCalledTimes(1);
  });

  it('parar() impede o timeout de trancar', () => {
    const relogio = criarRelogioFalso();
    const { appState } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    const controller = iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    controller.parar();
    relogio.avancar(AUTO_LOCK_TIMEOUT_MS * 2);

    expect(aoTrancar).not.toHaveBeenCalled();
  });

  it('registrarInteracao depois de parar() não reagenda nada', () => {
    const relogio = criarRelogioFalso();
    const { appState } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    const controller = iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    controller.parar();
    controller.registrarInteracao();
    relogio.avancar(AUTO_LOCK_TIMEOUT_MS * 2);

    expect(aoTrancar).not.toHaveBeenCalled();
  });
});

describe('retomada de primeiro plano (App para background)', () => {
  it('trocar de app por menos que o timeout e voltar não tranca', () => {
    const relogio = criarRelogioFalso();
    const { appState, mudarPara } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    mudarPara('background');
    relogio.avancarSoRelogio(AUTO_LOCK_TIMEOUT_MS - 1000);
    mudarPara('active');

    expect(aoTrancar).not.toHaveBeenCalled();
  });

  it('ficar em background além do timeout tranca ao voltar, mesmo sem o timer ter disparado', () => {
    const relogio = criarRelogioFalso();
    const { appState, mudarPara } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    mudarPara('background');
    // Avança só o relógio, não os timers — simula o Android suspendendo o JS.
    relogio.avancarSoRelogio(AUTO_LOCK_TIMEOUT_MS + 5000);
    mudarPara('active');

    expect(aoTrancar).toHaveBeenCalledTimes(1);
  });

  it('não dispara duas vezes se o timer de primeiro plano e a retomada coincidirem', () => {
    const relogio = criarRelogioFalso();
    const { appState, mudarPara } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    relogio.avancar(AUTO_LOCK_TIMEOUT_MS);
    mudarPara('active');

    expect(aoTrancar).toHaveBeenCalledTimes(1);
  });

  it('transição para "active" dentro do timeout, mesmo repetida, não tranca', () => {
    const relogio = criarRelogioFalso();
    const { appState, mudarPara } = criarAppStateFalso();
    const aoTrancar = jest.fn();

    iniciarAutoLock({ aoTrancar, now: relogio.now, appState });
    mudarPara('active');
    mudarPara('background');
    mudarPara('active');

    expect(aoTrancar).not.toHaveBeenCalled();
  });
});
