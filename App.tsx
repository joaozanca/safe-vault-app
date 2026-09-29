import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { DB } from '@op-engineering/op-sqlite';

import { hasVaultHeader } from './src/data/secureStore';
import { CreateVaultScreen } from './src/ui/screens/CreateVaultScreen';
import { UnlockScreen } from './src/ui/screens/UnlockScreen';
import { VaultUnlockedPlaceholderScreen } from './src/ui/screens/VaultUnlockedPlaceholderScreen';

type Screen =
  { name: 'loading' } | { name: 'create' } | { name: 'unlock' } | { name: 'unlocked'; db: DB };

/**
 * Decide qual tela mostrar: se já existe cofre neste aparelho, desbloqueio;
 * senão, criação. Sem biblioteca de navegação de propósito — só 3-4 estados
 * simples, sem pilha de histórico real. Entra uma de verdade (react-navigation)
 * quando o CRUD (Sprint 3) trouxer telas suficientes para justificar.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });

  useEffect(() => {
    hasVaultHeader().then((existe) => {
      setScreen(existe ? { name: 'unlock' } : { name: 'create' });
    });
  }, []);

  return (
    <View style={styles.root}>
      {screen.name === 'loading' && (
        <View style={styles.loading}>
          <ActivityIndicator color="#4ade80" size="large" />
        </View>
      )}
      {screen.name === 'create' && (
        <CreateVaultScreen onCreated={(db) => setScreen({ name: 'unlocked', db })} />
      )}
      {screen.name === 'unlock' && (
        <UnlockScreen onUnlocked={(db) => setScreen({ name: 'unlocked', db })} />
      )}
      {screen.name === 'unlocked' && (
        <VaultUnlockedPlaceholderScreen
          db={screen.db}
          onLocked={() => setScreen({ name: 'unlock' })}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
