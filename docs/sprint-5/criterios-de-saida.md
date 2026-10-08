# Critérios de saída da v1 — checklist de release (H5.5)

Este é o documento sobre o qual o QA decide **liberar ou não** a primeira versão do
SafeVault. Ele foi montado a partir da [análise de risco](../sprint-0/analise-de-risco.md):
cada risco tem uma mitigação, e a release só sai se cada mitigação estiver **comprovada**
(teste ou verificação registrada) ou for uma **limitação aceita conscientemente**.

> **Achado de processo:** a história H5.5 pedia para "fechar a checklist de release
> definida na Sprint 1", mas essa checklist nunca chegou a ser escrita — só citada na
> análise de risco (R9). Este documento é ela.

**Legenda:** ✅ comprovado · ⚠️ comprovado em parte / limitação aceita · ❌ pendente

---

## 1. Portões obrigatórios (bloqueiam a release se falharem)

| Portão | Situação | Evidência |
|---|---|---|
| Testes unitários | ✅ | 202/202 (Jest), rodando na pipeline a cada push |
| Suíte E2E rápida | ✅ | 59/59 no emulador local; pipeline com APK de release |
| Suíte E2E completa (com os testes `lento`) | ✅ | os 6 testes `lento` estáveis em 3 rodadas cada (bloqueio de 30 s, clipboard, auto-lock) |
| Lint e checagem de tipos | ✅ | `npm run lint` e `tsc --noEmit` sem erros, na pipeline |
| Nenhum defeito conhecido de severidade alta em aberto | ✅ | todos os defeitos da seção 4 foram corrigidos e retestados |
| Invariantes de segurança no **build de release** | ✅ | manifesto do APK da pipeline: `allowBackup="false"`, `dataExtractionRules` presente, não depurável; FLAG_SECURE testado pela suíte contra o APK de release |
| Critérios de aceite rastreados | ✅ | [matriz de cobertura](matriz-cobertura.md) |

## 2. Riscos da análise × evidência

| Risco | Mitigação prevista | Situação | Evidência |
|---|---|---|---|
| **R1** Derivação de chave | piso 19 MiB/t=2/p=1; salt persistido; verificação pela auth tag; senha fora do log | ⚠️ | unitários (`kdf`, `calibration`, `VaultService`); logcat limpo no H5.2. **Calibração em aparelho físico não feita** (H5.1, ver seção 3) |
| **R2** Chave de recuperação | exibição única, FLAG_SECURE, confirmação ativa, rotação, chave errada recusada | ✅ | E2E `test_recuperacao.py` (7 testes, inclusive chave abandonada e rotação) e `test_cofre.py` |
| **R3** Cifra / nonce | nonce do CSPRNG, auth tag sempre verificada | ✅ | invariante de 10.000 nonces sem repetição (`cipher.test.ts`); adulteração recusada nos unitários |
| **R4** Keystore / biometria | só chaves embrulhadas; biometria opt-in, invalidada ao mudar digitais | ✅ | H5.2 item 2 (nenhum segredo nos arquivos do app); verificação manual com digital virtual (Sprint 3); `BiometricService.test.ts` |
| **R5** Exportar / importar | sem exportar sem senha; validação antes de tocar no cofre; formato versionado | ⚠️ | unitários + verificação manual (Sprint 2). Fora da automação E2E de propósito (seletor de arquivos do sistema). Escrita "atômica" com garantia menor que a prevista (ver backlog, H2.4) |
| **R6** Migração de esquema | `formatVersion` desde a v1 | ✅ (n/a na v1) | não há migração na v1; o versionamento existe para a v2 |
| **R7** Memória e ciclo de vida | chaves zeradas ao trancar; FLAG_SECURE; tela neutra no recentes; clipboard; teclado sem sugestão | ⚠️ | chaves zeradas: **corrigido nesta sprint** (seção 4), unitários; FLAG_SECURE: E2E; recentes: manual; clipboard: E2E `lento`; teclado: **corrigido nesta sprint**, E2E `test_teclado_segredos.py`. Limitações na seção 3 |
| **R8** Aleatoriedade | só CSPRNG; `Math.random` proibido | ✅ | regra de lint; `csprng.test.ts` |
| **R9** Stack / release | proteções iguais em debug e release | ✅ | suíte E2E roda contra o APK de release na pipeline; manifesto conferido |
| **R10** UX que induz ao erro | textos de consequência; mensagens genéricas | ✅ | mensagens genéricas testadas (senha e chave inválidas); acessibilidade auditada e corrigida (H5.4) |

