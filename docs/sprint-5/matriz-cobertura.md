# Matriz de cobertura — critérios de aceite × testes

Rastreabilidade de cada critério de aceite do [backlog](../sprint-0/backlog-5-sprints.md)
até o teste que o verifica. Montada no H5.3 a partir da análise de cobertura do QA
(2026-10-07), que encontrou dois defeitos no H1.2 — ambos corrigidos e cobertos abaixo.

**Legenda**

| Marca | Significado |
|---|---|
| **E2E** | teste Appium em [`e2e/tests/`](../../e2e/tests/) (roda no app real, no emulador) |
| **Unit** | teste Jest em `src/**/*.test.ts` (lógica isolada, com dublês das libs nativas) |
| **Manual** | verificação manual registrada no backlog, com o procedimento usado |
| **—** | sem teste automatizado; o motivo está na coluna de observação |

Testes marcados `lento` esperam tempo real do app (bloqueio de 30 s, limpeza do clipboard,
auto-lock de 3 min) e podem ser pulados com `pytest -m "not lento"`.

---

## Sprint 1 — Núcleo criptográfico e cofre

| História | Critério | Cobertura | Onde |
|---|---|---|---|
| H1.1 | Primeira execução exige criar e confirmar a senha mestra | E2E | `test_cofre.py::test_criar_cofre_exibe_chave_de_recuperacao_e_abre_lista_vazia`, `::test_criar_cofre_com_confirmacao_diferente_mostra_erro` |
| H1.1 | Política: 8+ caracteres, maiúscula, minúscula, número; sem emoji nem acento | E2E + Unit | `test_cofre.py::test_criar_cofre_com_senha_fraca_mostra_o_problema` (5 casos); `VaultService.test.ts` |
| H1.1 | Argon2id com piso 19 MiB/t=2/p=1; salt de 16 bytes; DEK de 32 bytes embrulhada | Unit | `calibration`, `kdf`, `keyHierarchy`, `csprng`, `VaultService` |
| H1.1 | Criação tudo-ou-nada (sem cofre meio-criado) | Unit | `VaultService.test.ts` |
| H1.2 | Senha correta abre; errada → mensagem genérica, sem abrir o banco | E2E + Unit | `test_cofre.py::test_desbloqueio_com_senha_errada_mantem_cofre_trancado`, `test_credenciais.py`; `VaultService.test.ts` |
| H1.2 | 5 erradas bloqueiam com contagem regressiva exata, já na 5ª | E2E + Unit | `test_desbloqueio.py::test_quinta_senha_errada_ja_mostra_o_bloqueio`; `VaultService`, `UnlockAttemptTracker` |
| H1.2 | Bloqueio persiste ao fechar e reabrir o app | E2E | `test_desbloqueio.py::test_reabrir_o_app_durante_o_bloqueio_ja_mostra_a_contagem` |
| H1.2 | Bloqueio é temporário (nunca permanente) | E2E `lento` | `test_desbloqueio.py::test_senha_certa_volta_a_funcionar_quando_o_bloqueio_termina` |
| H1.2 | Tempo dobra por bloco: 30 s → … → teto de 15 min | Unit | `UnlockAttemptTracker.test.ts` (esperar 15 min reais no E2E não se justifica) |
| H1.2 | Aviso "houve N tentativas erradas" na próxima entrada, uma vez só | E2E + Unit | `test_desbloqueio.py::test_entrar_depois_de_tentativas_erradas_avisa_quantas_foram` (singular e plural), `::test_aviso_de_tentativas_aparece_uma_vez_so`; `UnlockAttemptTracker.test.ts` |
| H1.2 | Desbloqueio ≤ 1,5 s no emulador de referência | — | Não automatizado: depende do hardware; calibração revisada no H5.1 (adiado, risco documentado) |
| H1.3 | `formatVersion = 1`; versão desconhecida recusada | Unit | `secureStore.test.ts`, `BackupService.test.ts` |
| H1.4 | Cripto só em `crypto/`; `Math.random` proibido em `src/` | Lint + Unit | regra `no-restricted-properties` no ESLint; testes de `crypto/` |

## Sprint 2 — Recuperação e portabilidade

