import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import {
  exportarCofre,
  salvarArquivoExportado,
  sugerirNomeArquivo,
} from '../../domain/BackupService';
import { calcularForcaSenha, type ForcaSenha } from '../../domain/PasswordStrength';
import { acessivel, COR_PLACEHOLDER } from '../acessibilidade';

interface Props {
  db: DB;
  onVoltar: () => void;
}

const FORCA_LABEL: Record<ForcaSenha, string> = {
  fraca: 'Senha fraca',
  media: 'Senha média',
  forte: 'Senha forte',
};

/**
 * Tela de exportação do cofre (H2.3). Ao contrário da senha mestra, a senha
 * de exportação não tem política obrigatória além de não ser vazia — só um
 * indicador de força (ver `calcularForcaSenha` em PasswordStrength.ts) pra
 * informar a escolha do usuário, não bloquear.
 */
export function ExportScreen({ db, onVoltar }: Props) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const forca = senha.length > 0 ? calcularForcaSenha(senha) : null;

  async function handleExportar() {
    setErro(null);
    setSucesso(false);

    if (senha !== confirmacao) {
      setErro('As senhas digitadas não são iguais.');
      return;
    }

    setCarregando(true);
    try {
      const conteudo = await exportarCofre(db, senha);
      const salvou = await salvarArquivoExportado(conteudo, sugerirNomeArquivo());
      if (salvou) {
        setSucesso(true);
      }
      // `salvou === false` é o usuário cancelando a escolha da pasta — não é
      // erro, só não aconteceu nada; deixa a tela como estava pra tentar de novo.
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Exportar cofre</Text>
      <Text style={styles.subtitle}>
        Gera um arquivo cifrado com todo o cofre, pra guardar fora deste aparelho. Escolha uma senha
        de exportação — você vai precisar dela de novo pra importar este arquivo.
      </Text>

      <TextInput
        testID="backup.export.password-input"
        style={[acessivel.campo, styles.input]}
        placeholder="Senha de exportação"
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
        editable={!carregando}
      />
      <TextInput
        testID="backup.export.password-input.confirm"
        style={[acessivel.campo, styles.input]}
        placeholder="Confirmar senha de exportação"
        placeholderTextColor={COR_PLACEHOLDER}
        secureTextEntry={!senhaVisivel}
        // H5.4/R7: revelada, a senha vira texto comum e o teclado poderia sugerir e
        // APRENDER o que foi digitado; "visible-password" mostra sem aprender.
        keyboardType={senhaVisivel ? 'visible-password' : 'default'}
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        value={confirmacao}
        onChangeText={setConfirmacao}
        editable={!carregando}
      />

      <Pressable
        testID="backup.export.reveal-toggle"
        style={[acessivel.alvoDeToque, styles.revealToggle]}
        onPress={() => setSenhaVisivel((v) => !v)}
      >
        <Text style={styles.revealToggleText}>
          {senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
        </Text>
      </Pressable>

      {forca && (
        <Text testID="backup.export.strength-text" style={styles[`forca_${forca}`]}>
          {FORCA_LABEL[forca]}
        </Text>
      )}

      {erro && (
        <Text testID="backup.export.error-message" style={styles.error}>
          {erro}
        </Text>
      )}

      {sucesso && (
        <Text testID="backup.export.success-message" style={styles.success}>
          Cofre exportado com sucesso.
        </Text>
      )}

      <Pressable
        testID="backup.export.submit-button"
        style={[acessivel.alvoDeToque, styles.button, carregando && styles.buttonDisabled]}
        onPress={handleExportar}
        disabled={carregando}
      >
        {carregando ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Exportar</Text>
        )}
      </Pressable>

      <Pressable
        style={acessivel.alvoDeToque}
        testID="backup.export.cancel-link"
        onPress={onVoltar}
        disabled={carregando}
      >
        <Text style={styles.cancelText}>Voltar</Text>
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
  error: { color: '#f87171', fontSize: 13 },
  success: { color: '#4ade80', fontSize: 13 },
  forca_fraca: { color: '#f87171', fontSize: 13, fontWeight: '600' },
  forca_media: { color: '#fbbf24', fontSize: 13, fontWeight: '600' },
  forca_forte: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
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
