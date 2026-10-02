# Padrão de `testID` do SafeVault

> Proposta para o QA aprovar/ajustar na Sprint 0. Depois de fechada, vira regra.

---

## 1. O que é `testID` e por que importa

No React Native, `testID` é uma prop que você põe num componente:

```tsx
<TextInput testID="vault.create.master-password-input" ... />
```

Quando o app é compilado, esse valor vira um **identificador que a automação enxerga**:

- no **Android** ele aparece como `resource-id` (o mesmo campo que você inspeciona no
  Appium Inspector);
- para o **Detox**, é o seletor primário (`by.id('...')`).

Ancoragem no que você já usa: é o equivalente ao `data-cy` / `data-testid` que você põe
no HTML para o Cypress e o Playwright. Mesma ideia — um gancho estável que **não muda
quando o time mexe no texto, no estilo ou na estrutura da tela**. Sem ele, a automação
depende de "o botão que tem o texto Salvar", que quebra na primeira tradução ou
redesign.

---

## 2. A convenção

```
<dominio>.<tela>.<elemento>[.<qualificador>]
```

- **minúsculas**, segmentos separados por **ponto** (`.`)
- dentro de um segmento, palavras separadas por **hífen** (`kebab-case`)
- 3 segmentos obrigatórios, o 4º (qualificador) é opcional
- sem acento, sem espaço, sem `id` de banco no meio do nome (ver listas, seção 4)

### Segmento 1 — domínio (a "área" do produto)

| domínio | cobre |
|---|---|
| `vault` | criação do cofre, senha mestra, chave de recuperação |
| `unlock` | telas de desbloqueio (senha, biometria, recuperação) |
| `creds` | CRUD de credenciais, lista, busca, filtro |
| `generator` | gerador de senhas |
| `backup` | exportação, importação, backup manual |
| `settings` | configurações, auto-lock, biometria on/off |
| `common` | componentes reutilizáveis (toast, diálogo, header) |

### Segmento 2 — tela / contexto

Nome curto da tela: `create`, `list`, `form`, `detail`, `confirm`, `success`,
`password`, `biometric`, `recovery`, `export`, `import`.

### Segmento 3 — elemento

O papel do componente, não a aparência: `title-input`, `submit-button`,
`cancel-button`, `search-field`, `category-filter`, `strength-meter`,
`reveal-toggle`, `copy-button`, `length-slider`, `error-message`.

### Segmento 4 — qualificador (opcional)

Para desambiguar quando há vários iguais: `...password-input.master`,
`...password-input.confirm`.

---

## 3. Exemplos por tela (isto vira contrato com o QA)

