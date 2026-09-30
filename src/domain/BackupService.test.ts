// Mesma filosofia de VaultService.test.ts: mockamos a camada de cripto e o
// módulo nativo do FileSystem, testando só a ORQUESTRAÇÃO desta camada. A
// correção criptográfica de verdade (encrypt/decrypt) já é coberta em
// cipher.test.ts; aqui importa só que BackupService chama as peças certas,
// na ordem certa, com os dados certos.
jest.mock('../crypto/calibration', () => ({ calibrateParams: jest.fn() }));
jest.mock('../crypto/cipher', () => ({ encrypt: jest.fn(), decrypt: jest.fn() }));
jest.mock('../crypto/csprng', () => ({ randomBytes: jest.fn() }));
jest.mock('../crypto/kdf', () => ({ deriveKey: jest.fn() }));
jest.mock('../data/secureStore', () => ({ loadVaultHeader: jest.fn() }));
// VaultNotFoundError é só uma classe — dublê simples evita carregar
// VaultService.ts de verdade (que importaria kdf.ts → react-native-libsodium,
// módulo nativo que quebra fora de um device).
jest.mock('./VaultService', () => ({
  VaultNotFoundError: class VaultNotFoundError extends Error {},
}));
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
  },
}));

import * as FileSystem from 'expo-file-system/legacy';

import { calibrateParams } from '../crypto/calibration';
import { decrypt, encrypt } from '../crypto/cipher';
import { randomBytes } from '../crypto/csprng';
import { deriveKey } from '../crypto/kdf';
import { bytesToHex } from '../crypto/encoding';
import { loadVaultHeader, type VaultHeader } from '../data/secureStore';
import { VaultNotFoundError } from './VaultService';
import {
  calcularForcaSenha,
  exportarCofre,
  InvalidExportPasswordError,
  lerArquivoExportado,
  salvarArquivoExportado,
  sugerirNomeArquivo,
  UnsupportedExportFormatError,
  WeakExportPasswordError,
} from './BackupService';

const mockedCalibrateParams = calibrateParams as jest.Mock;
const mockedEncrypt = encrypt as jest.Mock;
const mockedDecrypt = decrypt as jest.Mock;
const mockedRandomBytes = randomBytes as jest.Mock;
const mockedDeriveKey = deriveKey as jest.Mock;
const mockedLoadVaultHeader = loadVaultHeader as jest.Mock;
const mockedReadAsStringAsync = FileSystem.readAsStringAsync as jest.Mock;
const mockedRequestDirPerms = FileSystem.StorageAccessFramework
  .requestDirectoryPermissionsAsync as jest.Mock;
const mockedCreateFileAsync = FileSystem.StorageAccessFramework.createFileAsync as jest.Mock;
const mockedWriteAsStringAsync = FileSystem.StorageAccessFramework.writeAsStringAsync as jest.Mock;

function fakeDb(dbPath = '/data/data/com.joaozanca.safevault/databases/vault.db') {
  return { getDbPath: jest.fn(() => dbPath) };
}

