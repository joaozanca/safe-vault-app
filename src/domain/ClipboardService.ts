import * as Clipboard from 'expo-clipboard';

/**
 * H3.2 — tempo até a senha copiada ser apagada da área de transferência,
 * se ainda for a nossa.
 */
export const CLIPBOARD_CLEAR_MS = 30_000;

/** Copia sem agendar limpeza — usado para campos não-sensíveis (ex.: usuário). */
export async function copiarTexto(valor: string): Promise<void> {
  await Clipboard.setStringAsync(valor);
}

/**
 * Copia a senha e agenda a limpeza em `CLIPBOARD_CLEAR_MS` — só limpa se o
 * clipboard, na hora, ainda for exatamente o que copiamos (critério do
 * H3.2: "se o usuário copiou outra coisa nesse meio-tempo, não apaga o
 * dele"). Copiar de novo antes dos 30s passarem só agenda outro timer
 * independente, que checa o próprio valor da mesma forma — não precisa
 * cancelar o anterior, porque ele vai encontrar um clipboard diferente do
 * que copiou e não vai mexer em nada.
 *
 * Limitação aceita (decisão do refinamento, 2026-10-01): se o app for
 * encerrado antes dos 30s, este `setTimeout` morre junto — a senha fica na
 * área de transferência além do previsto. Documentado, sem mitigação via
 * foreground service (custo/complexidade não justificam essa janela de
 * risco).
 */
export async function copiarComLimpezaAutomatica(valor: string): Promise<void> {
  await Clipboard.setStringAsync(valor);
  setTimeout(() => {
    limparSeAindaForNosso(valor);
  }, CLIPBOARD_CLEAR_MS);
}

async function limparSeAindaForNosso(valorCopiado: string): Promise<void> {
  const atual = await Clipboard.getStringAsync();
  if (atual === valorCopiado) {
    await Clipboard.setStringAsync('');
  }
}
