# Notas de release — Sprint 5 · SafeVault v1.0.0

**Data de encerramento:** 2026-10-14
**Tag:** `sprint-5`
**Versão do app:** 1.0.0 (código de versão 2)
**Decisão de release:** ✅ **liberada pelo QA** — ver [critérios de saída](../sprint-5/criterios-de-saida.md)

## Objetivo da sprint

Endurecimento, regressão e decisão de release: transformar "funciona" em "posso confiar
minha senha real nisto".

## Entregue

- **H5.1 — Criptografia em aparelho físico**: o QA testou o APK de release num Android
  real; criar e desbloquear o cofre ficaram na faixa ótima (≤ 1,5 s).
- **H5.2 — Bateria de segurança**: nenhum segredo no logcat nem nos arquivos do app;
  10.000 cifragens sem nonce repetido; arquivo do cofre indistinguível de ruído;
  gravação tudo-ou-nada ao matar o app no meio.
- **H5.3 — Suíte de regressão + pipeline**: 67 testes E2E (Python + Appium + pytest +
  Allure, Page Objects) e pipeline no GitHub Actions com 3 jobs — lint/tipos/unitários,
  E2E num emulador contra o **APK de release**, e geração do **APK para celular (arm64)**.
  [Matriz de cobertura](../sprint-5/matriz-cobertura.md) liga cada critério de aceite ao
  seu teste.
- **H5.4 — Acessibilidade e polimento**: área de toque mínima de 48 dp, nomes para o
  leitor de tela, contraste WCAG ≥ 4,5:1 e telas que rolam com fonte/tela ampliadas;
  teste automático em 3 cenários (fonte normal, fonte 200% e tela ampliada).
- **H5.5 — Critérios de saída e decisão de release**: a checklist de release, que nunca
  tinha sido escrita, montada risco por risco a partir da análise de risco.
- **[Perguntas frequentes de segurança](../seguranca-perguntas-frequentes.md)** para quem
  vai usar o app, sem termos técnicos.

**Testes:** 205 unitários (Jest) e 67 E2E (60 na suíte rápida, 7 com a marca `lento`).

## Defeitos encontrados e corrigidos na sprint

Todos com teste automatizado que os impede de voltar; os achados no aparelho real foram
retestados pelo QA.

| Defeito | Como foi achado | Severidade |
|---|---|---|
| Aviso "houve N tentativas erradas" (critério do H1.2) nunca implementado | análise de cobertura do QA | média |
| Bloqueio por tentativas só aparecia na 6ª tentativa | automação do H1.2 | baixa |
| Chaves não zeradas da memória ao trancar (critério do H3.3) | checklist de release | média |
| Teclado podia sugerir/aprender a chave de recuperação e a senha revelada | checklist de release | média |
| Áreas de toque pequenas, interruptores sem nome, contraste baixo | auditoria de acessibilidade | média |
| Menu fora da tela com fonte em 200% — "Trancar" inalcançável | teste exploratório do QA | **alta** |
| Telas sem rolagem: botões inalcançáveis com tela ampliada | QA no aparelho físico | **alta** |
| Chave de recuperação: cofre trancava aos 3 min enquanto a pessoa copiava, e a chave mudava sem aviso | QA no aparelho físico | **alta** |

## Limitações conhecidas (aceitas pelo QA)

| # | Limitação |
|---|---|
| L2 | Acento por tecla morta não compõe nos campos de senha (Issue #1, plataforma) — a senha mestra recusa acentos, então isso não tranca o dono fora do cofre |
| L3 | Colar não funciona nos campos de texto (limitação do React Native/Fabric) — a chave de recuperação precisa ser digitada |
| L4 | Senha mestra e chave em texto ficam na memória até o coletor de lixo (strings do JavaScript não podem ser zeradas); as cópias em bytes são zeradas |
| L5 | Com a senha **revelada**, o teclado recebe só "sem sugestões" (o sinal de "não aprender" não é exposto pelo React Native); no teste real, o teclado não aprendeu |
| L6 | A senha copiada pode ficar na área de transferência se o app for encerrado à força antes dos 30 s |
| L8 | O emulador da pipeline às vezes demora a ficar pronto ou trava o desenho da primeira tela; a pipeline espera os serviços do Android e reabre o app uma vez no arranque, registrando quando isso acontece |

## Ideias registradas para a próxima versão

- Chave de recuperação num formato mais fácil de anotar (ex.: 24 palavras).
- Biometria ao reabrir o app, exigindo a senha só depois de reiniciar o aparelho.

## Como instalar

O APK de release para celular sai da pipeline a cada execução: aba **Actions** →
execução mais recente → artefato **`safevault-release-arm64-celular`**. O app é
distribuído fora da Play Store, então o Android pede para permitir "instalar apps
desconhecidos" e o Play Protect pode avisar — é esperado.
