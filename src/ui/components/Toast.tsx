import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  /** `null` = nada a mostrar. */
  mensagem: string | null;
  /**
   * Presente = mostra contagem regressiva ao lado da mensagem e usa o
   * testID `common.toast.clipboard` (H3.2 — "mostra aviso com contagem").
   * Ausente = toast genérico, testID `common.toast`.
   */
  duracaoContagemMs?: number;
}

/**
 * Mensagem transitória no rodapé da tela. Não se auto-esconde sozinho —
 * quem chama decide por quanto tempo `mensagem` fica preenchida (mesmo
 * padrão de `setTimeout` que já usamos no `ClipboardService`), este
 * componente só cuida de mostrar a contagem regressiva quando aplicável.
 */
export function Toast({ mensagem, duracaoContagemMs }: Props) {
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);

  useEffect(() => {
    if (!mensagem || duracaoContagemMs === undefined) {
      setSegundosRestantes(null);
      return;
    }

    setSegundosRestantes(Math.ceil(duracaoContagemMs / 1000));
    const intervalo = setInterval(() => {
      setSegundosRestantes((segundos) => (segundos !== null && segundos > 0 ? segundos - 1 : 0));
    }, 1000);

    return () => clearInterval(intervalo);
  }, [mensagem, duracaoContagemMs]);

  if (!mensagem) return null;

  const comContagem = duracaoContagemMs !== undefined;

  return (
    <View testID={comContagem ? 'common.toast.clipboard' : 'common.toast'} style={styles.toast}>
      {/* testID no texto também: no Android o RN achata o contêiner e o texto
          não aparece como filho dele para a automação (H5.3). */}
      <Text
        testID={comContagem ? 'common.toast.clipboard.text' : 'common.toast.text'}
        style={styles.texto}
      >
        {mensagem}
        {comContagem && segundosRestantes !== null ? ` — apagada em ${segundosRestantes}s` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  texto: { color: '#f8fafc', fontSize: 13, textAlign: 'center' },
});