## 3. Riscos e limitações conhecidas (aceitas para a v1)

Nenhum destes bloqueia a release, mas **cada um precisa ser aceito conscientemente** e vai
para as notas de release.

| # | Limitação | Impacto | Por que é aceitável na v1 |
|---|---|---|---|
| L1 | **Argon2id calibrado só em emulador** (H5.1 adiado: o QA não tem aparelho Android) | num celular fraco, criar/abrir o cofre pode ser mais lento que o alvo; num forte, a proteção poderia ser maior | o piso de segurança (19 MiB/t=2) vale em qualquer aparelho; a calibração só sobe a partir dele |
| L2 | **Issue #1 — tecla morta** (acento composto não compõe nos campos de senha) | um acento digitado com tecla morta pode sair diferente | a senha mestra **recusa acentos** desde o H1.1, então o defeito não pode trancar o dono fora do cofre |
| L3 | **Colar não funciona nos campos de texto** (limitação do React Native/Fabric) | a chave de recuperação precisa ser digitada (64 caracteres) | contorno existe (digitar); defeito de plataforma, não do app |
| L4 | **Senha mestra e chave em texto ficam na memória** até o coletor de lixo | só explorável com acesso à memória do processo (root, dump) | strings em JavaScript são imutáveis; as cópias em bytes são zeradas |
| L5 | **Teclado com a senha REVELADA:** só "sem sugestões" | o React Native não expõe o sinal Android de "não aprender" (`IME_FLAG_NO_PERSONALIZED_LEARNING`) | campo mascarado e chave de recuperação estão protegidos por completo; garantia total exige módulo nativo (v2) |
| L6 | **Clipboard pode ficar se o app for morto antes dos 30 s**; sem marca de conteúdo sensível | a senha copiada pode sobreviver na área de transferência | decisões do refinamento do H3.2 |
| L7 | **TalkBack não testado manualmente** | a ordem e a clareza da leitura não foram avaliadas por uma pessoa | todo controle tem nome (regra automática); operar o TalkBack com mouse no emulador mostrou-se inviável |
| L8 | **Emulador da pipeline instável no arranque** (2 das 4 execuções que chegaram ao emulador falharam por ambiente: o Android não respondia logo após o boot) | execução da pipeline pode falhar sem defeito no app | o app passou em todas as execuções em que o emulador ficou pronto; espera ativa pelo Android pronto adicionada (fix(ci)) |

## 4. Defeitos encontrados e corrigidos na Sprint 5

| Defeito | Origem | Severidade | Situação |
|---|---|---|---|
| Aviso "houve N tentativas erradas" nunca implementado (H1.2) | análise de cobertura do QA | média | ✅ corrigido, unitário + E2E, retestado pelo QA |
| Bloqueio só aparecia na 6ª tentativa e não ao reabrir o app (H1.2) | automação do H1.2 | baixa | ✅ corrigido, E2E |
| Chaves não zeradas da memória ao trancar (critério do H3.3) | checklist de release (H5.5) | média | ✅ corrigido, unitários (prova negativa: sem o zerar, 5 testes falham) |
| Teclado podia sugerir/aprender a chave de recuperação e a senha revelada (R7) | checklist de release (H5.5) | média | ✅ corrigido, E2E medindo o `inputType` (limite residual em L5) |
| Menu do topo fora da tela com fonte em 200% — "Trancar" inalcançável | teste exploratório do QA | **alta** | ✅ corrigido, E2E em fonte normal e 200% |
| Áreas de toque de 18–45 dp, 6 interruptores sem nome, 2 contrastes abaixo de 4,5:1 | auditoria de acessibilidade (H5.4) | média | ✅ corrigido, E2E de acessibilidade |

---

## 5. Recomendação do Tech Lead

**Liberar a v1**, com as limitações L1–L8 publicadas nas notas de release. Todos os
portões obrigatórios estão verdes, todo defeito encontrado na sprint foi corrigido com
teste que o impede de voltar, e nenhuma limitação aberta permite ler o cofre sem a senha
ou trancar o dono fora dele.

O ponto que mais merece atenção é o **L1**: antes de confiar senhas reais a um celular
específico, vale medir o tempo de abertura do cofre nele.

## 6. Decisão do QA

| | |
|---|---|
| **Decisão** | _a preencher pelo QA: liberar / não liberar / liberar com condições_ |
| **Condições ou ressalvas** | |
| **Data** | |
| **Responsável** | João Vitor (QA) |
