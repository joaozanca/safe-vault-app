jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
}));

import * as Clipboard from 'expo-clipboard';

import { CLIPBOARD_CLEAR_MS, copiarComLimpezaAutomatica, copiarTexto } from './ClipboardService';

const mockedSetString = Clipboard.setStringAsync as jest.Mock;
const mockedGetString = Clipboard.getStringAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedSetString.mockResolvedValue(undefined);
});

describe('copiarTexto', () => {
  it('copia sem agendar nenhuma limpeza', async () => {
    jest.useFakeTimers();

    await copiarTexto('usuario@example.com');

    expect(mockedSetString).toHaveBeenCalledWith('usuario@example.com');
    expect(jest.getTimerCount()).toBe(0);

    jest.useRealTimers();
  });
});

describe('copiarComLimpezaAutomatica', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('copia a senha imediatamente', async () => {
    await copiarComLimpezaAutomatica('S3nh@segura');

    expect(mockedSetString).toHaveBeenCalledWith('S3nh@segura');
  });

  it('limpa o clipboard após 30s se ele ainda for o valor copiado', async () => {
    mockedGetString.mockResolvedValue('S3nh@segura');

    await copiarComLimpezaAutomatica('S3nh@segura');
    mockedSetString.mockClear();
    await jest.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);

    expect(mockedGetString).toHaveBeenCalled();
    expect(mockedSetString).toHaveBeenCalledWith('');
  });

  it('não mexe no clipboard se o usuário copiou outra coisa no meio-tempo', async () => {
    mockedGetString.mockResolvedValue('outra coisa que o usuário copiou depois');

    await copiarComLimpezaAutomatica('S3nh@segura');
    mockedSetString.mockClear();
    await jest.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);

    expect(mockedGetString).toHaveBeenCalled();
    expect(mockedSetString).not.toHaveBeenCalled();
  });

  it('não limpa antes dos 30s se passarem', async () => {
    mockedGetString.mockResolvedValue('S3nh@segura');

    await copiarComLimpezaAutomatica('S3nh@segura');
    mockedSetString.mockClear();
    await jest.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS - 1000);

    expect(mockedGetString).not.toHaveBeenCalled();
    expect(mockedSetString).not.toHaveBeenCalled();
  });
});