const SALT = new Uint8Array(16).fill(1);
const KEK = new Uint8Array(32).fill(2);
const CALIBRATION = {
  params: { memoryKiB: 19456, iterations: 2, parallelism: 1, hashLengthBytes: 32 },
  elapsedMs: 300,
};
const HEADER: VaultHeader = {
  formatVersion: 1,
  kdfSalt: '01'.repeat(16),
  kdfParams: CALIBRATION.params,
  dekWrap: {
    password: { nonce: '04'.repeat(12), ciphertext: '05'.repeat(32), authTag: '06'.repeat(16) },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('calcularForcaSenha', () => {
  it('senha curta (< 8) é sempre fraca', () => {
    expect(calcularForcaSenha('Ab1')).toBe('fraca');
  });

  it('8+ caracteres mas só 1 classe de caractere é fraca', () => {
    expect(calcularForcaSenha('somenteminusculas')).toBe('fraca');
  });

  it('8+ caracteres com 2 classes é média', () => {
    expect(calcularForcaSenha('senha1234')).toBe('media');
  });

  it('16+ caracteres com 3+ classes é forte', () => {
    expect(calcularForcaSenha('Senha-Forte-1234!')).toBe('forte');
  });
});

describe('sugerirNomeArquivo', () => {
  it('formata como cofre-AAAA-MM-DD.safevault', () => {
    expect(sugerirNomeArquivo(new Date('2026-09-30T12:00:00Z'))).toBe('cofre-2026-09-30.safevault');
  });
});

describe('exportarCofre', () => {
  it('rejeita senha de exportação vazia, sem consultar nada', async () => {
    const db = fakeDb();
    await expect(exportarCofre(db as never, '')).rejects.toThrow(WeakExportPasswordError);
    expect(mockedLoadVaultHeader).not.toHaveBeenCalled();
  });

  it('lança VaultNotFoundError se não houver cofre', async () => {
    mockedLoadVaultHeader.mockResolvedValue(null);
    const db = fakeDb();

    await expect(exportarCofre(db as never, 'senhaExport123')).rejects.toThrow(VaultNotFoundError);
  });

  it('lê o arquivo do banco pelo caminho de db.getDbPath(), cifra e devolve o JSON do backup', async () => {
    mockedLoadVaultHeader.mockResolvedValue(HEADER);
    mockedReadAsStringAsync.mockResolvedValue('YmFzZTY0LWZha2U=');
    mockedRandomBytes.mockReturnValue(SALT);
    mockedCalibrateParams.mockResolvedValue(CALIBRATION);
    mockedDeriveKey.mockResolvedValue(KEK);
    const WRAPPED = {
      nonce: new Uint8Array(12).fill(7),
      ciphertext: new Uint8Array(10).fill(8),
      authTag: new Uint8Array(16).fill(9),
    };
    mockedEncrypt.mockReturnValue(WRAPPED);

    const db = fakeDb();
    const resultado = await exportarCofre(db as never, 'senhaExport123');

    expect(mockedReadAsStringAsync).toHaveBeenCalledWith(
      'file:///data/data/com.joaozanca.safevault/databases/vault.db',
      { encoding: 'base64' },
    );
    expect(mockedDeriveKey).toHaveBeenCalledWith('senhaExport123', SALT, CALIBRATION.params);
    expect(mockedEncrypt).toHaveBeenCalledWith(KEK, expect.any(Uint8Array));

    const arquivo = JSON.parse(resultado);
    expect(arquivo).toEqual({
      formatVersion: 1,
      kdfSalt: bytesToHex(SALT),
      kdfParams: CALIBRATION.params,
      nonce: bytesToHex(WRAPPED.nonce),
      ciphertext: bytesToHex(WRAPPED.ciphertext),
      authTag: bytesToHex(WRAPPED.authTag),
    });
  });

  it('já inclui "file://" no caminho sem duplicar o prefixo', async () => {
    mockedLoadVaultHeader.mockResolvedValue(HEADER);
    mockedReadAsStringAsync.mockResolvedValue('YmFzZTY0');
    mockedRandomBytes.mockReturnValue(SALT);
    mockedCalibrateParams.mockResolvedValue(CALIBRATION);
    mockedDeriveKey.mockResolvedValue(KEK);
    mockedEncrypt.mockReturnValue({
      nonce: new Uint8Array(12),
      ciphertext: new Uint8Array(4),
      authTag: new Uint8Array(16),
    });

    const db = fakeDb('file:///ja/tem/prefixo/vault.db');
    await exportarCofre(db as never, 'senha123');

    expect(mockedReadAsStringAsync).toHaveBeenCalledWith('file:///ja/tem/prefixo/vault.db', {
      encoding: 'base64',
    });
  });
});

describe('salvarArquivoExportado', () => {
  it('devolve false sem criar arquivo se o usuário cancelar a escolha da pasta', async () => {
    mockedRequestDirPerms.mockResolvedValue({ granted: false });

    const resultado = await salvarArquivoExportado('conteudo', 'cofre.safevault');

    expect(resultado).toBe(false);
    expect(mockedCreateFileAsync).not.toHaveBeenCalled();
    expect(mockedWriteAsStringAsync).not.toHaveBeenCalled();
  });

  it('cria e escreve o arquivo inteiro numa escrita só quando a pasta é concedida', async () => {
    mockedRequestDirPerms.mockResolvedValue({ granted: true, directoryUri: 'content://dir' });
    mockedCreateFileAsync.mockResolvedValue('content://dir/cofre.safevault');

    const resultado = await salvarArquivoExportado('conteudo-completo', 'cofre.safevault');

    expect(resultado).toBe(true);
    expect(mockedCreateFileAsync).toHaveBeenCalledWith(
      'content://dir',
      'cofre.safevault',
      'application/octet-stream',
    );
    expect(mockedWriteAsStringAsync).toHaveBeenCalledWith(
      'content://dir/cofre.safevault',
      'conteudo-completo',
    );
  });
});

describe('lerArquivoExportado', () => {
  const ARQUIVO_VALIDO = JSON.stringify({
    formatVersion: 1,
    kdfSalt: bytesToHex(SALT),
    kdfParams: CALIBRATION.params,
    nonce: '0a'.repeat(12),
    ciphertext: '0b'.repeat(32),
    authTag: '0c'.repeat(16),
  });

  it('conteúdo não é JSON válido: InvalidExportPasswordError genérico', async () => {
    await expect(lerArquivoExportado('isto nao e json', 'senha')).rejects.toThrow(
      InvalidExportPasswordError,
    );
  });

  it('formatVersion desconhecida: UnsupportedExportFormatError', async () => {
    const arquivoFuturo = JSON.stringify({ formatVersion: 99 });
    await expect(lerArquivoExportado(arquivoFuturo, 'senha')).rejects.toThrow(
      UnsupportedExportFormatError,
    );
  });

  it('senha errada (decrypt falha): InvalidExportPasswordError genérico', async () => {
    mockedDeriveKey.mockResolvedValue(KEK);
    mockedDecrypt.mockImplementation(() => {
      throw new Error('auth tag inválida');
    });

    await expect(lerArquivoExportado(ARQUIVO_VALIDO, 'senhaErrada')).rejects.toThrow(
      InvalidExportPasswordError,
    );
  });

  it('caminho feliz: decifra e devolve o cabeçalho + base64 do banco', async () => {
    mockedDeriveKey.mockResolvedValue(KEK);
    const payloadOriginal = { vaultHeader: HEADER, dbFileBase64: 'ZmFrZS1kYg==' };
    mockedDecrypt.mockReturnValue(new TextEncoder().encode(JSON.stringify(payloadOriginal)));

    const resultado = await lerArquivoExportado(ARQUIVO_VALIDO, 'senhaCerta');

    expect(mockedDeriveKey).toHaveBeenCalledWith('senhaCerta', SALT, CALIBRATION.params);
    expect(resultado).toEqual(payloadOriginal);
  });
});
