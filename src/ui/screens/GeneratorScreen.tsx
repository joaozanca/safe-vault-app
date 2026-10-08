import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  gerarSenha,
  GENERATOR_MAX_LENGTH,
  GENERATOR_MIN_LENGTH,
  OPCOES_PADRAO,
  OpcoesGeradorInvalidasError,
  type OpcoesGerador,
} from '../../domain/PasswordGenerator';
import { calcularForcaSenha, type ForcaSenha } from '../../domain/PasswordStrength';
import { acessivel } from '../acessibilidade';

interface Props {
  onUsar: (senha: string) => void;
  onCancelar: () => void;
}

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

/**
 * H4.1 — painel de gerador de senhas, mostrado como sobreposição de tela
 * cheia dentro de `CredentialFormScreen` (não um estado de tela do
 * `App.tsx`): "usar esta senha" só precisa devolver um valor pro campo que
 * já está ali, não navegar pra lugar nenhum — mesmo raciocínio que já levou
 * `ConfirmDialog`/`Toast` a serem componentes, não telas na árvore do app.
 *
 * Gera de novo automaticamente a cada opção alterada — nenhum botão
 * "gerar" separado, só "gerar outra" com as mesmas opções.
 */
export function GeneratorScreen({ onUsar, onCancelar }: Props) {
  const [opcoes, setOpcoes] = useState<OpcoesGerador>(OPCOES_PADRAO);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function regenerar(novasOpcoes: OpcoesGerador) {
    try {
      setSenha(gerarSenha(novasOpcoes));
      setErro(null);
    } catch (e) {
      setSenha('');
      setErro(e instanceof OpcoesGeradorInvalidasError ? e.message : String(e));
    }
  }

  useEffect(() => {
    regenerar(opcoes);
  }, [opcoes]);

  function atualizarOpcao<K extends keyof OpcoesGerador>(chave: K, valor: OpcoesGerador[K]) {
    setOpcoes((atual) => ({ ...atual, [chave]: valor }));
  }

  const forca = senha.length > 0 ? calcularForcaSenha(senha) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gerador de senhas</Text>

      <View style={styles.resultBox}>
        <Text testID="generator.form.result-text" selectable style={styles.resultText}>
          {senha || '—'}
        </Text>
      </View>
      {forca && (
        <Text style={[styles.forcaText, { color: FORCA_COR[forca] }]}>
          Força: {FORCA_LABEL[forca]}
        </Text>
      )}
      {erro && (
        <Text testID="generator.form.error-message" style={styles.error}>
          {erro}
        </Text>
      )}

      <Pressable
        testID="generator.form.regenerate-button"
        style={[acessivel.alvoDeToque, styles.regenerateButton]}
        onPress={() => regenerar(opcoes)}
      >
        <Text style={styles.regenerateButtonText}>Gerar outra</Text>
      </Pressable>

      <View testID="generator.form.length-slider" style={styles.linha}>
        <Text testID="generator.form.length-slider.value-text" style={styles.linhaLabel}>
          Tamanho: {opcoes.tamanho}
        </Text>
        <View style={styles.steppers}>
          <Pressable
            testID="generator.form.length-slider.decrease-button"
            accessibilityRole="button"
            accessibilityLabel="Diminuir tamanho"
            style={[acessivel.alvoDeToque, styles.stepperButton]}
            onPress={() =>
              atualizarOpcao('tamanho', Math.max(GENERATOR_MIN_LENGTH, opcoes.tamanho - 1))
            }
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>
          <Pressable
            testID="generator.form.length-slider.increase-button"
            accessibilityRole="button"
            accessibilityLabel="Aumentar tamanho"
            style={[acessivel.alvoDeToque, styles.stepperButton]}
            onPress={() =>
              atualizarOpcao('tamanho', Math.min(GENERATOR_MAX_LENGTH, opcoes.tamanho + 1))
            }
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.linha}>
        <Text style={styles.linhaLabel}>Maiúsculas (A-Z)</Text>
        <Switch
          style={acessivel.alvoDeToque}
          testID="generator.form.uppercase-toggle"
          accessibilityLabel="Maiúsculas (A-Z)"
          value={opcoes.maiusculas}
          onValueChange={(v) => atualizarOpcao('maiusculas', v)}
        />
      </View>
      <View style={styles.linha}>
        <Text style={styles.linhaLabel}>Minúsculas (a-z)</Text>
        <Switch
          style={acessivel.alvoDeToque}
          testID="generator.form.lowercase-toggle"
          accessibilityLabel="Minúsculas (a-z)"
          value={opcoes.minusculas}
          onValueChange={(v) => atualizarOpcao('minusculas', v)}
        />
      </View>
      <View style={styles.linha}>
        <Text style={styles.linhaLabel}>Números (0-9)</Text>
        <Switch
          style={acessivel.alvoDeToque}
          testID="generator.form.digits-toggle"
          accessibilityLabel="Números (0-9)"
          value={opcoes.numeros}
          onValueChange={(v) => atualizarOpcao('numeros', v)}
        />
      </View>
      <View style={styles.linha}>
        <Text style={styles.linhaLabel}>Símbolos (!@#...)</Text>
        <Switch
          style={acessivel.alvoDeToque}
          testID="generator.form.symbols-toggle"
          accessibilityLabel="Símbolos"
          value={opcoes.simbolos}
          onValueChange={(v) => atualizarOpcao('simbolos', v)}
        />
      </View>
      <View style={styles.linha}>
        <Text style={styles.linhaLabel}>Excluir ambíguos (0/O, 1/l/I)</Text>
        <Switch
          style={acessivel.alvoDeToque}
          testID="generator.form.ambiguous-toggle"
          accessibilityLabel="Excluir caracteres ambíguos (0, O, 1, l, I)"
          value={opcoes.excluirAmbiguos}
          onValueChange={(v) => atualizarOpcao('excluirAmbiguos', v)}
        />
      </View>

      <Pressable
        testID="generator.form.use-button"
        style={[
          acessivel.alvoDeToque,
          styles.button,
          (senha.length === 0 || !!erro) && styles.buttonDisabled,
        ]}
        onPress={() => onUsar(senha)}
        disabled={senha.length === 0 || !!erro}
      >
        <Text style={styles.buttonText}>Usar esta senha</Text>
      </Pressable>
      <Pressable
        style={acessivel.alvoDeToque}
        testID="generator.form.cancel-link"
        onPress={onCancelar}
      >
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f172a',
    padding: 24,
    gap: 10,
  },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  resultBox: { backgroundColor: '#1e293b', borderRadius: 8, padding: 16 },
  resultText: { color: '#4ade80', fontFamily: 'monospace', fontSize: 17, lineHeight: 24 },
  forcaText: { fontSize: 13, fontWeight: '700' },
  error: { color: '#f87171', fontSize: 13 },
  regenerateButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  regenerateButtonText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  linhaLabel: { color: '#f8fafc', fontSize: 14 },
  steppers: { flexDirection: 'row', gap: 8 },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  button: {
    backgroundColor: '#4ade80',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  cancelText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});
