// Mesma filosofia de VaultService.test.ts: mockamos a camada de cripto e o
// módulo nativo do FileSystem, testando só a ORQUESTRAÇÃO desta camada. A
// correção criptográfica de verdade (encrypt/decrypt) já é coberta em
// cipher.test.ts; aqui importa só que BackupService chama as peças certas,
// na ordem certa, com os dados certos.
jest.mock('../crypto/calibration', () => ({ calibrateParams: jest.fn() }));
jest.mock('../crypto/cipher', () => ({ encrypt: jest.fn(), decrypt: jest.fn() }));
jest.mock('../crypto/csprng', () => ({ randomBytes: jest.fn() }));
jest.mock('../crypto/kdf', () => ({ deriveKey: jest.fn() }));
jest.mock('../crypto/keyHierarchy', () => ({ DEK_BYTES: 32 }));
jest.mock('../data/database', () => ({ openVaultDatabase: jest.fn() }));
jest.mock('../data/secureStore', () => ({ loadVaultHeader: jest.fn(), saveVaultHeader: jest.fn() }));
// VaultNotFoundError é só uma classe — dublê simples evita carregar
// VaultService.ts de verdade (que importaria kdf.ts → react-native-libsodium,
// módulo nativo que quebra fora de um device).
jest.mock('./VaultService', () => ({
  VaultNotFoundError: class VaultNotFoundError extends Error {},
}));
jest.mock('expo-file-system', () => ({
  File: { pickFileAsync: jest.fn() },
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///app-doc-dir/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  moveAsync: jest.fn(),
  deleteAsync: jest.fn(),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
  },
}));

import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

import { calibrateParams } from '../crypto/calibration';
import { decrypt, encrypt } from '../crypto/cipher';
import { randomBytes } from '../crypto/csprng';
import { deriveKey } from '../crypto/kdf';
import { bytesToHex } from '../crypto/encoding';
import { openVaultDatabase } from '../data/database';
import { loadVaultHeader, saveVaultHeader, type VaultHeader } from '../data/secureStore';
import { VaultNotFoundError } from './VaultService';
import {
  calcularForcaSenha,
  criarBackupDeSegurancaAntesDeImportar,
  escolherArquivoParaImportar,
  exportarCofre,
  InvalidExportPasswordError,
  lerArquivoExportado,
  salvarArquivoExportado,
  substituirCofre,
  sugerirNomeArquivo,
  UnsupportedExportFormatError,
  WeakExportPasswordError,
} from './BackupService';

const mockedCalibrateParams = calibrateParams as jest.Mock;
const mockedEncrypt = encrypt as jest.Mock;
const mockedDecrypt = decrypt as jest.Mock;
const mockedRandomBytes = randomBytes as jest.Mock;
const mockedDeriveKey = deriveKey as jest.Mock;
const mockedOpenVaultDatabase = openVaultDatabase as jest.Mock;
const mockedLoadVaultHeader = loadVaultHeader as jest.Mock;
const mockedSaveVaultHeader = saveVaultHeader as jest.Mock;
const mockedPickFileAsync = File.pickFileAsync as jest.Mock;
const mockedReadAsStringAsync = FileSystem.readAsStringAsync as jest.Mock;
const mockedWriteAsStringAsync = FileSystem.writeAsStringAsync as jest.Mock;
const mockedGetInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const mockedMoveAsync = FileSystem.moveAsync as jest.Mock;
const mockedDeleteAsync = FileSystem.deleteAsync as jest.Mock;
const mockedRequestDirPerms = FileSystem.StorageAccessFramework
  .requestDirectoryPermissionsAsync as jest.Mock;
const mockedCreateFileAsync = FileSystem.StorageAccessFramework.createFileAsync as jest.Mock;
const mockedSafWriteAsStringAsync = FileSystem.StorageAccessFramework.writeAsStringAsync as jest.Mock;

