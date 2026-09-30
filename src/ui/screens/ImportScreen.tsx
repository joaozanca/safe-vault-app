import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';

import {
  criarBackupDeSegurancaAntesDeImportar,
  escolherArquivoParaImportar,
  lerArquivoExportado,
  substituirCofre,
} from '../../domain/BackupService';

interface PropsNovoCofre {
  modo: 'novo-cofre';
  onImportado: () => void;
  onCancelar: () => void;
}

interface PropsSubstituir {
  modo: 'substituir';
  db: DB;
  masterPassword: string;
  onImportado: () => void;
  onCancelar: () => void;
}

type Props = PropsNovoCofre | PropsSubstituir;

/**
 * Tela de importação (H2.4). Dois modos, mesma mecânica de decifrar +
 * substituir por baixo:
 *
 * - `novo-cofre`: sem cofre neste aparelho ainda (ex.: restaurando num
 *   aparelho novo) — nada a perder, sem confirmação extra.
 * - `substituir`: já existe um cofre aqui, e importar vai **apagá-lo** (sem
 *   mesclagem, decisão do refinamento de 2026-09-24) — exige confirmação
 *   ativa e faz um backup de segurança automático antes de sobrescrever
 *   (ver `criarBackupDeSegurancaAntesDeImportar`).
 */
export function ImportScreen(props: Props) {
  const { modo, onImportado, onCancelar } = props;

  const [arquivo, setArquivo] = useState<{ conteudo: string; nomeArquivo: string } | null>(null);
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleEscolherArquivo() {
    setErro(null);
    const escolhido = await escolherArquivoParaImportar();
    if (escolhido) setArquivo(escolhido);
  }

  async function handleImportar() {
    if (!arquivo) return;
    setErro(null);
    setCarregando(true);
    try {
      const { vaultHeader, dbFileBase64 } = await lerArquivoExportado(arquivo.conteudo, senha);

      if (modo === 'substituir') {
        await criarBackupDeSegurancaAntesDeImportar(props.db, props.masterPassword);
        await substituirCofre(vaultHeader, dbFileBase64, props.db);
      } else {
        await substituirCofre(vaultHeader, dbFileBase64);
      }

      onImportado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setCarregando(false);
    }
  }

  const podeImportar = arquivo !== null && senha.length > 0 && (modo === 'novo-cofre' || confirmado);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Importar cofre</Text>
      <Text style={styles.subtitle}>
        Restaura um cofre a partir de um arquivo `.safevault` exportado antes. Depois de
        importar, desbloqueia normalmente com a senha mestra de quando aquele cofre foi criado
        — a senha aqui é só a de exportação, não a mestra.
      </Text>

      {modo === 'substituir' && (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>
            Isto vai substituir todas as suas credenciais atuais. O cofre atual é salvo
            automaticamente antes, cifrado com a sua senha mestra de hoje — mas a troca em si não
            tem volta pela tela do app.
          </Text>
        </View>
      )}

      <Pressable
        testID="backup.import.file-picker-button"
        style={styles.button}
        onPress={handleEscolherArquivo}
        disabled={carregando}
      >
        <Text style={styles.buttonText}>
          {arquivo ? 'Trocar arquivo' : 'Selecionar arquivo'}
        </Text>
      </Pressable>

      {arquivo && (
        <Text testID="backup.import.file-name-text" style={styles.nomeArquivo}>
          {arquivo.nomeArquivo}
        </Text>
      )}

      {arquivo && (
        <>
          <TextInput
            testID="backup.import.password-input"
            style={styles.input}
            placeholder="Senha de exportação"
            placeholderTextColor="#64748b"
            secureTextEntry={!senhaVisivel}
            autoComplete="off"
            importantForAutofill="no"
            value={senha}
            onChangeText={setSenha}
            editable={!carregando}
          />
          <Pressable
            testID="backup.import.reveal-toggle"
            style={styles.revealToggle}
            onPress={() => setSenhaVisivel((v) => !v)}
          >
            <Text style={styles.revealToggleText}>
              {senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            </Text>
          </Pressable>
        </>
      )}

      {arquivo && modo === 'substituir' && (
        <Pressable
          testID="backup.import.confirm-checkbox"
          style={styles.checkboxRow}
          onPress={() => setConfirmado((v) => !v)}
        >
          <View style={[styles.checkbox, confirmado && styles.checkboxMarcado]}>
            {confirmado && <Text style={styles.checkboxMarca}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            Entendo que isso vai substituir todas as credenciais atuais
          </Text>
        </Pressable>
      )}

      {erro && (
        <Text testID="backup.import.error-message" style={styles.error}>
          {erro}
        </Text>
      )}

      <Pressable
        testID="backup.import.submit-button"
        style={[
          styles.button,
          styles.buttonPrimario,
          (!podeImportar || carregando) && styles.buttonDisabled,
        ]}
        onPress={handleImportar}
        disabled={!podeImportar || carregando}
      >
        {carregando ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonTextPrimario}>Importar</Text>
        )}
      </Pressable>

      <Pressable testID="backup.import.cancel-link" onPress={onCancelar} disabled={carregando}>
        <Text style={styles.cancelText}>Cancelar</Text>
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
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 4, lineHeight: 18 },
  aviso: {
    backgroundColor: '#3f1d1d',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  avisoTexto: { color: '#fecaca', fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  nomeArquivo: { color: '#94a3b8', fontSize: 13, fontFamily: 'monospace' },
  error: { color: '#f87171', fontSize: 13 },
  revealToggle: { alignSelf: 'flex-end', paddingVertical: 4 },
  revealToggleText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
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
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPrimario: { backgroundColor: '#4ade80' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  buttonTextPrimario: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  cancelText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 4 },
});
