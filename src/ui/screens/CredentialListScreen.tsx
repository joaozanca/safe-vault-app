import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import {
  exportarCofre,
  salvarArquivoExportado,
  sugerirNomeArquivo,
} from '../../domain/BackupService';
import {
  excluirCredencial,
  listarCredenciais,
  type Credencial,
} from '../../domain/CredentialService';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Props {
  db: DB;
  /**
   * `null` quando o cofre foi desbloqueado por biometria (H3.5) — nesse
   * caso a senha mestra nunca existiu em texto puro nesta sessão. Ações que
   * a reusam como atalho (backup rápido, importar substituindo) ficam
   * indisponíveis; o usuário ainda tem o "Exportar" normal, que pede a
   * própria senha de exportação.
   */
  masterPassword: string | null;
  onLocked: () => void;
  onExportar: () => void;
  onImportar: () => void;
  onConfigurar: () => void;
  onAdicionar: () => void;
  onEditar: (id: string) => void;
}

/**
 * Tela principal do cofre desbloqueado (H3.1) — substitui o antigo
 * placeholder. Lista as credenciais e dá acesso às ações que já existiam
 * nele (backup rápido, exportar, importar, trancar), mantendo os mesmos
 * `testID`s pra não invalidar nenhum teste manual já documentado.
 */
export function CredentialListScreen({
  db,
  masterPassword,
  onLocked,
  onExportar,
  onImportar,
  onConfigurar,
  onAdicionar,
  onEditar,
}: Props) {
  const [credenciais, setCredenciais] = useState<Credencial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [idParaExcluir, setIdParaExcluir] = useState<string | null>(null);
  const [backupMensagem, setBackupMensagem] = useState<string | null>(null);
  const [backupCarregando, setBackupCarregando] = useState(false);

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      setCredenciais(await listarCredenciais(db));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [db]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  function handleLock() {
    db.close();
    onLocked();
  }

  async function handleBackupRapido() {
    if (masterPassword === null) return;
    setBackupMensagem(null);
    setBackupCarregando(true);
    try {
      const nomeArquivo = sugerirNomeArquivo();
      const conteudo = await exportarCofre(db, masterPassword);
      const salvou = await salvarArquivoExportado(conteudo, nomeArquivo);
      setBackupMensagem(
        salvou
          ? `Backup salvo como ${nomeArquivo}.`
          : 'Backup cancelado — nenhuma pasta escolhida.',
      );
    } catch (e) {
      setBackupMensagem(e instanceof Error ? e.message : String(e));
    } finally {
      setBackupCarregando(false);
    }
  }

  async function handleConfirmarExclusao() {
    if (!idParaExcluir) return;
    try {
      await excluirCredencial(db, idParaExcluir);
      setIdParaExcluir(null);
      await carregarLista();
    } catch (e) {
      setIdParaExcluir(null);
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  const credencialParaExcluir = credenciais.find((c) => c.id === idParaExcluir);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minhas credenciais</Text>

      <View style={styles.menuRow}>
        {masterPassword !== null && (
          <Pressable
            testID="vault.unlocked.quick-backup-button"
            onPress={handleBackupRapido}
            disabled={backupCarregando}
          >
            <Text style={styles.menuLink}>{backupCarregando ? '...' : 'Backup rápido'}</Text>
          </Pressable>
        )}
        <Pressable testID="vault.unlocked.export-button" onPress={onExportar}>
          <Text style={styles.menuLink}>Exportar</Text>
        </Pressable>
        {masterPassword !== null && (
          <Pressable testID="vault.unlocked.import-button" onPress={onImportar}>
            <Text style={styles.menuLink}>Importar</Text>
          </Pressable>
        )}
        <Pressable testID="settings.main.open-link" onPress={onConfigurar}>
          <Text style={styles.menuLink}>Config.</Text>
        </Pressable>
        <Pressable testID="vault.unlocked.lock-button" onPress={handleLock}>
          <Text style={styles.menuLink}>Trancar</Text>
        </Pressable>
      </View>
      {masterPassword === null && (
        <Text style={styles.avisoBiometria}>
          Desbloqueado por biometria — backup rápido e importar ficam indisponíveis nesta sessão.
        </Text>
      )}
      {backupMensagem && (
        <Text testID="vault.unlocked.quick-backup-message" style={styles.backupMensagem}>
          {backupMensagem}
        </Text>
      )}

      {erro && <Text style={styles.error}>{erro}</Text>}

      {carregando ? (
        <ActivityIndicator color="#4ade80" size="large" style={styles.loading} />
      ) : (
        <FlatList
          testID="creds.list"
          data={credenciais}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={
            <Text style={styles.vazio}>
              Nenhuma credencial ainda. Toque em "+ Nova credencial" para adicionar.
            </Text>
          }
          renderItem={({ item }) => (
            <View testID="creds.list.item" accessibilityLabel={item.titulo} style={styles.item}>
              <Pressable style={styles.itemInfo} onPress={() => onEditar(item.id)}>
                <Text style={styles.itemTitulo}>{item.titulo}</Text>
                <Text style={styles.itemUsuario}>{item.usuario}</Text>
              </Pressable>
              <Pressable
                testID="creds.list.delete-button"
                accessibilityLabel={`Excluir ${item.titulo}`}
                style={styles.deleteButton}
                onPress={() => setIdParaExcluir(item.id)}
              >
                <Text style={styles.deleteButtonText}>Excluir</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable testID="creds.list.add-button" style={styles.addButton} onPress={onAdicionar}>
        <Text style={styles.addButtonText}>+ Nova credencial</Text>
      </Pressable>

      <ConfirmDialog
        visivel={idParaExcluir !== null}
        titulo="Excluir credencial"
        mensagem={`Tem certeza que quer excluir "${credencialParaExcluir?.titulo ?? ''}"? Essa ação não tem volta.`}
        textoConfirmar="Excluir"
        onConfirmar={handleConfirmarExclusao}
        onCancelar={() => setIdParaExcluir(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24, gap: 12 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between' },
  menuLink: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  backupMensagem: { color: '#94a3b8', fontSize: 13 },
  avisoBiometria: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic' },
  error: { color: '#f87171', fontSize: 13 },
  loading: { marginTop: 24 },
  lista: { gap: 8, flexGrow: 1 },
  vazio: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 32 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemInfo: { flex: 1 },
  itemTitulo: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  itemUsuario: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  deleteButton: { paddingVertical: 6, paddingHorizontal: 10 },
  deleteButtonText: { color: '#f87171', fontSize: 13, fontWeight: '600' },
  addButton: {
    backgroundColor: '#4ade80',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
});
