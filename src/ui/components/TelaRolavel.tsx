import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/** Propriedades que pertencem à MOLDURA da tela (ocupar o espaço, fundo,
 * posição); todo o resto (padding, gap, alinhamento) vai para o conteúdo. */
const CHAVES_DA_MOLDURA = [
  'flex',
  'backgroundColor',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'zIndex',
  'elevation',
] as const;

interface Props {
  /** O mesmo estilo `container` que a tela usava no `View` externo. */
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Container de tela que ROLA quando o conteúdo não cabe (H5.5, defeito achado
 * pelo QA em aparelho real): com fonte maior ou "Tamanho da tela" ampliado, as
 * telas de tamanho fixo cortavam o que ficava embaixo — no gerador, "Usar esta
 * senha" ficava inalcançável; nas telas de entrada, "Criar cofre" ou
 * "Desbloquear" podiam sumir.
 *
 * `flexGrow: 1` mantém o comportamento de antes quando cabe (ex.: elementos
 * com `marginTop: 'auto'` continuam indo para o rodapé).
 * `keyboardShouldPersistTaps="handled"`: com o teclado aberto, o primeiro toque
 * num botão já age, em vez de só fechar o teclado.
 */
export function TelaRolavel({ style, children }: Props) {
  const achatado = StyleSheet.flatten(style) ?? {};
  const moldura: ViewStyle = {};
  const conteudo: ViewStyle = { ...achatado };
  for (const chave of CHAVES_DA_MOLDURA) {
    if (chave in conteudo) {
      (moldura as Record<string, unknown>)[chave] = conteudo[chave];
      delete conteudo[chave];
    }
  }

  return (
    <ScrollView
      style={[{ flex: 1 }, moldura]}
      contentContainerStyle={[conteudo, { flexGrow: 1 }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
