import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import { entrarComChaveDeRecuperacao } from '../../domain/VaultService';
import { acessivel, COR_PLACEHOLDER } from '../acessibilidade';

interface Props {
  /** Chamado com a conexão já aberta e a senha nova — a próxima tela (chave
   * de recuperação, rotacionada) precisa dela de novo pra desembrulhar a DEK. */
  onRecovered: (db: DB, masterPassword: string) => void;
  onCancel: () => void;
}

/**
 * Tela "esqueci a senha" (H2.2). Usa a chave de recuperação pra desembrulhar
 * a DEK e exige definir uma senha mestra nova no mesmo passo — não existe
 * fluxo separado de "só recuperar sem trocar a senha".
 */
export function RecoveryUnlockScreen({ onRecovered, onCancel }: Props) {
  const [chave, setChave] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  async function handleSubmit() {
    setErro(null);

    if (novaSenha !== confirmacao) {
      setErro('As senhas digitadas não são iguais.');
      return;
    }

    setCarregando(true);
    try {
      const db = await entrarComChaveDeRecuperacao(chave, novaSenha);
      onRecovered(db, novaSenha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entrar com a chave de recuperação</Text>
      <Text style={styles.subtitle}>
        Cole a chave de recuperação que você guardou na criação do cofre e escolha uma senha mestra
        nova. Depois de usar, esta chave deixa de funcionar — uma nova será gerada.
      </Text>

      <TextInput
        testID="unlock.recovery.key-input"
        style={[acessivel.campo, styles.input, styles.inputChave]}
        placeholder="Chave de recuperação"
        placeholderTextColor={COR_PLACEHOLDER}
        multiline
        autoCapitalize="none"
        autoComplete="off"
        importantForAutofill="no"
        value={chave}
        onChangeText={setChave}
        editable={!carregando}
      />

      <TextInput
        testID="unlock.recovery.password-input.new"
        style={[acessivel.campo, styles.input]}
        placeholder="Nova senha mestra"
        placeholderTextColor={COR_PLACEHOLDER}
        secureTextEntry={!senhaVisivel}
        autoComplete="off"
        importantForAutofill="no"
        value={novaSenha}
        onChangeText={setNovaSenha}
        editable={!carregando}
      />
      <TextInput
        testID="unlock.recovery.password-input.confirm"
        style={[acessivel.campo, styles.input]}
        placeholder="Confirmar nova senha mestra"
        placeholderTextColor={COR_PLACEHOLDER}
        secureTextEntry={!senhaVisivel}
        autoComplete="off"
        importantForAutofill="no"
        value={confirmacao}
        onChangeText={setConfirmacao}
        editable={!carregando}
      />

      <Pressable
        testID="unlock.recovery.reveal-toggle"
        style={[acessivel.alvoDeToque, styles.revealToggle]}
        onPress={() => setSenhaVisivel((v) => !v)}
      >
        <Text style={styles.revealToggleText}>
          {senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
        </Text>
      </Pressable>

      {erro && (
        <Text testID="unlock.recovery.error-message" style={styles.error}>
          {erro}
        </Text>
      )}

      <Pressable
        testID="unlock.recovery.submit-button"
        style={[acessivel.alvoDeToque, styles.button, carregando && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={carregando}
      >
        {carregando ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Continuar</Text>
        )}
      </Pressable>

      <Pressable
        style={acessivel.alvoDeToque}
        testID="unlock.recovery.cancel-link"
        onPress={onCancel}
        disabled={carregando}
      >
        <Text style={styles.cancelText}>Voltar para o desbloqueio normal</Text>
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
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputChave: { fontFamily: 'monospace', minHeight: 72, textAlignVertical: 'top' },
  error: { color: '#f87171', fontSize: 13 },
  revealToggle: { alignSelf: 'flex-end', paddingVertical: 4 },
  revealToggleText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  button: {
    backgroundColor: '#4ade80',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  cancelText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 4 },
});
