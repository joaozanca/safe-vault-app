jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  canUseBiometricAuthentication: jest.fn(),
}));
jest.mock('../crypto/kdf', () => ({ deriveKey: jest.fn() }));
jest.mock('../crypto/keyHierarchy', () => ({ unwrapDek: jest.fn() }));
jest.mock('../data/secureStore', () => ({
  loadVaultHeader: jest.fn(),
}));
jest.mock('../data/database', () => ({
  openVaultDatabase: jest.fn(),
  assertDatabaseUnlocked: jest.fn(),
}));
jest.mock('./UnlockAttemptTracker', () => ({
  getLockoutState: jest.fn(),
  recordSuccessfulUnlock: jest.fn(),
  remainingLockoutMs: jest.fn(),
}));
jest.mock('./VaultService', () => ({
  VaultNotFoundError: class VaultNotFoundError extends Error {},
  InvalidMasterPasswordError: class InvalidMasterPasswordError extends Error {},
  VaultLockedError: class VaultLockedError extends Error {
    remainingMs: number;
    constructor(remainingMs: number) {
      super('Cofre bloqueado por excesso de tentativas erradas.');
      this.remainingMs = remainingMs;
    }
  },
}));

import * as SecureStore from 'expo-secure-store';

import { unwrapDek } from '../crypto/keyHierarchy';
import { deriveKey } from '../crypto/kdf';
import { bytesToHex } from '../crypto/encoding';
import { openVaultDatabase, assertDatabaseUnlocked } from '../data/database';
import { loadVaultHeader } from '../data/secureStore';
import {
  getLockoutState,
  recordSuccessfulUnlock,
  remainingLockoutMs,
} from './UnlockAttemptTracker';
import { VaultLockedError, VaultNotFoundError, InvalidMasterPasswordError } from './VaultService';
import {
  ativarBiometria,
  biometriaAtiva,
  biometriaDisponivelNoAparelho,
  BiometriaInvalidadaError,
  desativarBiometria,
  desbloquearComBiometria,
  podeOferecerDesbloqueioPorBiometria,
  registrarDesbloqueioComSenha,
} from './BiometricService';

const mockedGetItem = SecureStore.getItemAsync as jest.Mock;
const mockedSetItem = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockedCanUseBiometric = SecureStore.canUseBiometricAuthentication as jest.Mock;
const mockedLoadHeader = loadVaultHeader as jest.Mock;
const mockedDeriveKey = deriveKey as jest.Mock;
const mockedUnwrapDek = unwrapDek as jest.Mock;
const mockedOpenDb = openVaultDatabase as jest.Mock;
const mockedAssertUnlocked = assertDatabaseUnlocked as jest.Mock;
const mockedGetLockout = getLockoutState as jest.Mock;
const mockedRemainingLockout = remainingLockoutMs as jest.Mock;
const mockedRecordSuccess = recordSuccessfulUnlock as jest.Mock;

