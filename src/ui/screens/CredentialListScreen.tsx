import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { encontrarSenhasRepetidas } from '../../domain/PasswordReuseDetector';
import { consumirAvisoDeTentativas } from '../../domain/UnlockAttemptTracker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { acessivel, COR_PLACEHOLDER } from '../acessibilidade';

/** "Todas" — sentinela pro filtro de categoria, não precisa de union type à parte. */
const TODAS_CATEGORIAS = null;

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
  /** H4.4 — só em memória, nunca persistido (nem entre reaberturas da tela). */
  const [termoBusca, setTermoBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(TODAS_CATEGORIAS);
  /** H1.2 — tentativas erradas antes desta entrada; 0 = nada a avisar. */
  const [tentativasErradas, setTentativasErradas] = useState(0);

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

  // H1.2 — o aviso é consumido ao ler: aparece na primeira vez que esta tela
  // monta depois da entrada e não volta ao ir e voltar do formulário.
  useEffect(() => {
    consumirAvisoDeTentativas().then(setTentativasErradas);
  }, []);

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

  /** H4.3 — sobre a lista já decifrada em memória, recalculado a cada mudança dela. */
  const gruposSenhaRepetida = useMemo(() => encontrarSenhasRepetidas(credenciais), [credenciais]);

  const categoriasDisponiveis = useMemo(() => {
    const vistas = new Set(
      credenciais.map((c) => c.categoria).filter((c): c is string => c !== null),
    );
    return [...vistas].sort((a, b) => a.localeCompare(b));
  }, [credenciais]);

  /** H4.4 — busca por título/usuário/URL + filtro por categoria, tudo sobre dados já decifrados. */
  const credenciaisFiltradas = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase();
    return credenciais.filter((c) => {
      const bateCategoria =
        categoriaSelecionada === TODAS_CATEGORIAS || c.categoria === categoriaSelecionada;
      if (!bateCategoria) return false;
      if (termo.length === 0) return true;
      return (
        c.titulo.toLowerCase().includes(termo) ||
        c.usuario.toLowerCase().includes(termo) ||
        (c.url ?? '').toLowerCase().includes(termo)
      );
    });
  }, [credenciais, termoBusca, categoriaSelecionada]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minhas credenciais</Text>

      <View style={styles.menuRow}>
        {masterPassword !== null && (
          <Pressable
            style={acessivel.alvoDeToque}
            testID="vault.unlocked.quick-backup-button"
            onPress={handleBackupRapido}
            disabled={backupCarregando}
          >
            <Text style={styles.menuLink}>{backupCarregando ? '...' : 'Backup rápido'}</Text>
          </Pressable>
        )}
        <Pressable
          style={acessivel.alvoDeToque}
          testID="vault.unlocked.export-button"
          onPress={onExportar}
        >
          <Text style={styles.menuLink}>Exportar</Text>
        </Pressable>
        {masterPassword !== null && (
          <Pressable
            style={acessivel.alvoDeToque}
            testID="vault.unlocked.import-button"
            onPress={onImportar}
          >
            <Text style={styles.menuLink}>Importar</Text>
          </Pressable>
        )}
        <Pressable
          style={acessivel.alvoDeToque}
          testID="settings.main.open-link"
          onPress={onConfigurar}
        >
          <Text style={styles.menuLink}>Config.</Text>
        </Pressable>
        <Pressable
          style={acessivel.alvoDeToque}
          testID="vault.unlocked.lock-button"
          onPress={handleLock}
        >
          <Text style={styles.menuLink}>Trancar</Text>
        </Pressable>
      </View>
      {masterPassword === null && (
        <Text style={styles.avisoBiometria}>
          Desbloqueado por biometria — backup rápido e importar ficam indisponíveis nesta sessão.
        </Text>
      )}
      {tentativasErradas > 0 && (
        <Text testID="vault.unlocked.failed-attempts-notice" style={styles.avisoTentativas}>
          {tentativasErradas === 1
            ? 'Houve 1 tentativa errada desde a última vez que você entrou.'
            : `Houve ${tentativasErradas} tentativas erradas desde a última vez que você entrou.`}
        </Text>
      )}
      {backupMensagem && (
        <Text testID="vault.unlocked.quick-backup-message" style={styles.backupMensagem}>
          {backupMensagem}
        </Text>
      )}

      {erro && <Text style={styles.error}>{erro}</Text>}

      {gruposSenhaRepetida.length > 0 && (
        <View testID="creds.list.reuse-warning" style={styles.avisoRepetida}>
          {gruposSenhaRepetida.map((grupo, i) => (
            // testID por linha: no Android o RN achata o contêiner e as linhas
            // não aparecem como filhas dele para a automação (H5.3).
            <Text key={i} testID="creds.list.reuse-warning.item" style={styles.avisoRepetidaTexto}>
              ⚠ {grupo.quantidade} credenciais com a mesma senha: {grupo.titulos.join(', ')}
            </Text>
          ))}
        </View>
      )}

      <TextInput
        testID="creds.list.search-field"
        style={[acessivel.campo, styles.searchInput]}
        placeholder="Buscar por título, usuário ou URL"
        placeholderTextColor={COR_PLACEHOLDER}
        autoCapitalize="none"
        value={termoBusca}
        onChangeText={setTermoBusca}
      />

      {categoriasDisponiveis.length > 0 && (
        <ScrollView
          testID="creds.list.category-filter"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriasRow}
        >
          <Pressable
            accessibilityLabel="Todas"
            style={[
              acessivel.alvoDeToque,
              styles.categoriaChip,
              categoriaSelecionada === null && styles.categoriaChipAtiva,
            ]}
            onPress={() => setCategoriaSelecionada(TODAS_CATEGORIAS)}
          >
            <Text
              style={[
                styles.categoriaChipTexto,
                categoriaSelecionada === null && styles.categoriaChipTextoAtivo,
              ]}
            >
              Todas
            </Text>
          </Pressable>
          {categoriasDisponiveis.map((categoria) => (
            <Pressable
              key={categoria}
              accessibilityLabel={categoria}
              style={[
                acessivel.alvoDeToque,
                styles.categoriaChip,
                categoriaSelecionada === categoria && styles.categoriaChipAtiva,
              ]}
              onPress={() => setCategoriaSelecionada(categoria)}
            >
              <Text
                style={[
                  styles.categoriaChipTexto,
                  categoriaSelecionada === categoria && styles.categoriaChipTextoAtivo,
                ]}
              >
                {categoria}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {carregando ? (
        <ActivityIndicator color="#4ade80" size="large" style={styles.loading} />
      ) : (
        <FlatList
          testID="creds.list"
          data={credenciaisFiltradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={
            <Text style={styles.vazio}>
              {credenciais.length === 0
                ? 'Nenhuma credencial ainda. Toque em "+ Nova credencial" para adicionar.'
                : 'Nenhuma credencial bate com a busca/filtro atual.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View testID="creds.list.item" accessibilityLabel={item.titulo} style={styles.item}>
              <Pressable
                style={[acessivel.alvoDeToque, styles.itemInfo]}
                onPress={() => onEditar(item.id)}
              >
                <Text style={styles.itemTitulo}>{item.titulo}</Text>
                <Text style={styles.itemUsuario}>{item.usuario}</Text>
              </Pressable>
              <Pressable
                testID="creds.list.delete-button"
                accessibilityLabel={`Excluir ${item.titulo}`}
                style={[acessivel.alvoDeToque, styles.deleteButton]}
                onPress={() => setIdParaExcluir(item.id)}
              >
                <Text style={styles.deleteButtonText}>Excluir</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable
        testID="creds.list.add-button"
        style={[acessivel.alvoDeToque, styles.addButton]}
        onPress={onAdicionar}
      >
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
  // flexWrap: com fonte grande os 5 links não cabem numa linha — sem quebrar,
  // os últimos ("Config.", "Trancar") eram empurrados para fora da tela (H5.4,
  // achado do QA no teste exploratório com fonte em 200%). columnGap separa
  // links que antes ficavam colados.
  menuRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  menuLink: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  backupMensagem: { color: '#94a3b8', fontSize: 13 },
  avisoBiometria: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic' },
  avisoTentativas: { color: '#fbbf24', fontSize: 13, fontWeight: '600' },
  error: { color: '#f87171', fontSize: 13 },
  avisoRepetida: {
    backgroundColor: '#3f1d1d',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f87171',
    gap: 4,
  },
  avisoRepetidaTexto: { color: '#fecaca', fontSize: 12, lineHeight: 17 },
  searchInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  categoriasRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  categoriaChip: {
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  categoriaChipAtiva: { backgroundColor: '#4ade80' },
  categoriaChipTexto: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  categoriaChipTextoAtivo: { color: '#0f172a' },
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
