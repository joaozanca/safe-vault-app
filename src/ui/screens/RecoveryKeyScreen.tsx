import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { bytesToHex } from '../../crypto/encoding';
import {
  confirmarChaveDeRecuperacao,
  gerarChaveDeRecuperacao,
  type RecoveryKeyGerada,
} from '../../domain/VaultService';
import { acessivel } from '../acessibilidade';

interface Props {
  /** Senha mestra recém-confirmada — usada só pra desembrulhar a DEK aqui. */
  masterPassword: string;
  onConfirmed: () => void;
}

/**
 * Tela de exibição única da chave de recuperação (H2.1). Gera a chave ao
 * montar e só grava o embrulho no cabeçalho depois que o usuário confirma
 * ativamente que guardou — ver `gerarChaveDeRecuperacao`/
 * `confirmarChaveDeRecuperacao` em VaultService.ts para o porquê desse
 * desenho (a ausência do embrulho no cabeçalho é o próprio sinal de "ainda
 * não configurado", sem precisar de uma flag separada).
 *
 * Não chama `usePreventScreenCapture` aqui — desde o H3.4 isso é ligado uma
 * vez só, pro app inteiro, em App.tsx.
 */
export function RecoveryKeyScreen({ masterPassword, onConfirmed }: Props) {
  const [gerada, setGerada] = useState<RecoveryKeyGerada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    gerarChaveDeRecuperacao(masterPassword)
      .then(setGerada)
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  }, [masterPassword]);

  async function handleContinuar() {
    if (!gerada) return;
    setSalvando(true);
    try {
      await confirmarChaveDeRecuperacao(gerada.wrap);
      onConfirmed();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chave de recuperação</Text>
      <Text style={styles.subtitle}>
        Esta chave é a única forma de entrar no cofre se você esquecer a senha mestra. Ela só
        aparece <Text style={styles.subtitleDestaque}>uma vez</Text> — guarde num lugar seguro
        (gerenciador de senhas, cofre físico) antes de continuar.
      </Text>

      {erro && (
        <Text testID="vault.recovery.error-message" style={styles.error}>
          {erro}
        </Text>
      )}

      {!gerada && !erro && <ActivityIndicator color="#4ade80" size="large" />}

      {gerada && (
        <>
          <Text testID="vault.recovery.key-text" selectable style={styles.chave}>
            {formatarChaveDeRecuperacao(bytesToHex(gerada.recoveryKey))}
          </Text>

          <Pressable
            testID="vault.recovery.confirm-checkbox"
            style={[acessivel.alvoDeToque, styles.checkboxRow]}
            onPress={() => setConfirmado((v) => !v)}
          >
            <View style={[styles.checkbox, confirmado && styles.checkboxMarcado]}>
              {confirmado && <Text style={styles.checkboxMarca}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Guardei esta chave em local seguro</Text>
          </Pressable>

          <Pressable
            testID="vault.recovery.submit-button"
            style={[
              acessivel.alvoDeToque,
              styles.button,
              (!confirmado || salvando) && styles.buttonDisabled,
            ]}
            onPress={handleContinuar}
            disabled={!confirmado || salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.buttonText}>Continuar</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

/** `a1b2c3d4...` (64 hex) → `a1b2-c3d4-...` em blocos de 4, mais fácil de copiar à mão. */
function formatarChaveDeRecuperacao(hex: string): string {
  return (hex.match(/.{1,4}/g) ?? [hex]).join('-');
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
  subtitleDestaque: { color: '#fbbf24', fontWeight: '700' },
  error: { color: '#f87171', fontSize: 13 },
  chave: {
    color: '#4ade80',
    fontFamily: 'monospace',
    fontSize: 16,
    lineHeight: 24,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    letterSpacing: 1,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#4ade80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMarcado: { backgroundColor: '#4ade80' },
  checkboxMarca: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  checkboxLabel: { color: '#f8fafc', fontSize: 14, flexShrink: 1 },
  button: {
    backgroundColor: '#4ade80',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
});