const headerFalso = {
  formatVersion: 1,
  kdfSalt: 'aa',
  kdfParams: { memLimitKib: 19 * 1024, opsLimit: 2, parallelism: 1 },
  dekWrap: { password: { nonce: 'bb', ciphertext: 'cc', authTag: 'dd' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetLockout.mockResolvedValue({ failedCount: 0, lockedUntil: null });
  mockedRemainingLockout.mockReturnValue(0);
  mockedAssertUnlocked.mockResolvedValue(undefined);
  mockedRecordSuccess.mockResolvedValue(undefined);
  mockedSetItem.mockResolvedValue(undefined);
  mockedDeleteItem.mockResolvedValue(undefined);
  mockedDeriveKey.mockResolvedValue(new Uint8Array(32));
});

describe('biometriaDisponivelNoAparelho', () => {
  it('repassa o valor de canUseBiometricAuthentication', () => {
    mockedCanUseBiometric.mockReturnValue(true);
    expect(biometriaDisponivelNoAparelho()).toBe(true);

    mockedCanUseBiometric.mockReturnValue(false);
    expect(biometriaDisponivelNoAparelho()).toBe(false);
  });
});

describe('biometriaAtiva', () => {
  it('true só quando a flag está gravada como "true"', async () => {
    mockedGetItem.mockResolvedValue('true');
    expect(await biometriaAtiva()).toBe(true);

    mockedGetItem.mockResolvedValue(null);
    expect(await biometriaAtiva()).toBe(false);
  });
});

// `desbloqueouComSenhaNestaExecucao` é estado de módulo (de propósito — é o
// proxy de "processo ainda vivo", não dá pra injetar). Uma vez ligado por
// `registrarDesbloqueioComSenha()`, fica ligado pelo resto deste arquivo —
// por isso o teste "antes de qualquer desbloqueio" precisa vir primeiro.
describe('podeOferecerDesbloqueioPorBiometria', () => {
  it('false antes de qualquer desbloqueio por senha nesta execução, mesmo com biometria ativa', async () => {
    mockedGetItem.mockResolvedValue('true');
    expect(await podeOferecerDesbloqueioPorBiometria()).toBe(false);
  });

  it('true depois de registrarDesbloqueioComSenha, se a biometria estiver ativa', async () => {
    mockedGetItem.mockResolvedValue('true');
    registrarDesbloqueioComSenha();
    expect(await podeOferecerDesbloqueioPorBiometria()).toBe(true);
  });

  it('false se a biometria nunca foi ativada, mesmo já tendo desbloqueado por senha', async () => {
    mockedGetItem.mockResolvedValue(null);
    registrarDesbloqueioComSenha();
    expect(await podeOferecerDesbloqueioPorBiometria()).toBe(false);
  });
});

describe('ativarBiometria', () => {
  it('lança VaultNotFoundError se não existe cofre', async () => {
    mockedLoadHeader.mockResolvedValue(null);
    await expect(ativarBiometria('Teste1234')).rejects.toThrow(VaultNotFoundError);
    expect(mockedSetItem).not.toHaveBeenCalled();
  });

  it('lança InvalidMasterPasswordError com senha errada, sem gravar nada', async () => {
    mockedLoadHeader.mockResolvedValue(headerFalso);
    mockedUnwrapDek.mockImplementation(() => {
      throw new Error('auth tag não bate');
    });

    await expect(ativarBiometria('SenhaErrada99')).rejects.toThrow(InvalidMasterPasswordError);
    expect(mockedSetItem).not.toHaveBeenCalled();
  });

  it('com a senha certa, grava a DEK com requireAuthentication e liga a flag', async () => {
    const dek = new Uint8Array(32).fill(7);
    const dekHex = bytesToHex(dek); // calculado ANTES: depois de guardada, a DEK é zerada (H3.3)
    mockedLoadHeader.mockResolvedValue(headerFalso);
    mockedUnwrapDek.mockReturnValue(dek);

    await ativarBiometria('SenhaCerta123');

    expect(dek.every((byte) => byte === 0)).toBe(true);
    expect(mockedSetItem).toHaveBeenCalledWith(
      'safevault.biometricDek',
      dekHex,
      expect.objectContaining({ requireAuthentication: true }),
    );
    expect(mockedSetItem).toHaveBeenCalledWith('safevault.biometriaAtiva', 'true');
  });
});

describe('desativarBiometria', () => {
  it('apaga a DEK guardada e a flag', async () => {
    await desativarBiometria();
    expect(mockedDeleteItem).toHaveBeenCalledWith('safevault.biometricDek');
    expect(mockedDeleteItem).toHaveBeenCalledWith('safevault.biometriaAtiva');
  });
});

describe('desbloquearComBiometria', () => {
  it('lança VaultLockedError sem nem chamar o prompt biométrico, se já bloqueado por senha (H1.2)', async () => {
    mockedRemainingLockout.mockReturnValue(30_000);

    await expect(desbloquearComBiometria()).rejects.toThrow(VaultLockedError);
    expect(mockedGetItem).not.toHaveBeenCalled();
  });

  it('abre o banco e registra sucesso quando a DEK vem de volta', async () => {
    const dek = new Uint8Array(32).fill(9);
    mockedGetItem.mockResolvedValue(bytesToHex(dek));
    const dbFalso = { close: jest.fn() };
    // Copia a DEK NO MOMENTO da chamada: depois de abrir o banco ela é zerada (H3.3).
    let dekRecebida = new Uint8Array();
    mockedOpenDb.mockImplementation(async (chave: Uint8Array) => {
      dekRecebida = Uint8Array.from(chave);
      return dbFalso;
    });

    const db = await desbloquearComBiometria();

    expect(mockedGetItem).toHaveBeenCalledWith(
      'safevault.biometricDek',
      expect.objectContaining({ requireAuthentication: true }),
    );
    expect(dekRecebida).toEqual(dek);
    expect((mockedOpenDb.mock.calls[0][0] as Uint8Array).every((byte) => byte === 0)).toBe(true);
    expect(mockedRecordSuccess).toHaveBeenCalled();
    expect(db).toBe(dbFalso);
  });

  it('lança BiometriaInvalidadaError e desativa a flag quando a chave foi invalidada (null)', async () => {
    mockedGetItem.mockResolvedValue(null);

    await expect(desbloquearComBiometria()).rejects.toThrow(BiometriaInvalidadaError);
    expect(mockedDeleteItem).toHaveBeenCalledWith('safevault.biometricDek');
    expect(mockedDeleteItem).toHaveBeenCalledWith('safevault.biometriaAtiva');
    expect(mockedOpenDb).not.toHaveBeenCalled();
  });

  it('repassa o erro se o usuário cancelar o prompt biométrico', async () => {
    mockedGetItem.mockRejectedValue(new Error('UserCancel'));

    await expect(desbloquearComBiometria()).rejects.toThrow('UserCancel');
    expect(mockedOpenDb).not.toHaveBeenCalled();
  });
});
