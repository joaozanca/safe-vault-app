import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import {
  CLIPBOARD_CLEAR_MS,
  copiarComLimpezaAutomatica,
  copiarTexto,
} from '../../domain/ClipboardService';
import {
  atualizarCredencial,
  criarCredencial,
  obterCredencial,
  type DadosCredencial,
} from '../../domain/CredentialService';
import { calcularForcaSenha, type ForcaSenha } from '../../domain/PasswordStrength';
import { Toast } from '../components/Toast';
import { GeneratorScreen } from './GeneratorScreen';
import { acessivel, COR_PLACEHOLDER } from '../acessibilidade';

const FORCA_LABEL: Record<ForcaSenha, string> = {
  fraca: 'Fraca',
  media: 'Média',
  forte: 'Forte',
};
const FORCA_COR: Record<ForcaSenha, string> = {
  fraca: '#f87171',
  media: '#fbbf24',
  forte: '#4ade80',
};

/** H3.2 — toast genérico (sem contagem) some sozinho depois desse tempo. */
const TOAST_SIMPLES_MS = 2000;

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
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);
  const [toastDuracaoMs, setToastDuracaoMs] = useState<number | undefined>(undefined);
  const esconderToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mostrarGerador, setMostrarGerador] = useState(false);

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

  function mostrarToast(mensagem: string, duracaoMs: number | undefined) {
    if (esconderToastRef.current) clearTimeout(esconderToastRef.current);
    setToastMensagem(mensagem);
    setToastDuracaoMs(duracaoMs);
    esconderToastRef.current = setTimeout(
      () => setToastMensagem(null),
      duracaoMs ?? TOAST_SIMPLES_MS,
    );
  }

  async function handleCopiarUsuario() {
    await copiarTexto(usuario);
    mostrarToast('Usuário copiado', undefined);
  }

  /** H3.2 — "senha copiada": a única cópia que precisa de limpeza automática. */
  async function handleCopiarSenha() {
    await copiarComLimpezaAutomatica(senha);
    mostrarToast('Senha copiada', CLIPBOARD_CLEAR_MS);
  }

  /** H4.2 — mesmo indicador visual já usado na senha de exportação (H2.3). */
  const forca = senha.length > 0 ? calcularForcaSenha(senha) : null;

  if (carregandoInicial) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#4ade80" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{modoEdicao ? 'Editar credencial' : 'Nova credencial'}</Text>

        <TextInput
          testID="creds.form.title-input"
          style={[acessivel.campo, styles.input]}
          placeholder="Título (ex.: E-mail pessoal) *"
          placeholderTextColor={COR_PLACEHOLDER}
          value={titulo}
          onChangeText={setTitulo}
          editable={!salvando}
        />
        <View style={styles.campoComAcao}>
          <TextInput
            testID="creds.form.username-input"
            style={[acessivel.campo, styles.input, styles.inputComAcao]}
            placeholder="Usuário *"
            placeholderTextColor={COR_PLACEHOLDER}
            autoCapitalize="none"
            value={usuario}
            onChangeText={setUsuario}
            editable={!salvando}
          />
          {modoEdicao && (
            <Pressable
              testID="creds.form.copy-button.username"
              style={[acessivel.alvoDeToque, styles.copyButton]}
              onPress={handleCopiarUsuario}
            >
              <Text style={styles.copyButtonText}>Copiar</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.campoComAcao}>
          <TextInput
            testID="creds.form.password-input"
            style={[acessivel.campo, styles.input, styles.inputComAcao]}
            placeholder="Senha *"
            placeholderTextColor={COR_PLACEHOLDER}
            secureTextEntry={!senhaVisivel}
            // H5.4/R7: revelada, a senha vira texto comum e o teclado poderia sugerir e
            // APRENDER o que foi digitado; "visible-password" mostra sem aprender.
            keyboardType={senhaVisivel ? 'visible-password' : 'default'}
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            value={senha}
            onChangeText={setSenha}
            editable={!salvando}
          />
          {modoEdicao && (
            <Pressable
              testID="creds.form.copy-button.password"
              style={[acessivel.alvoDeToque, styles.copyButton]}
              onPress={handleCopiarSenha}
            >
              <Text style={styles.copyButtonText}>Copiar</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.linhaSenhaAcoes}>
          <Pressable
            testID="creds.form.reveal-toggle"
            style={[acessivel.alvoDeToque, styles.revealToggle]}
            onPress={() => setSenhaVisivel((v) => !v)}
          >
            <Text style={styles.revealToggleText}>
              {senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            </Text>
          </Pressable>
          <Pressable
            style={acessivel.alvoDeToque}
            testID="creds.form.open-generator-button"
            onPress={() => setMostrarGerador(true)}
            disabled={salvando}
          >
            <Text style={styles.revealToggleText}>Gerar senha</Text>
          </Pressable>
        </View>
        {forca && (
          <Text
            testID="creds.form.strength-text"
            style={[styles.forcaText, { color: FORCA_COR[forca] }]}
          >
            Força: {FORCA_LABEL[forca]}
          </Text>
        )}

        <TextInput
          testID="creds.form.url-input"
          style={[acessivel.campo, styles.input]}
          placeholder="URL (opcional)"
          placeholderTextColor={COR_PLACEHOLDER}
          autoCapitalize="none"
          keyboardType="url"
          value={url}
          onChangeText={setUrl}
          editable={!salvando}
        />
        <TextInput
          testID="creds.form.category-input"
          style={[acessivel.campo, styles.input]}
          placeholder="Categoria (opcional)"
          placeholderTextColor={COR_PLACEHOLDER}
          value={categoria}
          onChangeText={setCategoria}
          editable={!salvando}
        />
        <TextInput
          testID="creds.form.notes-input"
          style={[acessivel.campo, styles.input, styles.notesInput]}
          placeholder="Notas (opcional)"
          placeholderTextColor={COR_PLACEHOLDER}
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
          style={[
            acessivel.alvoDeToque,
            styles.button,
            styles.buttonPrimario,
            salvando && styles.buttonDisabled,
          ]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonTextPrimario}>Salvar</Text>
          )}
        </Pressable>

        <Pressable
          style={acessivel.alvoDeToque}
          testID="creds.form.cancel-link"
          onPress={onCancelar}
          disabled={salvando}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </ScrollView>
      <Toast mensagem={toastMensagem} duracaoContagemMs={toastDuracaoMs} />
      {mostrarGerador && (
        <GeneratorScreen
          onUsar={(novaSenha) => {
            setSenha(novaSenha);
            setMostrarGerador(false);
          }}
          onCancelar={() => setMostrarGerador(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  linhaSenhaAcoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: -8,
  },
  revealToggle: {},
  revealToggleText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  forcaText: { fontSize: 13, fontWeight: '700' },
  campoComAcao: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputComAcao: { flex: 1 },
  copyButton: { paddingVertical: 10, paddingHorizontal: 12 },
  copyButtonText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
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
