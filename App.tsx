import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Ponto de entrada visual do app. Por enquanto é só um placeholder —
 * as telas reais (criar cofre, desbloquear) chegam junto com H1.1 e H1.2.
 * A navegação entre elas também ainda não existe; entra quando houver mais
 * de uma tela para alternar.
 */
export default function App() {
  return (
    <View style={styles.container} testID="common.app-root">
      <Text style={styles.title}>SafeVault</Text>
      <Text style={styles.subtitle}>Sprint 1 em desenvolvimento</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