function fakeDb(dbPath = '/data/data/com.joaozanca.safevault/databases/vault.db') {
  return { getDbPath: jest.fn(() => dbPath), close: jest.fn() };
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
    expect(mockedSafWriteAsStringAsync).not.toHaveBeenCalled();
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
    expect(mockedSafWriteAsStringAsync).toHaveBeenCalledWith(
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

describe('escolherArquivoParaImportar', () => {
  it('devolve null se o usuário cancelar a escolha', async () => {
    mockedPickFileAsync.mockResolvedValue({ canceled: true, result: null });

    await expect(escolherArquivoParaImportar()).resolves.toBeNull();
    expect(mockedReadAsStringAsync).not.toHaveBeenCalled();
  });

  it('lê o conteúdo do arquivo escolhido pela uri', async () => {
    mockedPickFileAsync.mockResolvedValue({
      canceled: false,
      result: { uri: 'content://escolhido/cofre.safevault', name: 'cofre.safevault' },
    });
    mockedReadAsStringAsync.mockResolvedValue('{"formatVersion":1}');

    const resultado = await escolherArquivoParaImportar();

    expect(mockedReadAsStringAsync).toHaveBeenCalledWith('content://escolhido/cofre.safevault');
    expect(resultado).toEqual({ conteudo: '{"formatVersion":1}', nomeArquivo: 'cofre.safevault' });
  });
});

describe('criarBackupDeSegurancaAntesDeImportar', () => {
  it('exporta com a senha mestra da sessão (não pede senha nova) e grava no diretório interno do app', async () => {
    mockedLoadVaultHeader.mockResolvedValue(HEADER);
    mockedReadAsStringAsync.mockResolvedValue('ZGI=');
    mockedRandomBytes.mockReturnValue(SALT);
    mockedCalibrateParams.mockResolvedValue(CALIBRATION);
    mockedDeriveKey.mockResolvedValue(KEK);
    mockedEncrypt.mockReturnValue({
      nonce: new Uint8Array(12),
      ciphertext: new Uint8Array(4),
      authTag: new Uint8Array(16),
    });

    const db = fakeDb();
    const caminho = await criarBackupDeSegurancaAntesDeImportar(db as never, 'SenhaMestraDaSessao1');

    expect(mockedDeriveKey).toHaveBeenCalledWith('SenhaMestraDaSessao1', SALT, CALIBRATION.params);
    expect(caminho.startsWith('file:///app-doc-dir/backup-antes-de-importar-')).toBe(true);
    expect(caminho.endsWith('.safevault')).toBe(true);
    expect(mockedWriteAsStringAsync).toHaveBeenCalledWith(caminho, expect.any(String));
  });
});

describe('substituirCofre', () => {
  const DB_URI = 'file:///data/data/com.joaozanca.safevault/databases/vault.db';
  const NOVO_HEADER: VaultHeader = {
    formatVersion: 1,
    kdfSalt: 'aa'.repeat(16),
    kdfParams: CALIBRATION.params,
    dekWrap: {
      password: { nonce: 'bb'.repeat(12), ciphertext: 'cc'.repeat(32), authTag: 'dd'.repeat(16) },
    },
  };

  it('com uma conexão já aberta: usa o caminho dela e fecha, sem abrir outra', async () => {
    mockedGetInfoAsync.mockResolvedValue({ exists: false });
    const db = fakeDb('/data/data/com.joaozanca.safevault/databases/vault.db');

    await substituirCofre(NOVO_HEADER, 'ZGI=', db as never);

    expect(db.close).toHaveBeenCalledTimes(1);
    expect(mockedOpenVaultDatabase).not.toHaveBeenCalled();
    expect(mockedWriteAsStringAsync).toHaveBeenCalledWith(`${DB_URI}.importando-tmp`, 'ZGI=', {
      encoding: 'base64',
    });
  });

  it('sem conexão aberta (aparelho novo): resolve o caminho abrindo e fechando uma conexão temporária', async () => {
    mockedGetInfoAsync.mockResolvedValue({ exists: false });
    const dbTemp = fakeDb('/data/data/com.joaozanca.safevault/databases/vault.db');
    mockedOpenVaultDatabase.mockReturnValue(dbTemp);

    await substituirCofre(NOVO_HEADER, 'ZGI=', undefined);

    expect(mockedOpenVaultDatabase).toHaveBeenCalledWith(new Uint8Array(32));
    expect(dbTemp.close).toHaveBeenCalledTimes(1);
  });

  it('cofre atual existe: renomeia pra .bak, troca, grava o cabeçalho e apaga o .bak no final', async () => {
    mockedGetInfoAsync.mockResolvedValue({ exists: true });
    const db = fakeDb();

    await substituirCofre(NOVO_HEADER, 'ZGI=', db as never);

    expect(mockedMoveAsync).toHaveBeenNthCalledWith(1, { from: DB_URI, to: `${DB_URI}.bak-antes-de-importar` });
    expect(mockedMoveAsync).toHaveBeenNthCalledWith(2, { from: `${DB_URI}.importando-tmp`, to: DB_URI });
    expect(mockedSaveVaultHeader).toHaveBeenCalledWith(NOVO_HEADER);
    expect(mockedDeleteAsync).toHaveBeenCalledWith(`${DB_URI}.bak-antes-de-importar`, { idempotent: true });
  });

  it('cofre atual NÃO existe (aparelho novo): não renomeia nada pra .bak nem apaga no final', async () => {
    mockedGetInfoAsync.mockResolvedValue({ exists: false });
    const db = fakeDb();

    await substituirCofre(NOVO_HEADER, 'ZGI=', db as never);

    expect(mockedMoveAsync).toHaveBeenCalledTimes(1); // só tmp -> live
    expect(mockedMoveAsync).toHaveBeenCalledWith({ from: `${DB_URI}.importando-tmp`, to: DB_URI });
    expect(mockedDeleteAsync).not.toHaveBeenCalled();
  });

  it('falha ao trocar tmp pelo banco atual: desfaz trazendo o .bak de volta e propaga o erro', async () => {
    mockedGetInfoAsync.mockResolvedValue({ exists: true });
    mockedMoveAsync.mockImplementation(({ from }: { from: string }) => {
      if (from === `${DB_URI}.importando-tmp`) throw new Error('falha ao mover');
      return Promise.resolve();
    });
    const db = fakeDb();

    await expect(substituirCofre(NOVO_HEADER, 'ZGI=', db as never)).rejects.toThrow('falha ao mover');

    expect(mockedMoveAsync).toHaveBeenLastCalledWith({ from: `${DB_URI}.bak-antes-de-importar`, to: DB_URI });
    expect(mockedSaveVaultHeader).not.toHaveBeenCalled();
  });

  it('falha ao gravar o cabeçalho novo: desfaz o arquivo do banco e traz o .bak de volta', async () => {
    mockedGetInfoAsync.mockResolvedValue({ exists: true });
    mockedMoveAsync.mockResolvedValue(undefined); // sobrescreve o dublê do teste anterior
    mockedSaveVaultHeader.mockRejectedValue(new Error('falha ao gravar'));
    const db = fakeDb();

    await expect(substituirCofre(NOVO_HEADER, 'ZGI=', db as never)).rejects.toThrow('falha ao gravar');

    expect(mockedDeleteAsync).toHaveBeenCalledWith(DB_URI, { idempotent: true });
    expect(mockedMoveAsync).toHaveBeenLastCalledWith({ from: `${DB_URI}.bak-antes-de-importar`, to: DB_URI });
  });
});