| História | Critério | Cobertura | Onde |
|---|---|---|---|
| H2.1 | Chave de 256 bits exibida em blocos de 4 hex | E2E | `test_cofre.py::test_criar_cofre_exibe_chave_de_recuperacao_e_abre_lista_vazia` (formato exato) |
| H2.1 | Exige confirmação ativa para prosseguir | E2E | `test_cofre.py::test_continuar_so_habilita_depois_de_marcar_que_guardou_a_chave` |
| H2.1 | Tela com bloqueio de screenshot | E2E | coberto pelo H3.4 (FLAG_SECURE global) |
| H2.1 | App fechado com a chave na tela → chave nova; a antiga nunca vale | E2E | `test_recuperacao.py::test_chave_exibida_e_nao_confirmada_nunca_vira_porta_de_entrada` |
| H2.2 | Chave válida → obriga senha nova → entra com ela | E2E | `test_recuperacao.py::test_recuperar_com_a_chave_define_senha_nova_e_gera_chave_nova` (com e sem traços) |
| H2.2 | Senha antiga deixa de valer | E2E | `test_recuperacao.py::test_senha_antiga_deixa_de_abrir_o_cofre_apos_recuperacao` |
| H2.2 | Rotação: chave usada deixa de funcionar | E2E + Unit | `test_recuperacao.py::test_chave_ja_usada_deixa_de_funcionar`; `VaultService.test.ts` |
| H2.2 | Chave inválida → mensagem genérica (a mesma para formato errado e chave errada) | E2E | `test_recuperacao.py::test_chave_invalida_mostra_a_mesma_mensagem_generica` |
| H2.3 | Exportar com senha de exportação e indicador de força; nada em claro no arquivo | Unit + Manual | `BackupService.test.ts`; verificação manual 2026-09-30 (seletor de pasta real do Android, arquivo inspecionado) |
| H2.4 | Importar valida antes de tocar no cofre; substitui com backup automático e confirmação | Unit + Manual | `BackupService.test.ts`; verificação manual 2026-09-30 (modos "aparelho novo" e "substituir") |
| H2.5 | Backup rápido em um toque | Manual | verificação manual 2026-09-30 |
| H2.6 | Cofre fora do backup automático do Android | Manual | `bmgr backupnow` → "Backup is not allowed"; app ausente de `dumpsys backup` (2026-09-30) |

> **Fora da automação de propósito (H2.3–H2.5):** passam pelo seletor de arquivos do
> sistema (DocumentsUI), outro app que muda entre versões do Android — automatizar seria
> frágil e caro de manter. Decisão do QA no H5.3 (lotes 1 e 2, sem o lote 3).

## Sprint 3 — Uso diário seguro

| História | Critério | Cobertura | Onde |
|---|---|---|---|
| H3.1 | Criar, ver, editar e excluir (com confirmação) | E2E | `test_credenciais.py`, `test_edicao.py`, `test_exclusao.py` (confirmar e cancelar) |
| H3.1 | Título, usuário e senha obrigatórios | E2E + Unit | `test_formulario.py::test_salvar_sem_campo_obrigatorio_mostra_o_problema` (4 casos, incl. título só com espaços); `CredentialService.test.ts` |
| H3.1 | Limites de tamanho | E2E + Unit | `test_formulario.py` (título: 100 aceito, 101 recusado); demais campos em `CredentialService.test.ts` |
| H3.1 | Campos opcionais persistidos | E2E | `test_formulario.py::test_campos_opcionais_sao_salvos_e_voltam_ao_reabrir` |
| H3.1 | Senha mascarada por padrão, com revelar | E2E | `test_formulario.py::test_senha_fica_mascarada_ate_tocar_em_mostrar` |
| H3.1 | Editar sem deixar versão antiga decifrável em disco | Unit + Manual | `secure_delete = ON` (`database.test.ts`); H5.2 item 4 (arquivo indistinguível de ruído) |
| H3.2 | Copiar mostra aviso com contagem e limpa em 30 s | E2E `lento` + Unit | `test_clipboard.py::test_senha_copiada_some_da_area_de_transferencia_em_30_s`; `ClipboardService.test.ts` |
| H3.2 | Não apaga o que o usuário copiou depois | E2E `lento` + Unit | `test_clipboard.py::test_limpeza_nao_apaga_o_que_o_usuario_copiou_depois` |
| H3.2 | Marcar conteúdo como sensível (Android 13+) | — | Fora de escopo: sem suporte no `expo-clipboard` (decisão do refinamento) |
| H3.2 | App morto antes dos 30 s | — | Limitação aceita no refinamento (sem serviço em background) |
| H3.3 | Tranca após 3 min parado (e não antes) | E2E `lento` + Unit | `test_auto_lock.py::test_cofre_tranca_sozinho_depois_de_3_minutos_parado`; `AutoLockController.test.ts` |
| H3.3 | Background conta no mesmo timer: voltar antes de 3 min não tranca; depois, tranca | E2E `lento` | `test_auto_lock.py::test_ir_a_outro_app_e_voltar_antes_de_3_minutos_nao_tranca`, `::test_ficar_mais_de_3_minutos_em_outro_app_tranca_ao_voltar` |
| H3.3 | Toque reinicia o timer | Unit | `AutoLockController.test.ts` (no E2E custaria mais 5 min de espera por execução) |
| H3.4 | Screenshot do app sai preta | E2E | `test_seguranca_tela.py` (com controle positivo na tela inicial do Android) |
| H3.4 | Prévia neutra no app switcher | Manual | verificação manual da Sprint 3 (o Appium não captura a tela de recentes) |
| H3.5 | Biometria opt-in, invalidada por troca de digital, nunca na 1ª abertura do processo | Unit + Manual | `BiometricService.test.ts`; verificação manual com digital virtual do emulador (Sprint 3) |

