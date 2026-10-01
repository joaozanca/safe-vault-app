import type { DB } from '@op-engineering/op-sqlite';
import * as SecureStore from 'expo-secure-store';

import type { EncryptedPayload } from '../crypto/cipher';
import { bytesToHex, hexToBytes } from '../crypto/encoding';
import { deriveKey } from '../crypto/kdf';
import { unwrapDek } from '../crypto/keyHierarchy';
import { assertDatabaseUnlocked, openVaultDatabase } from '../data/database';
import { loadVaultHeader, type HexWrap } from '../data/secureStore';
import { getLockoutState, recordSuccessfulUnlock, remainingLockoutMs } from './UnlockAttemptTracker';
import { InvalidMasterPasswordError, VaultLockedError, VaultNotFoundError } from './VaultService';

/**
 * H3.5 — desbloqueio por biometria. A DEK fica guardada no Android Keystore
 * via `expo-secure-store` com `requireAuthentication: true`
 * (`setUserAuthenticationRequired` por baixo) — só sai dali com o
 * `BiometricPrompt` do sistema, nunca lida direto pelo nosso código. Zero
 * biblioteca nova: `expo-secure-store` (já usada desde o H1.1 pro cabeçalho
 * do cofre) já resolve isto sozinha, inclusive a invalidação automática
 * quando o conjunto de digitais/rosto do aparelho muda (ver `getItemAsync`
 * devolvendo `null` em `desbloquearComBiometria`).
 */

const BIOMETRIC_DEK_KEY = 'safevault.biometricDek';
/** Chave "comum" (sem `requireAuthentication`) — só sinaliza "está configurada", sem segredo nenhum dentro. */
const BIOMETRIC_FLAG_KEY = 'safevault.biometriaAtiva';

const AUTH_PROMPT_ATIVAR = 'Confirme sua digital ou rosto para ativar o desbloqueio por biometria';
const AUTH_PROMPT_DESBLOQUEAR = 'Desbloqueie o SafeVault';

/**
 * H3.5 — "primeira abertura após reiniciar o aparelho exige senha mestra":
 * não existe API simples no Expo/RN pra detectar reinício do aparelho sem
 * módulo nativo próprio. Proxy aceito (decisão do refinamento, 2026-10-01):
 * flag em memória, válida só enquanto o processo do app está vivo — reseta
 * em QUALQUER reinício do processo (reiniciar o aparelho reinicia o
 * processo também; fechar o app à força pelo multitarefas também). Mais
 * conservador que o critério literal: pede senha em mais situações, nunca
 * em menos.
 */
let desbloqueouComSenhaNestaExecucao = false;

/** Chamar depois de qualquer desbloqueio bem-sucedido por senha (ou criação de cofre, ou chave de recuperação). */
export function registrarDesbloqueioComSenha(): void {
  desbloqueouComSenhaNestaExecucao = true;
}

export class BiometriaInvalidadaError extends Error {
  constructor() {
    super('A biometria deste aparelho mudou — desbloqueie com a senha mestra para reativar.');
  }
}

/** `true` se o aparelho tem hardware biométrico com pelo menos uma digital/rosto cadastrado. */
export function biometriaDisponivelNoAparelho(): boolean {
  return SecureStore.canUseBiometricAuthentication();
}

/** O usuário já ativou a biometria nas configurações deste cofre. */
export async function biometriaAtiva(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_FLAG_KEY)) === 'true';
}

/**
 * Se a tela de desbloqueio deve oferecer o botão de biometria agora: precisa
 * estar ativada **e** já ter desbloqueado com a senha mestra nesta execução
 * do processo (ver `desbloqueouComSenhaNestaExecucao` acima).
 */
export async function podeOferecerDesbloqueioPorBiometria(): Promise<boolean> {
  return desbloqueouComSenhaNestaExecucao && (await biometriaAtiva());
}

/**
 * Opt-in (H3.5): exige a senha mestra pra confirmar antes de ativar — mesmo
 * padrão de segurança do H2.1 (chave de recuperação também exige a senha
 * mestra pra ser gerada).
 *
 * @throws {VaultNotFoundError} se não existir cofre neste aparelho.
 * @throws {InvalidMasterPasswordError} se a senha estiver errada.
 */
export async function ativarBiometria(masterPassword: string): Promise<void> {
  const header = await loadVaultHeader();
  if (!header) {
    throw new VaultNotFoundError('Nenhum cofre encontrado neste aparelho.');
  }

  const salt = hexToBytes(header.kdfSalt);
  const kek = await deriveKey(masterPassword, salt, header.kdfParams);

  let dek: Uint8Array;
  try {
    dek = unwrapDek(kek, fromHexWrap(header.dekWrap.password));
  } catch {
    throw new InvalidMasterPasswordError('Senha incorreta.');
  }

  await SecureStore.setItemAsync(BIOMETRIC_DEK_KEY, bytesToHex(dek), {
    requireAuthentication: true,
    authenticationPrompt: AUTH_PROMPT_ATIVAR,
  });
  await SecureStore.setItemAsync(BIOMETRIC_FLAG_KEY, 'true');
}

/** Desliga o opt-in — não pede confirmação nenhuma, é reversível e não destrutivo (a senha mestra continua valendo). */
export async function desativarBiometria(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_DEK_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_FLAG_KEY);
}

/**
 * Desbloqueia com o `BiometricPrompt` do sistema. Recusa de cara se o cofre
 * já está bloqueado por tentativas de senha erradas (H1.2) — biometria é um
 * caminho alternativo pro mesmo cofre, não um jeito de furar aquele
 * bloqueio.
 *
 * @throws {VaultLockedError} se o cofre estiver bloqueado por tentativas erradas (H1.2).
 * @throws {BiometriaInvalidadaError} se o conjunto de digitais/rosto do aparelho mudou desde que
 * a biometria foi ativada — `expo-secure-store`/Android invalidam a chave sozinhos; aqui só
 * desativamos o opt-in e avisamos (precisa reativar com a senha mestra).
 * @throws {Error} se o usuário cancelar o prompt biométrico, ou a autenticação falhar — erro
 * vindo direto do `expo-secure-store`, repassado como está.
 */
export async function desbloquearComBiometria(): Promise<DB> {
  const lockout = await getLockoutState();
  const remaining = remainingLockoutMs(lockout);
  if (remaining > 0) {
    throw new VaultLockedError(remaining);
  }

  const dekHex = await SecureStore.getItemAsync(BIOMETRIC_DEK_KEY, {
    requireAuthentication: true,
    authenticationPrompt: AUTH_PROMPT_DESBLOQUEAR,
  });

  if (dekHex === null) {
    await desativarBiometria();
    throw new BiometriaInvalidadaError();
  }

  const dek = hexToBytes(dekHex);
  const db = await openVaultDatabase(dek);
  await assertDatabaseUnlocked(db);
  await recordSuccessfulUnlock();
  return db;
}

function fromHexWrap(wrap: HexWrap): EncryptedPayload {
  return {
    nonce: hexToBytes(wrap.nonce),
    ciphertext: hexToBytes(wrap.ciphertext),
    authTag: hexToBytes(wrap.authTag),
  };
}
