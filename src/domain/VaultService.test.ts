// VaultService orquestra vários módulos já testados individualmente (cada
// um com seu próprio dublê da lib nativa correspondente — ver
// crypto/*.test.ts e data/*.test.ts). Aqui não repetimos aquilo: mockamos
// os módulos da nossa própria camada, um nível abaixo, e testamos só a
// ORQUESTRAÇÃO — ordem das chamadas, tratamento de erro, rollback. Mesma
// ideia de testar um Service de camada de negócio no back-end mockando o
// repositório, sem subir um banco de verdade.
// `jest.mock('caminho')` sem fábrica faz o Jest CARREGAR o módulo real
// primeiro, pra descobrir o formato a "auto-mockar" — e carregar kdf.ts,
// cipher.ts etc. de verdade é exatamente o que quebra fora de um device
// (import de módulo nativo). Por isso cada mock aqui vem com sua própria
// fábrica, listando só as funções que VaultService usa: o módulo real
// nunca chega a ser importado.
jest.mock('../crypto/calibration', () => ({ calibrateParams: jest.fn() }));
jest.mock('../crypto/kdf', () => ({ deriveKey: jest.fn() }));
jest.mock('../crypto/keyHierarchy', () => ({
  generateDek: jest.fn(),
  wrapDek: jest.fn(),
  unwrapDek: jest.fn(),
}));
jest.mock('../crypto/csprng', () => ({ randomBytes: jest.fn(), randomBytesAsync: jest.fn() }));
jest.mock('../data/database', () => ({
  openVaultDatabase: jest.fn(),
  assertDatabaseUnlocked: jest.fn(),
}));
jest.mock('../data/secureStore', () => ({
  hasVaultHeader: jest.fn(),
  saveVaultHeader: jest.fn(),
  loadVaultHeader: jest.fn(),
  deleteVaultHeader: jest.fn(),
}));
jest.mock('./UnlockAttemptTracker', () => ({
  getLockoutState: jest.fn(),
  recordFailedAttempt: jest.fn(),
  recordSuccessfulUnlock: jest.fn(),
  // remainingLockoutMs é função pura (sem I/O) — deixamos a de verdade
  // rodar, já testada isoladamente em UnlockAttemptTracker.test.ts. Só
  // getLockoutState precisa de dublê, porque é ela quem faz I/O.
  remainingLockoutMs: jest.requireActual('./UnlockAttemptTracker').remainingLockoutMs,
}));

import { calibrateParams } from '../crypto/calibration';
import { randomBytes } from '../crypto/csprng';
import { deriveKey } from '../crypto/kdf';
import { generateDek, unwrapDek, wrapDek } from '../crypto/keyHierarchy';
import { bytesToHex } from '../crypto/encoding';
import { assertDatabaseUnlocked, openVaultDatabase } from '../data/database';
import {
  deleteVaultHeader,
  hasVaultHeader,
  loadVaultHeader,
  saveVaultHeader,
  type VaultHeader,
} from '../data/secureStore';
import { getLockoutState, recordFailedAttempt, recordSuccessfulUnlock } from './UnlockAttemptTracker';
import {
  createVault,
  InvalidMasterPasswordError,
  unlockVault,
  VaultAlreadyExistsError,
  VaultLockedError,
  VaultNotFoundError,
  WeakMasterPasswordError,
} from './VaultService';

const mockedCalibrateParams = calibrateParams as jest.Mock;
const mockedRandomBytes = randomBytes as jest.Mock;
const mockedDeriveKey = deriveKey as jest.Mock;
const mockedGenerateDek = generateDek as jest.Mock;
const mockedWrapDek = wrapDek as jest.Mock;
const mockedUnwrapDek = unwrapDek as jest.Mock;
const mockedOpenVaultDatabase = openVaultDatabase as jest.Mock;
const mockedAssertDatabaseUnlocked = assertDatabaseUnlocked as jest.Mock;
const mockedHasVaultHeader = hasVaultHeader as jest.Mock;
const mockedSaveVaultHeader = saveVaultHeader as jest.Mock;
const mockedLoadVaultHeader = loadVaultHeader as jest.Mock;
const mockedDeleteVaultHeader = deleteVaultHeader as jest.Mock;
const mockedGetLockoutState = getLockoutState as jest.Mock;
const mockedRecordFailedAttempt = recordFailedAttempt as jest.Mock;
const mockedRecordSuccessfulUnlock = recordSuccessfulUnlock as jest.Mock;

