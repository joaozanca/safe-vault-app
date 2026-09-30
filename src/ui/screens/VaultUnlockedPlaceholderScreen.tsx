import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import {
  exportarCofre,
  salvarArquivoExportado,
  sugerirNomeArquivo,
} from '../../domain/BackupService';

interface Props {
  db: DB;
  masterPassword: string;
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
export function VaultUnlockedPlaceholderScreen({
  db,
  masterPassword,
  onLocked,
  onExportar,
  onImportar,
}: Props) {
  const [backupMensagem, setBackupMensagem] = useState<string | null>(null);
  const [backupCarregando, setBackupCarregando] = useState(false);

  function handleLock() {
    db.close();
    onLocked();
  }

  /**
   * H2.5 — "um toque": reusa o H2.3 (`exportarCofre`/`salvarArquivoExportado`)
   * mas com a senha mestra já em memória da sessão, do mesmo jeito que o
   * backup de segurança automático do H2.4 (`criarBackupDeSegurancaAntesDeImportar`)
   * — sem formulário, sem senha de exportação pra pensar toda vez.
   */
  async function handleBackupRapido() {
    setBackupMensagem(null);
    setBackupCarregando(true);
    try {
      const nomeArquivo = sugerirNomeArquivo();
      const conteudo = await exportarCofre(db, masterPassword);
      const salvou = await salvarArquivoExportado(conteudo, nomeArquivo);
      setBackupMensagem(
        salvou ? `Backup salvo como ${nomeArquivo}.` : 'Backup cancelado — nenhuma pasta escolhida.',
      );
    } catch (e) {
      setBackupMensagem(e instanceof Error ? e.message : String(e));
    } finally {
      setBackupCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cofre desbloqueado</Text>
      <Text style={styles.subtitle}>
        O CRUD de credenciais chega na Sprint 3. Por enquanto, isto só confirma que criar e
        desbloquear o cofre funcionam de ponta a ponta.
      </Text>
      <Pressable
        testID="vault.unlocked.quick-backup-button"
        style={[styles.button, backupCarregando && styles.buttonDisabled]}
        onPress={handleBackupRapido}
        disabled={backupCarregando}
      >
        {backupCarregando ? (
          <ActivityIndicator color="#f8fafc" />
        ) : (
          <Text style={styles.buttonText}>Backup rápido (senha mestra)</Text>
        )}
      </Pressable>
      {backupMensagem && (
        <Text testID="vault.unlocked.quick-backup-message" style={styles.backupMensagem}>
          {backupMensagem}
        </Text>
      )}
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
  buttonDisabled: { opacity: 0.6 },
  backupMensagem: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});