| Tela | Elemento | `testID` |
|---|---|---|
| Criar cofre | campo senha mestra | `vault.create.password-input.master` |
| Criar cofre | campo confirmar senha | `vault.create.password-input.confirm` |
| Criar cofre | mostrar/ocultar as duas senhas | `vault.create.reveal-toggle` |
| Criar cofre | mensagem de erro (senha fraca / não confere) | `vault.create.error-message` |
| Criar cofre | medidor de força *(ainda não implementado — H4.2, Sprint 4)* | `vault.create.strength-meter` |
| Criar cofre | botão criar | `vault.create.submit-button` |
| Chave de recuperação | texto da chave (única exibição) | `vault.recovery.key-text` |
| Chave de recuperação | checkbox "guardei" | `vault.recovery.confirm-checkbox` |
| Chave de recuperação | botão continuar | `vault.recovery.submit-button` |
| Chave de recuperação | mensagem de erro | `vault.recovery.error-message` |
| Desbloqueio senha | campo senha | `unlock.password.password-input` |
| Desbloqueio senha | mostrar/ocultar senha | `unlock.password.reveal-toggle` |
| Desbloqueio senha | botão desbloquear | `unlock.password.submit-button` |
| Desbloqueio senha | mensagem de erro (senha incorreta) | `unlock.password.error-message` |
| Desbloqueio senha | contagem regressiva de bloqueio (H1.2) | `unlock.password.lockout-message` |
| Desbloqueio senha | link "esqueci a senha" | `unlock.password.forgot-link` |
| Entrar com chave de recuperação | campo da chave | `unlock.recovery.key-input` |
| Entrar com chave de recuperação | campo nova senha mestra | `unlock.recovery.password-input.new` |
| Entrar com chave de recuperação | campo confirmar nova senha | `unlock.recovery.password-input.confirm` |
| Entrar com chave de recuperação | mostrar/ocultar as duas senhas | `unlock.recovery.reveal-toggle` |
| Entrar com chave de recuperação | mensagem de erro | `unlock.recovery.error-message` |
| Entrar com chave de recuperação | botão continuar | `unlock.recovery.submit-button` |
| Entrar com chave de recuperação | link voltar pro desbloqueio normal | `unlock.recovery.cancel-link` |
| Desbloqueio biometria (H3.5, só aparece após 1º desbloqueio por senha na execução) | botão usar biometria | `unlock.biometric.trigger-button` |
| Cofre desbloqueado (lista de credenciais, H3.1) | botão trancar | `vault.unlocked.lock-button` |
| Cofre desbloqueado (lista de credenciais, H3.1) | botão exportar cofre | `vault.unlocked.export-button` |
| Cofre desbloqueado (lista de credenciais, H3.1) | botão backup rápido (some se desbloqueado por biometria, H3.5) | `vault.unlocked.quick-backup-button` |
| Cofre desbloqueado (lista de credenciais, H3.1) | resultado do backup rápido | `vault.unlocked.quick-backup-message` |
| Cofre desbloqueado (lista de credenciais, H3.1) | botão importar/restaurar (some se desbloqueado por biometria, H3.5) | `vault.unlocked.import-button` |
| Cofre desbloqueado (lista de credenciais) | link abrir Configurações (H3.5) | `settings.main.open-link` |
| Configurações | toggle de biometria | `settings.main.biometric-toggle` |
| Configurações | senha mestra pra confirmar ativação | `settings.main.biometric-password-input` |
| Configurações | mostrar/ocultar essa senha | `settings.main.reveal-toggle` |
| Configurações | mensagem de erro (senha errada ao ativar) | `settings.main.error-message` |
| Configurações | confirmar ativação | `settings.main.biometric-confirm-button` |
| Configurações | cancelar ativação em andamento | `settings.main.cancel-ativacao-link` |
| Configurações | voltar pro cofre | `settings.main.back-link` |
| Lista de credenciais | container da lista (`FlatList`) | `creds.list` |
| Lista de credenciais | botão novo | `creds.list.add-button` |
| Lista de credenciais | um item (toque abre para editar) | `creds.list.item` (+ `accessibilityLabel` com o título) |
| Lista de credenciais | excluir um item (abre `common.confirm-dialog`) | `creds.list.delete-button` |
| Lista de credenciais | aviso de senha repetida, um bloco por grupo — nunca mostra a senha (H4.3) | `creds.list.reuse-warning` |
| Lista de credenciais | campo de busca — título/usuário/URL (H4.4) | `creds.list.search-field` |
| Lista de credenciais | filtro de categoria — chips horizontais, categorias calculadas das próprias credenciais, sem lib de picker (H4.4) | `creds.list.category-filter` |
| Formulário credencial (criar e editar são a mesma tela) | campo título | `creds.form.title-input` |
| Formulário credencial | campo usuário | `creds.form.username-input` |
| Formulário credencial | campo senha | `creds.form.password-input` |
| Formulário credencial | mostrar/ocultar senha | `creds.form.reveal-toggle` |
| Formulário credencial | campo URL (opcional) | `creds.form.url-input` |
| Formulário credencial | campo categoria (opcional) | `creds.form.category-input` |
| Formulário credencial | campo notas (opcional) | `creds.form.notes-input` |
| Formulário credencial | mensagem de erro (campo obrigatório vazio, limite de tamanho) | `creds.form.error-message` |
| Formulário credencial | salvar | `creds.form.submit-button` |
| Formulário credencial | cancelar/voltar | `creds.form.cancel-link` |
| Formulário credencial | abrir gerador (H4.1) | `creds.form.open-generator-button` |
| Formulário credencial | indicador de força da senha (H4.2) | `creds.form.strength-text` |
| Formulário credencial (só em modo editar) | copiar usuário | `creds.form.copy-button.username` |
| Formulário credencial (só em modo editar) | copiar senha (limpa a área de transferência em 30s) | `creds.form.copy-button.password` |
| Gerador (H4.1 — sobreposição dentro do formulário de credencial, não tela separada em `App.tsx`) | controle de tamanho (stepper +/-, não slider — sem lib de slider no projeto) | `generator.form.length-slider` |
| Gerador | toggle maiúsculas | `generator.form.uppercase-toggle` |
| Gerador | toggle minúsculas | `generator.form.lowercase-toggle` |
| Gerador | toggle números | `generator.form.digits-toggle` |
| Gerador | toggle símbolos | `generator.form.symbols-toggle` |
| Gerador | toggle excluir ambíguos (0/O, 1/l/I) | `generator.form.ambiguous-toggle` |
| Gerador | resultado | `generator.form.result-text` |
| Gerador | gerar outra (mesmas opções) | `generator.form.regenerate-button` |
| Gerador | mensagem de erro (nenhuma classe marcada) | `generator.form.error-message` |
| Gerador | usar esta senha | `generator.form.use-button` |
| Gerador | cancelar | `generator.form.cancel-link` |
| Exportar | senha de exportação | `backup.export.password-input` |
| Exportar | confirmar senha de exportação | `backup.export.password-input.confirm` |
| Exportar | mostrar/ocultar as duas senhas | `backup.export.reveal-toggle` |
| Exportar | indicador de força da senha | `backup.export.strength-text` |
| Exportar | mensagem de erro | `backup.export.error-message` |
| Exportar | mensagem de sucesso | `backup.export.success-message` |
| Exportar | botão exportar | `backup.export.submit-button` |
| Exportar | link cancelar/voltar | `backup.export.cancel-link` |
| Importar | selecionar arquivo | `backup.import.file-picker-button` |
| Importar | nome do arquivo escolhido | `backup.import.file-name-text` |
| Importar | senha do arquivo | `backup.import.password-input` |
| Importar | mostrar/ocultar a senha | `backup.import.reveal-toggle` |
| Importar | checkbox "entendo que isso substitui o cofre atual" (só no modo substituir) | `backup.import.confirm-checkbox` |
| Importar | mensagem de erro | `backup.import.error-message` |
| Importar | botão importar | `backup.import.submit-button` |
| Importar | link cancelar/voltar | `backup.import.cancel-link` |
| Criar cofre | link "importar de um backup" | `vault.create.import-link` |
| Toast genérico (hoje usado só em "Usuário copiado", sem contagem) | container | `common.toast` |
| Toast "senha copiada", com contagem regressiva até a limpeza automática (H3.2) | container | `common.toast.clipboard` |
| Diálogo de confirmação (hoje usado só na exclusão de credencial, H3.1) | confirmar | `common.confirm-dialog.confirm-button` |
| Diálogo de confirmação | cancelar | `common.confirm-dialog.cancel-button` |

