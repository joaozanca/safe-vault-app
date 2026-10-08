import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ativarBiometria,
  biometriaAtiva,
  biometriaDisponivelNoAparelho,
  desativarBiometria,
} from '../../domain/BiometricService';
import { acessivel, COR_PLACEHOLDER } from '../acessibilidade';

interface Props {
  onVoltar: () => void;
}

/**
 * Primeira tela de Configurações do app (H3.5) — por enquanto só o opt-in
 * de biometria. Timeout de auto-lock configurável (H3.3) ficou de fora de
 * propósito: a tela já existe agora, mas adicioná-lo aqui seria escopo novo
 * não pedido por este critério — decisão do refinamento, 2026-10-01.
 */
export function SettingsScreen({ onVoltar }: Props) {
  const disponivelNoAparelho = biometriaDisponivelNoAparelho();

  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [ativa, setAtiva] = useState(false);
  const [mostrarFormSenha, setMostrarFormSenha] = useState(false);
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    biometriaAtiva()
      .then(setAtiva)
      .finally(() => setCarregandoInicial(false));
  }, []);

  async function handleToggle(ligar: boolean) {
    setErro(null);
    if (!ligar) {
      setSalvando(true);
      try {
        await desativarBiometria();
        setAtiva(false);
      } finally {
        setSalvando(false);
      }
      return;
    }
    setMostrarFormSenha(true);
  }

  async function handleConfirmarAtivacao() {
    setErro(null);
    setSalvando(true);
    try {
      await ativarBiometria(senha);
      setAtiva(true);
      setMostrarFormSenha(false);
      setSenha('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
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
    <View style={styles.container}>
      <Text style={styles.title}>Configurações</Text>

      <View style={styles.linha}>
        <View style={styles.linhaTexto}>
          <Text style={styles.linhaTitulo}>Desbloqueio por biometria</Text>
          <Text style={styles.linhaSubtitulo}>
            {disponivelNoAparelho
              ? 'Use digital ou rosto para desbloquear sem digitar a senha mestra toda vez.'
              : 'Este aparelho não tem biometria cadastrada nas configurações do sistema.'}
          </Text>
        </View>
        <Switch
          style={acessivel.alvoDeToque}
          testID="settings.main.biometric-toggle"
          accessibilityLabel="Desbloqueio por biometria"
          value={ativa}
          onValueChange={handleToggle}
          disabled={!disponivelNoAparelho || salvando}
        />
      </View>

      {mostrarFormSenha && (
        <View style={styles.formAtivacao}>
          <Text style={styles.formTexto}>Confirme sua senha mestra para ativar:</Text>
          <TextInput
            testID="settings.main.biometric-password-input"
            style={[acessivel.campo, styles.input]}
            placeholder="Senha mestra"
            placeholderTextColor={COR_PLACEHOLDER}
            secureTextEntry={!senhaVisivel}
            autoComplete="off"
            importantForAutofill="no"
            value={senha}
            onChangeText={setSenha}
            editable={!salvando}
          />
          <Pressable
            testID="settings.main.reveal-toggle"
            style={[acessivel.alvoDeToque, styles.revealToggle]}
            onPress={() => setSenhaVisivel((v) => !v)}
          >
            <Text style={styles.revealToggleText}>
              {senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            </Text>
          </Pressable>

          {erro && (
            <Text testID="settings.main.error-message" style={styles.error}>
              {erro}
            </Text>
          )}

          <Pressable
            testID="settings.main.biometric-confirm-button"
            style={[
              acessivel.alvoDeToque,
              styles.button,
              (senha.length === 0 || salvando) && styles.buttonDisabled,
            ]}
            onPress={handleConfirmarAtivacao}
            disabled={senha.length === 0 || salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.buttonText}>Ativar</Text>
            )}
          </Pressable>
          <Pressable
            style={acessivel.alvoDeToque}
            testID="settings.main.cancel-ativacao-link"
            onPress={() => {
              setMostrarFormSenha(false);
              setSenha('');
              setErro(null);
            }}
            disabled={salvando}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        testID="settings.main.back-link"
        onPress={onVoltar}
        style={[acessivel.alvoDeToque, styles.voltarButton]}
      >
        <Text style={styles.voltarText}>Voltar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24, gap: 16 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  linhaTexto: { flex: 1, gap: 4 },
  linhaTitulo: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  linhaSubtitulo: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  formAtivacao: { gap: 10 },
  formTexto: { color: '#94a3b8', fontSize: 13 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  revealToggle: { alignSelf: 'flex-end', paddingVertical: 4, marginTop: -6 },
  revealToggleText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  error: { color: '#f87171', fontSize: 13 },
  button: {
    backgroundColor: '#4ade80',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  cancelText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  voltarButton: { marginTop: 'auto', alignItems: 'center', paddingVertical: 12 },
  voltarText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});