const GOOD_PASSWORD = 'Senha1234';
const SALT = new Uint8Array(16).fill(1);
const KEK = new Uint8Array(32).fill(2);
const DEK = new Uint8Array(32).fill(3);
const WRAPPED = { nonce: new Uint8Array(12).fill(4), ciphertext: new Uint8Array(32).fill(5), authTag: new Uint8Array(16).fill(6) };
const CALIBRATION = {
  params: { memoryKiB: 19456, iterations: 2, parallelism: 1, hashLengthBytes: 32 },
  elapsedMs: 300,
};

function fakeDb() {
  return { close: jest.fn(), delete: jest.fn(), execute: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedRandomBytes.mockReturnValue(SALT);
  mockedCalibrateParams.mockResolvedValue(CALIBRATION);
  mockedDeriveKey.mockResolvedValue(KEK);
  mockedGenerateDek.mockReturnValue(DEK);
  mockedWrapDek.mockReturnValue(WRAPPED);
  mockedHasVaultHeader.mockResolvedValue(false);
  mockedSaveVaultHeader.mockResolvedValue(undefined);
  mockedOpenVaultDatabase.mockReturnValue(fakeDb());
  mockedAssertDatabaseUnlocked.mockResolvedValue(undefined);
  mockedGetLockoutState.mockResolvedValue({ failedCount: 0, lockedUntil: null });
  mockedRecordFailedAttempt.mockResolvedValue({ failedCount: 1, lockedUntil: null });
  mockedRecordSuccessfulUnlock.mockResolvedValue(undefined);
});

describe('createVault', () => {
  it.each([
    ['curta demais', 'Ab1'],
    ['sem maiúscula', 'senha123'],
    ['sem minúscula', 'SENHA123'],
    ['sem número', 'SenhaSenha'],
    ['com emoji simples', 'Senha123😀'],
    // família (ZWJ) e bandeira são "emoji compostos" — o mesmo tipo de
    // composição por trás do defeito de acento que achamos hoje; garante
    // que o bloqueio pega essas formas também, não só o caso mais óbvio.
    ['com emoji de família (ZWJ)', 'Senha123👨‍👩‍👧‍👦'],
    ['com emoji de bandeira', 'Senha123🇧🇷'],
    ['com emoji de tom de pele', 'Senha123👍🏽'],
  ])('rejeita senha %s sem consultar nada', async (_caso, senhaRuim) => {
    await expect(createVault(senhaRuim)).rejects.toThrow(WeakMasterPasswordError);
    expect(mockedHasVaultHeader).not.toHaveBeenCalled();
    expect(mockedCalibrateParams).not.toHaveBeenCalled();
  });

  it('NÃO rejeita letra acentuada — só emoji é bloqueado, não Unicode em geral', async () => {
    // Guarda contra falso positivo: se o regex de emoji fosse largo demais,
    // isso rejeitaria "ã"/"ç" também, o que nunca foi a intenção (só emoji
    // está proibido; acento é uma discussão separada, ainda em aberto).
    await expect(createVault('Testecao123ã')).resolves.toBeUndefined();
  });

  it('rejeita se já existir cofre, sem gerar chave nenhuma', async () => {
    mockedHasVaultHeader.mockResolvedValue(true);

    await expect(createVault(GOOD_PASSWORD)).rejects.toThrow(VaultAlreadyExistsError);
    expect(mockedCalibrateParams).not.toHaveBeenCalled();
  });

  it('caminho feliz: grava o cabeçalho certo e abre o banco com a DEK', async () => {
    await createVault(GOOD_PASSWORD);

    expect(mockedCalibrateParams).toHaveBeenCalledWith(SALT);
    expect(mockedDeriveKey).toHaveBeenCalledWith(GOOD_PASSWORD, SALT, CALIBRATION.params);
    expect(mockedWrapDek).toHaveBeenCalledWith(KEK, DEK);

    const header = mockedSaveVaultHeader.mock.calls[0][0] as VaultHeader;
    expect(header.formatVersion).toBe(1);
    expect(header.kdfParams).toEqual(CALIBRATION.params);
    expect(header.dekWrap.password.nonce).toBe(bytesToHex(WRAPPED.nonce));
    expect(header.dekWrap.password.ciphertext).toBe(bytesToHex(WRAPPED.ciphertext));
    expect(header.dekWrap.password.authTag).toBe(bytesToHex(WRAPPED.authTag));

    expect(mockedOpenVaultDatabase).toHaveBeenCalledWith(DEK);
  });

  it('desfaz o cabeçalho e apaga o banco se a abertura falhar depois de gravar', async () => {
    const db = fakeDb();
    mockedOpenVaultDatabase.mockReturnValue(db);
    mockedAssertDatabaseUnlocked.mockRejectedValue(new Error('banco corrompido'));

    await expect(createVault(GOOD_PASSWORD)).rejects.toThrow('banco corrompido');

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(mockedDeleteVaultHeader).toHaveBeenCalledTimes(1);
  });
});

