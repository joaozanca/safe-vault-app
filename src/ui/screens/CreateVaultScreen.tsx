import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import { createVault, unlockVault } from '../../domain/VaultService';

interface Props {
  /**
   * Chamado com a conexão já aberta — criar o cofre já deixa ele
   * desbloqueado. A senha mestra vai junto porque a próxima tela (chave de
   * recuperação, H2.1) precisa dela de novo pra desembrulhar a DEK.
   */
  onCreated: (db: DB, masterPassword: string) => void;
}

/**
 * Tela de criação do cofre (H1.1). A validação de política de senha (8+
 * caracteres, maiúscula, minúscula, número) é feita de verdade dentro de
 * `createVault()` — aqui só checamos que as duas senhas digitadas batem,
 * que é uma coisa que só faz sentido checar do lado da UI.
 */
export function CreateVaultScreen({ onCreated }: Props) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  // Um botão só, revela os dois campos juntos — o ponto é comparar se
  // ambos ficaram exatamente iguais (inclusive acento), não conferir um
  // de cada vez.
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  async function handleSubmit() {
    setErro(null);

    if (senha !== confirmacao) {
      setErro('As senhas digitadas não são iguais.');
      return;
    }

    setCarregando(true);
    try {
      await createVault(senha);
      // Criar já valida a senha e monta o cofre — desbloqueia na sequência
      // com a mesma senha pra não pedir de novo o que acabou de digitar.
      const db = await unlockVault(senha);
      onCreated(db, senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Criar cofre</Text>
      <Text style={styles.subtitle}>
        Escolha uma senha mestra. Ela é a única forma de abrir o cofre — sem ela (e sem a chave de
        recuperação, que ainda não existe nesta sprint), os dados ficam irrecuperáveis.
      </Text>

      <TextInput
        testID="vault.create.password-input.master"
        style={styles.input}
        placeholder="Senha mestra"
        placeholderTextColor="#64748b"
        secureTextEntry={!senhaVisivel}
        autoComplete="off"
        importantForAutofill="no"
        value={senha}
        onChangeText={setSenha}
        editable={!carregando}
      />
      <TextInput
        testID="vault.create.password-input.confirm"
        style={styles.input}
        placeholder="Confirmar senha mestra"
        placeholderTextColor="#64748b"
        secureTextEntry={!senhaVisivel}
        autoComplete="off"
        importantForAutofill="no"
        value={confirmacao}
        onChangeText={setConfirmacao}
        editable={!carregando}
      />

      <Pressable
        testID="vault.create.reveal-toggle"
        style={styles.revealToggle}
        onPress={() => setSenhaVisivel((v) => !v)}
      >
        <Text style={styles.revealToggleText}>
          {senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
        </Text>
      </Pressable>

      {erro && (
        <Text testID="vault.create.error-message" style={styles.error}>
          {erro}
        </Text>
      )}

      <Pressable
        testID="vault.create.submit-button"
        style={[styles.button, carregando && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={carregando}
      >
        {carregando ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Criar cofre</Text>
        )}
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
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
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
});
