import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { DB } from '@op-engineering/op-sqlite';

import { hasVaultHeader } from './src/data/secureStore';
import { precisaConfigurarRecuperacao } from './src/domain/VaultService';
import { CreateVaultScreen } from './src/ui/screens/CreateVaultScreen';
import { ExportScreen } from './src/ui/screens/ExportScreen';
import { RecoveryKeyScreen } from './src/ui/screens/RecoveryKeyScreen';
import { RecoveryUnlockScreen } from './src/ui/screens/RecoveryUnlockScreen';
import { UnlockScreen } from './src/ui/screens/UnlockScreen';
import { VaultUnlockedPlaceholderScreen } from './src/ui/screens/VaultUnlockedPlaceholderScreen';

type Screen =
  | { name: 'loading' }
  | { name: 'create' }
  | { name: 'unlock' }
  | { name: 'recovery-unlock' }
  | { name: 'recovery-setup'; db: DB; masterPassword: string }
  | { name: 'unlocked'; db: DB }
  | { name: 'export'; db: DB };

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

  /**
   * Depois de criar ou desbloquear o cofre, decide entre a tela de chave de
   * recuperação (H2.1) e a tela principal. Serve os dois casos: cofre
   * recém-criado (nunca tem recuperação ainda) e um desbloqueio normal onde
   * a configuração ficou pendente de uma sessão anterior interrompida — ver
   * `precisaConfigurarRecuperacao` em VaultService.ts para o porquê da
   * ausência do embrulho ser o próprio sinal disso.
   */
  async function aoAbrirCofre(db: DB, masterPassword: string) {
    const pendente = await precisaConfigurarRecuperacao();
    setScreen(pendente ? { name: 'recovery-setup', db, masterPassword } : { name: 'unlocked', db });
  }

  return (
    <View style={styles.root}>
      {screen.name === 'loading' && (
        <View style={styles.loading}>
          <ActivityIndicator color="#4ade80" size="large" />
        </View>
      )}
      {screen.name === 'create' && <CreateVaultScreen onCreated={aoAbrirCofre} />}
      {screen.name === 'unlock' && (
        <UnlockScreen
          onUnlocked={aoAbrirCofre}
          onEsqueciSenha={() => setScreen({ name: 'recovery-unlock' })}
        />
      )}
      {screen.name === 'recovery-unlock' && (
        <RecoveryUnlockScreen
          onRecovered={aoAbrirCofre}
          onCancel={() => setScreen({ name: 'unlock' })}
        />
      )}
      {screen.name === 'recovery-setup' && (
        <RecoveryKeyScreen
          masterPassword={screen.masterPassword}
          onConfirmed={() => setScreen({ name: 'unlocked', db: screen.db })}
        />
      )}
      {screen.name === 'unlocked' && (
        <VaultUnlockedPlaceholderScreen
          db={screen.db}
          onLocked={() => setScreen({ name: 'unlock' })}
          onExportar={() => setScreen({ name: 'export', db: screen.db })}
        />
      )}
      {screen.name === 'export' && (
        <ExportScreen db={screen.db} onVoltar={() => setScreen({ name: 'unlocked', db: screen.db })} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