## Sprint 4 — Ferramentas de senha e organização

| História | Critério | Cobertura | Onde |
|---|---|---|---|
| H4.1 | Tamanho 8–64, padrão 16 | E2E + Unit | `test_gerador.py::test_senha_gerada_tem_o_tamanho_padrao`, `::test_tamanho_para_nos_limites_e_a_senha_acompanha` (8 e 64); `PasswordGenerator.test.ts` |
| H4.1 | Classes configuráveis; ao menos 1 de cada classe marcada | E2E + Unit | `test_gerador.py::test_desligar_maiusculas_gera_senha_sem_letra_maiuscula`, `::test_desligar_todas_as_classes_mostra_erro_e_bloqueia_usar`; `PasswordGenerator.test.ts` |
| H4.1 | Excluir ambíguos | E2E | `test_gerador.py::test_excluir_ambiguos_gera_senha_sem_0_O_1_l_I` |
| H4.1 | "Usar" preenche o campo senha | E2E | `test_gerador.py::test_usar_senha_gerada_preenche_o_campo_senha_do_formulario` |
| H4.1 | Só CSPRNG; nunca loga a senha | Unit + Manual | `csprng.test.ts`, lint de `Math.random`; H5.2 item 1 (logcat) |
| H4.2 | Indicador de força local | E2E + Unit | `test_senhas.py::test_indicador_mostra_a_forca_da_senha_digitada` (5 casos, incl. limite 15/16); `PasswordStrength.test.ts` |
| H4.3 | Aviso de senha repetida com quantidade e títulos, sem a senha | E2E + Unit | `test_senhas.py::test_mesma_senha_em_duas_credenciais_gera_aviso_com_os_titulos`, `::test_senhas_diferentes_nao_geram_aviso`; `PasswordReuseDetector.test.ts` |
| H4.4 | Busca por título, usuário e URL, sem diferenciar maiúsculas | E2E | `test_busca.py`, `test_busca_filtro.py` |
| H4.4 | Filtro por categoria | E2E | `test_busca_filtro.py::test_filtro_por_categoria_mostra_so_as_dela_e_todas_volta_tudo` |
| H4.4 | Termo de busca não persiste | E2E | `test_busca_filtro.py::test_busca_nao_fica_salva_depois_de_trancar` |

## Sprint 5 — Endurecimento

| História | Critério | Cobertura | Onde |
|---|---|---|---|
| H5.1 | Calibração do KDF em aparelho físico | — | Adiado com risco documentado (QA sem aparelho Android); entra nos critérios de saída do H5.5 |
| H5.2 | Logcat, diretório do app, nonce, arquivo em repouso, matar o app gravando | Unit + Manual | nonce: `cipher.test.ts` (10.000 cifragens); demais itens: bateria manual de 2026-10-05 no backlog |
| H5.3 | Suíte de regressão + pipeline | — | Esta suíte; pipeline em andamento |

---

## Como cada teste novo foi validado

Todo teste E2E desta matriz passou pelo mesmo ciclo antes do commit:

1. **3 rodadas seguidas verdes** (testes instáveis foram investigados e corrigidos na espera,
   nunca com `sleep` fixo — a única espera de tempo fixo é a do auto-lock, onde o tempo é o
   próprio requisito).
2. **Prova negativa:** o teste foi forçado a encontrar o defeito — revertendo a correção ou
   quebrando a regra no próprio app (aviso de tentativas, bloqueio na 5ª errada, FLAG_SECURE,
   exclusão de ambíguos, limpeza do clipboard, tempo do auto-lock) ou deslocando o limite no
   teste (tamanho do título, número de tentativas).
3. **Suíte inteira verde** quando a mudança tocou em fixture ou Page Object compartilhado.
