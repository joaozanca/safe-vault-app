import { Pressable, StyleSheet, Text, View } from 'react-native';
import { acessivel } from '../acessibilidade';

interface Props {
  visivel: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Diálogo de confirmação reutilizável (H3.1 — "excluir pede confirmação").
 * Primeiro componente em `ui/components/` — até aqui cada tela cuidava da
 * própria confirmação (ex.: checkbox do ImportScreen), mas excluir é uma
 * ação que vai se repetir (credencial agora, outras coisas depois), então
 * vale a pena isolar.
 *
 * É uma `View` absoluta sobrepondo a tela, não o `Modal` do React Native —
 * o `Modal` abre numa janela nativa separada no Android, o que dificulta
 * encontrar o elemento por `testID` em algumas ferramentas de automação.
 * Mesma escolha, em espírito, de evitar `cy.wait()`: menos mágica por baixo,
 * mais previsível para testar.
 */
export function ConfirmDialog({
  visivel,
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  onConfirmar,
  onCancelar,
}: Props) {
  if (!visivel) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.mensagem}>{mensagem}</Text>
        <View style={styles.acoes}>
          <Pressable
            testID="common.confirm-dialog.cancel-button"
            style={[acessivel.alvoDeToque, styles.botaoSecundario]}
            onPress={onCancelar}
          >
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
          <Pressable
            testID="common.confirm-dialog.confirm-button"
            style={[acessivel.alvoDeToque, styles.botaoPerigo]}
            onPress={onConfirmar}
          >
            <Text style={styles.botaoPerigoTexto}>{textoConfirmar}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    gap: 8,
  },
  titulo: { color: '#f8fafc', fontSize: 17, fontWeight: '700' },
  mensagem: { color: '#94a3b8', fontSize: 14, lineHeight: 19 },
  acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  botaoSecundario: { paddingVertical: 10, paddingHorizontal: 14 },
  botaoSecundarioTexto: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  botaoPerigo: {
    // #b91c1c: 5,91:1 com o texto #fef2f2 (o #ef4444 anterior dava 3,44:1;
    // WCAG pede ≥ 4,5:1) — H5.4.
    backgroundColor: '#b91c1c',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  botaoPerigoTexto: { color: '#fef2f2', fontWeight: '700', fontSize: 14 },
});
