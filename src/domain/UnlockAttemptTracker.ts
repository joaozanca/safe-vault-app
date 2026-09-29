import * as SecureStore from 'expo-secure-store';

/**
 * Bloqueio progressivo por tentativas erradas (H1.2, decisão do refinamento
 * da Sprint 1). A cada bloco de 5 tentativas erradas, a UI de desbloqueio
 * bloqueia por um tempo que dobra a cada bloco novo: 30s → 1min → 2min →
 * 4min → 8min → 15min, e para de dobrar aí.
 *
 * Isto NÃO é a defesa principal do cofre — quem rouba o arquivo ataca
 * offline, sem passar por aqui (ver a "Nota de segurança" em H1.2 no
 * backlog). É só a camada que atrapalha alguém com o celular destravado na
 * mão tentando adivinhar a senha.
 */

const ATTEMPTS_PER_BLOCK = 5;
const BASE_LOCKOUT_MS = 30_000; // 30s
const MAX_LOCKOUT_MS = 15 * 60_000; // 15min — nunca sobe além disto

const STORAGE_KEY = 'safevault.unlockAttempts';

export interface LockoutState {
  failedCount: number;
  /** epoch ms até quando o bloqueio vale, ou `null` se não está bloqueado. */
  lockedUntil: number | null;
}

const INITIAL_STATE: LockoutState = { failedCount: 0, lockedUntil: null };

export interface AttemptTrackerDeps {
  now?: () => number;
}

/** Lê o estado persistido — nunca lançou até hoje, então não precisa de try/catch aqui. */
export async function getLockoutState(): Promise<LockoutState> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as LockoutState) : INITIAL_STATE;
}

/** Quanto falta de bloqueio, em ms. `0` se não está bloqueado (ou o bloqueio já venceu). */
export function remainingLockoutMs(state: LockoutState, now: number = Date.now()): number {
  if (state.lockedUntil === null) return 0;
  return Math.max(0, state.lockedUntil - now);
}

/**
 * Registra uma tentativa errada. Ao completar um bloco de
 * `ATTEMPTS_PER_BLOCK`, calcula e grava o novo `lockedUntil`.
 *
 * Chamado só depois de já ter confirmado que o cofre não está bloqueado
 * agora (`VaultService.unlockVault` faz essa checagem antes) — não precisa
 * lidar com "tentativa chegando durante um bloqueio", isso a própria
 * checagem anterior impede.
 */
export async function recordFailedAttempt(deps: AttemptTrackerDeps = {}): Promise<LockoutState> {
  const now = deps.now ?? Date.now;
  const current = await getLockoutState();
  const failedCount = current.failedCount + 1;

  let lockedUntil = current.lockedUntil;
  if (failedCount % ATTEMPTS_PER_BLOCK === 0) {
    const blockIndex = failedCount / ATTEMPTS_PER_BLOCK;
    lockedUntil = now() + lockoutDurationMs(blockIndex);
  }

  const next: LockoutState = { failedCount, lockedUntil };
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Senha certa: zera o contador e qualquer bloqueio pendente. */
export async function recordSuccessfulUnlock(): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
}

/** 30s no bloco 1, dobrando por bloco, nunca passando de `MAX_LOCKOUT_MS`. */
function lockoutDurationMs(blockIndex: number): number {
  const doubled = BASE_LOCKOUT_MS * 2 ** (blockIndex - 1);
  return Math.min(doubled, MAX_LOCKOUT_MS);
}