describe('unlockVault', () => {
  const header: VaultHeader = {
    formatVersion: 1,
    kdfSalt: '01'.repeat(16),
    kdfParams: CALIBRATION.params,
    dekWrap: {
      password: { nonce: '04'.repeat(12), ciphertext: '05'.repeat(32), authTag: '06'.repeat(16) },
    },
  };

  it('lança VaultNotFoundError se não houver cofre', async () => {
    mockedLoadVaultHeader.mockResolvedValue(null);

    await expect(unlockVault(GOOD_PASSWORD)).rejects.toThrow(VaultNotFoundError);
    expect(mockedDeriveKey).not.toHaveBeenCalled();
  });

  it('caminho feliz: devolve o banco já aberto com a DEK desembrulhada, e zera o contador de tentativas', async () => {
    mockedLoadVaultHeader.mockResolvedValue(header);
    mockedUnwrapDek.mockReturnValue(DEK);
    const db = fakeDb();
    mockedOpenVaultDatabase.mockReturnValue(db);

    const resultado = await unlockVault(GOOD_PASSWORD);

    expect(mockedDeriveKey).toHaveBeenCalledWith(GOOD_PASSWORD, expect.any(Uint8Array), header.kdfParams);
    expect(mockedOpenVaultDatabase).toHaveBeenCalledWith(DEK);
    expect(resultado).toBe(db);
    expect(mockedRecordSuccessfulUnlock).toHaveBeenCalledTimes(1);
    expect(mockedRecordFailedAttempt).not.toHaveBeenCalled();
  });

  it('senha errada: mensagem genérica, nunca chega a abrir o banco, conta como tentativa errada', async () => {
    mockedLoadVaultHeader.mockResolvedValue(header);
    mockedUnwrapDek.mockImplementation(() => {
      throw new Error('auth tag inválida');
    });

    await expect(unlockVault(GOOD_PASSWORD)).rejects.toThrow(InvalidMasterPasswordError);
    await expect(unlockVault(GOOD_PASSWORD)).rejects.toThrow('Senha incorreta.');
    expect(mockedOpenVaultDatabase).not.toHaveBeenCalled();
    expect(mockedRecordFailedAttempt).toHaveBeenCalledTimes(2);
    expect(mockedRecordSuccessfulUnlock).not.toHaveBeenCalled();
  });

  it('DEK certa mas banco não abre (corrompido): mesma mensagem genérica, fecha a conexão, NÃO conta como tentativa errada', async () => {
    mockedLoadVaultHeader.mockResolvedValue(header);
    mockedUnwrapDek.mockReturnValue(DEK);
    const db = fakeDb();
    mockedOpenVaultDatabase.mockReturnValue(db);
    mockedAssertDatabaseUnlocked.mockRejectedValue(new Error('arquivo corrompido'));

    await expect(unlockVault(GOOD_PASSWORD)).rejects.toThrow(InvalidMasterPasswordError);
    expect(db.close).toHaveBeenCalledTimes(1);
    // A senha estava certa (a DEK desembrulhou); o problema é o arquivo do
    // banco, não a tentativa. Contar isso como "tentativa errada" puniria
    // o usuário por um bug/corrupção que não é culpa dele.
    expect(mockedRecordFailedAttempt).not.toHaveBeenCalled();
  });

  it('cofre bloqueado: recusa antes de sequer derivar a chave', async () => {
    mockedLoadVaultHeader.mockResolvedValue(header);
    mockedGetLockoutState.mockResolvedValue({
      failedCount: 5,
      lockedUntil: Date.now() + 20_000,
    });

    const erro = await unlockVault(GOOD_PASSWORD).catch((e) => e);

    expect(erro).toBeInstanceOf(VaultLockedError);
    expect((erro as InstanceType<typeof VaultLockedError>).remainingMs).toBeGreaterThan(0);
    expect((erro as InstanceType<typeof VaultLockedError>).remainingMs).toBeLessThanOrEqual(20_000);
    expect(mockedDeriveKey).not.toHaveBeenCalled();
  });

  it('bloqueio já vencido: deixa tentar normalmente', async () => {
    mockedLoadVaultHeader.mockResolvedValue(header);
    mockedGetLockoutState.mockResolvedValue({
      failedCount: 5,
      lockedUntil: Date.now() - 1_000, // no passado — já venceu
    });
    mockedUnwrapDek.mockReturnValue(DEK);

    await expect(unlockVault(GOOD_PASSWORD)).resolves.toBeDefined();
    expect(mockedDeriveKey).toHaveBeenCalled();
  });
});