> **Mudança de desenho em relação à proposta original (H3.1/H3.2, 2026-10-01):** não
> existe uma tela de "Detalhe credencial" separada — tocar num item da lista já abre o
> formulário de edição com os dados carregados (ver/editar são a mesma ação), excluir
> fica num botão dentro do próprio item da lista (`creds.list.delete-button`), e copiar
> usuário/senha (H3.2) viraram botões dentro do próprio formulário, visíveis só em modo
> editar (`creds.form.copy-button.username`/`.password`, não `creds.detail.*`). Tudo
> simplifica sem perder nenhum critério de aceite (criar, ver, editar, excluir, copiar
> com limpeza automática — todos cobertos, só que com menos telas).
>
> **Escopo descartado no H3.2 (decisão do refinamento, 2026-10-01):** marcar o conteúdo
> copiado como sensível (`ClipDescription.EXTRA_IS_SENSITIVE`, Android 13+, suprime a
> prévia do texto no toast nativo do sistema) exigiria um módulo nativo Kotlin escrito do
> zero — `expo-clipboard` não expõe essa flag. Descartado: endereça só a parte menos
> crítica do risco (um toast do próprio Android que some sozinho em segundos), não o
> controle de segurança real (a limpeza automática em 30s, essa sim implementada).

---

## 4. Regra especial: listas

**Não** use índice (`creds.list.item.0`) nem id do banco no `testID` (o id pode mudar
entre execuções e vira teste frágil).

Padrão:
- o container do item tem `testID="creds.list.item"` (igual para todos);
- a identidade vai no `accessibilityLabel` (ex.: `"Banco Inter"`);
- na automação, você localiza pelo texto visível dentro do item, ou conta itens, ou usa
  `creds.list` como escopo e filtra.

Isso espelha o que você faz no Cypress com `cy.contains('[data-cy=item]', 'Banco Inter')`
em vez de `cy.get('[data-cy=item-42]')`.

---

## 5. Regras de segurança para `testID`

- **Nunca** colocar valor de segredo num `testID` ou `accessibilityLabel` (nada de
  `creds.detail.password.S3nh@`).
- O campo de senha em repouso mostra `••••••`; o `testID` identifica o campo, não o
  conteúdo.
- `testID` fica no build de produção também (não é risco — é só um nome), mas o valor
  real do segredo nunca deve ser derivável dele.

---

## 6. Como o dev te avisa

Toda vez que um componente interativo novo for criado, o time de dev registra no PR e no
resumo da sprint: **"componente X → `testID` Y"**. Você não precisa caçar no código.

---

## 7. Checklist para o QA aprovar

- [ ] Os 7 domínios cobrem tudo que você imagina testar?
- [ ] `dominio.tela.elemento` é fácil de ler numa massa de casos no Azure Test Plans?
- [ ] A regra de listas (sem id) faz sentido para os seus cenários de regressão?
- [ ] Falta algum elemento crítico na tabela da seção 3?
