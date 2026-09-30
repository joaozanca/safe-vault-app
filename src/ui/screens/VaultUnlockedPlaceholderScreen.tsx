import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

interface Props {
  db: DB;
  onLocked: () => void;
  onExportar: () => void;
  onImportar: () => void;
}

/**
 * Placeholder — o cofre está desbloqueado, mas o CRUD de credenciais é
 * Sprint 3, ainda não existe. Existe só para fechar o ciclo
 * criar/desbloquear/trancar de ponta a ponta, com uma tela de verdade em
 * vez de um debug temporário.
 */
export function VaultUnlockedPlaceholderScreen({ db, onLocked, onExportar, onImportar }: Props) {
  function handleLock() {
    db.close();
    onLocked();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cofre desbloqueado</Text>
      <Text style={styles.subtitle}>
        O CRUD de credenciais chega na Sprint 3. Por enquanto, isto só confirma que criar e
        desbloquear o cofre funcionam de ponta a ponta.
      </Text>
      <Pressable testID="vault.unlocked.export-button" style={styles.button} onPress={onExportar}>
        <Text style={styles.buttonText}>Exportar cofre</Text>
      </Pressable>
      <Pressable testID="vault.unlocked.import-button" style={styles.button} onPress={onImportar}>
        <Text style={styles.buttonText}>Importar / restaurar cofre</Text>
      </Pressable>
      <Pressable testID="vault.unlocked.lock-button" style={styles.button} onPress={handleLock}>
        <Text style={styles.buttonText}>Trancar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  button: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
});
