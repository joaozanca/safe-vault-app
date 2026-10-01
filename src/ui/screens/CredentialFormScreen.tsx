import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import {
  atualizarCredencial,
  criarCredencial,
  obterCredencial,
  type DadosCredencial,
} from '../../domain/CredentialService';

interface Props {
  db: DB;
  /** Omitido = criar credencial nova; presente = editar a credencial com esse id. */
  credentialId?: string;
  onSalvo: () => void;
  onCancelar: () => void;
}

/**
 * Formulário único de criar/editar credencial (H3.1) — mesma tela nos dois
 * modos, só muda se carrega dados existentes no início e se chama
 * `criarCredencial` ou `atualizarCredencial` ao salvar. Mesmo padrão de
 * "union por prop" que `ImportScreen.tsx` já usa para `novo-cofre`/`substituir`,
 * só que aqui a diferença é pequena o bastante para caber num único `Props`
 * com campo opcional, em vez de dois tipos.
 */
export function CredentialFormScreen({ db, credentialId, onSalvo, onCancelar }: Props) {
  const modoEdicao = credentialId !== undefined;

  const [titulo, setTitulo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [url, setUrl] = useState('');
  const [notas, setNotas] = useState('');
  const [categoria, setCategoria] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoInicial, setCarregandoInicial] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!credentialId) return;
    obterCredencial(db, credentialId)
      .then((credencial) => {
        setTitulo(credencial.titulo);
        setUsuario(credencial.usuario);
        setSenha(credencial.senha);
        setUrl(credencial.url ?? '');
        setNotas(credencial.notas ?? '');
        setCategoria(credencial.categoria ?? '');
      })
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => setCarregandoInicial(false));
  }, [db, credentialId]);

  async function handleSalvar() {
    setErro(null);
    setSalvando(true);
    try {
      const dados: DadosCredencial = {
        titulo,
        usuario,
        senha,
        url: url.length > 0 ? url : undefined,
        notas: notas.length > 0 ? notas : undefined,
        categoria: categoria.length > 0 ? categoria : undefined,
      };

      if (modoEdicao) {
        await atualizarCredencial(db, credentialId, dados);
      } else {
        await criarCredencial(db, dados);
      }

      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  if (carregandoInicial) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#4ade80" size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{modoEdicao ? 'Editar credencial' : 'Nova credencial'}</Text>

      <TextInput
        testID="creds.form.title-input"
        style={styles.input}
        placeholder="Título (ex.: E-mail pessoal) *"
        placeholderTextColor="#64748b"
        value={titulo}
        onChangeText={setTitulo}
        editable={!salvando}
      />
      <TextInput
        testID="creds.form.username-input"
        style={styles.input}
        placeholder="Usuário *"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        value={usuario}
        onChangeText={setUsuario}
        editable={!salvando}
      />
      <TextInput
        testID="creds.form.password-input"
        style={styles.input}
        placeholder="Senha *"
        placeholderTextColor="#64748b"
        secureTextEntry={!senhaVisivel}
        autoComplete="off"
        importantForAutofill="no"
        value={senha}
        onChangeText={setSenha}
        editable={!salvando}
      />
      <Pressable
        testID="creds.form.reveal-toggle"
        style={styles.revealToggle}
        onPress={() => setSenhaVisivel((v) => !v)}
      >
        <Text style={styles.revealToggleText}>{senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}</Text>
      </Pressable>

      <TextInput
        testID="creds.form.url-input"
        style={styles.input}
        placeholder="URL (opcional)"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="url"
        value={url}
        onChangeText={setUrl}
        editable={!salvando}
      />
      <TextInput
        testID="creds.form.category-input"
        style={styles.input}
        placeholder="Categoria (opcional)"
        placeholderTextColor="#64748b"
        value={categoria}
        onChangeText={setCategoria}
        editable={!salvando}
      />
      <TextInput
        testID="creds.form.notes-input"
        style={[styles.input, styles.notesInput]}
        placeholder="Notas (opcional)"
        placeholderTextColor="#64748b"
        multiline
        value={notas}
        onChangeText={setNotas}
        editable={!salvando}
      />

      {erro && (
        <Text testID="creds.form.error-message" style={styles.error}>
          {erro}
        </Text>
      )}

      <Pressable
        testID="creds.form.submit-button"
        style={[styles.button, styles.buttonPrimario, salvando && styles.buttonDisabled]}
        onPress={handleSalvar}
        disabled={salvando}
      >
        {salvando ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonTextPrimario}>Salvar</Text>
        )}
      </Pressable>

      <Pressable testID="creds.form.cancel-link" onPress={onCancelar} disabled={salvando}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    gap: 12,
  },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  revealToggle: { alignSelf: 'flex-end', paddingVertical: 4, marginTop: -8 },
  revealToggleText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  error: { color: '#f87171', fontSize: 13 },
  button: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPrimario: { backgroundColor: '#4ade80' },
  buttonDisabled: { opacity: 0.6 },
  buttonTextPrimario: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  cancelText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 4 },
});
