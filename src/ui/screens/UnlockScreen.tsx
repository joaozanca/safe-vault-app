import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import { unlockVault, VaultLockedError } from '../../domain/VaultService';

interface Props {
  /** Senha mestra junto porque, se a recuperação (H2.1) ainda estiver
   * pendente, a próxima tela precisa dela de novo pra desembrulhar a DEK. */
  onUnlocked: (db: DB, masterPassword: string) => void;
  /** H2.2 — "esqueci a senha", troca pra tela de chave de recuperação. */
  onEsqueciSenha: () => void;
}

/**
 * Tela de desbloqueio (H1.2). Trata `VaultLockedError` de um jeito
 * diferente dos outros erros: em vez de só mostrar a mensagem uma vez,
 * guarda `remainingMs` e roda um contador regressivo real na tela (H1.2 —
 * "contagem regressiva exata, não mensagem genérica sem tempo"), reabrindo
 * o botão sozinho quando o tempo acaba.
 */
export function UnlockScreen({ onUnlocked, onEsqueciSenha }: Props) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [bloqueadoAteMs, setBloqueadoAteMs] = useState<number | null>(null);
  const [restanteMs, setRestanteMs] = useState(0);
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (bloqueadoAteMs === null) return;

    const tick = () => {
      const restante = Math.max(0, bloqueadoAteMs - Date.now());
      setRestanteMs(restante);
      if (restante <= 0) {
        setBloqueadoAteMs(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bloqueadoAteMs]);

  async function handleSubmit() {
    setErro(null);
    setCarregando(true);
    try {
      const db = await unlockVault(senha);
      onUnlocked(db, senha);
    } catch (e) {
      if (e instanceof VaultLockedError) {
        setBloqueadoAteMs(Date.now() + e.remainingMs);
      } else {
        setErro(e instanceof Error ? e.message : String(e));
      }
      setCarregando(false);
    }
  }

  const bloqueado = bloqueadoAteMs !== null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Desbloquear cofre</Text>

      <TextInput
        testID="unlock.password.password-input"
        style={styles.input}
        placeholder="Senha mestra"
        placeholderTextColor="#64748b"
        secureTextEntry={!senhaVisivel}
        autoComplete="off"
        importantForAutofill="no"
        value={senha}
        onChangeText={setSenha}
        editable={!carregando && !bloqueado}
      />

      <Pressable
        testID="unlock.password.reveal-toggle"
        style={styles.revealToggle}
        onPress={() => setSenhaVisivel((v) => !v)}
      >
        <Text style={styles.revealToggleText}>
          {senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
        </Text>
      </Pressable>

      {erro && (
        <Text testID="unlock.password.error-message" style={styles.error}>
          {erro}
        </Text>
      )}

      {bloqueado && (
        <Text testID="unlock.password.lockout-message" style={styles.lockout}>
          Bloqueado por excesso de tentativas. Tente novamente em {formatMMSS(restanteMs)}.
        </Text>
      )}

      <Pressable
        testID="unlock.password.submit-button"
        style={[styles.button, (carregando || bloqueado) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={carregando || bloqueado}
      >
        {carregando ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Desbloquear</Text>
        )}
      </Pressable>

      <Pressable testID="unlock.password.forgot-link" onPress={onEsqueciSenha} disabled={carregando}>
        <Text style={styles.forgotText}>Esqueci minha senha</Text>
      </Pressable>
    </View>
  );
}

/** `4:32` — minutos:segundos, sempre com 2 dígitos nos segundos. */
function formatMMSS(ms: number): string {
  const totalSegundos = Math.ceil(ms / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${minutos}:${String(segundos).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { color: '#f87171', fontSize: 13 },
  lockout: { color: '#fbbf24', fontSize: 13 },
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
  forgotText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 4 },
});
