import { AppState } from 'react-native';

/** H3.3 — decisão do refinamento, 2026-09-24: default de 3 minutos. */
export const AUTO_LOCK_TIMEOUT_MS = 3 * 60_000;

interface AppStateSubscription {
  remove(): void;
}

/** Só o recorte da API do `AppState` do React Native que este módulo usa — injetável para teste. */
export interface AppStateLike {
  addEventListener(type: 'change', listener: (state: string) => void): AppStateSubscription;
}

export interface AutoLockController {
  /** Chamar a cada interação do usuário (toque, digitação, navegação) — reinicia a contagem. */
  registrarInteracao(): void;
  /** Para de observar — chamar ao trancar o cofre por qualquer caminho (nada mais a proteger). */
  parar(): void;
}

interface IniciarAutoLockOptions {
  /** Chamada uma única vez quando o timeout expira. */
  aoTrancar: () => void;
  timeoutMs?: number;
  /** Injetável para teste, mesmo padrão de `UnlockAttemptTracker.ts`/`calibration.ts`. */
  now?: () => number;
  appState?: AppStateLike;
}

/**
 * H3.3 — timer único de inatividade (decisão do refinamento, 2026-10-01): não existe
 * um timer separado para "app em background" — ir para segundo plano não tranca na
 * hora, só conta como mais um intervalo sem interação, no mesmo relógio de parede.
 * Motivo (QA): trocar de app de propósito para buscar uma informação e voltar para
 * colar no cofre é uso legítimo, não deveria ser penalizado com trava imediata.
 *
 * Dois gatilhos, pela mesma razão: nenhum dos dois sozinho cobre os dois cenários.
 *
 * 1. **Timer de primeiro plano** (`setTimeout`): cobre ficar parado dentro do app sem
 *    trocar de tela nem sair dele — sem isto, o cofre nunca trancaria sozinho enquanto
 *    a tela continuasse visível.
 * 2. **Checagem ao retomar o primeiro plano** (`AppState`): cobre o caso de ir para
 *    segundo plano — o Android pode suspender a app (e os timers JS com ela) enquanto
 *    em background por tempo suficiente, então um `setTimeout` sozinho não é confiável
 *    aí. Ao voltar, comparamos o relógio de parede (`now() - ultimaInteracao`) direto,
 *    sem depender de nenhum timer ter disparado durante o tempo em segundo plano.
 */
export function iniciarAutoLock({
  aoTrancar,
  timeoutMs = AUTO_LOCK_TIMEOUT_MS,
  now = Date.now,
  appState = AppState,
}: IniciarAutoLockOptions): AutoLockController {
  let ultimaInteracao = now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let parado = false;

  function agendarChecagem(): void {
    if (timer) clearTimeout(timer);
    const restante = timeoutMs - (now() - ultimaInteracao);
    timer = setTimeout(verificar, Math.max(restante, 0));
  }

  function verificar(): void {
    if (now() - ultimaInteracao >= timeoutMs) {
      disparar();
    } else {
      agendarChecagem();
    }
  }

  function aoMudarAppState(state: string): void {
    if (state === 'active' && now() - ultimaInteracao >= timeoutMs) {
      disparar();
    }
  }

  /** Só dispara uma vez — timer e retomada de foreground podem correr quase juntos. */
  function disparar(): void {
    if (parado) return;
    parar();
    aoTrancar();
  }

  function registrarInteracao(): void {
    if (parado) return;
    ultimaInteracao = now();
    agendarChecagem();
  }

  function parar(): void {
    parado = true;
    if (timer) clearTimeout(timer);
    subscription.remove();
  }

  const subscription = appState.addEventListener('change', aoMudarAppState);
  agendarChecagem();

  return { registrarInteracao, parar };
}
