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
| Criar cofre | mensagem de erro (senha fraca / não confere) | `vault.create.error-message` |
| Criar cofre | medidor de força *(ainda não implementado — H4.2, Sprint 4)* | `vault.create.strength-meter` |
| Criar cofre | botão criar | `vault.create.submit-button` |
| Chave de recuperação | texto da chave (única exibição) | `vault.recovery.key-text` |
| Chave de recuperação | checkbox "guardei" | `vault.recovery.confirm-checkbox` |
| Chave de recuperação | botão continuar | `vault.recovery.submit-button` |
| Desbloqueio senha | campo senha | `unlock.password.password-input` |
| Desbloqueio senha | botão desbloquear | `unlock.password.submit-button` |
| Desbloqueio senha | mensagem de erro (senha incorreta) | `unlock.password.error-message` |
| Desbloqueio senha | contagem regressiva de bloqueio (H1.2) | `unlock.password.lockout-message` |
| Desbloqueio senha | link "esqueci a senha" *(ainda não implementado — Sprint 2)* | `unlock.password.forgot-link` |
| Desbloqueio biometria | botão usar biometria | `unlock.biometric.trigger-button` |
| Cofre desbloqueado *(placeholder até o CRUD, Sprint 3)* | botão trancar | `vault.unlocked.lock-button` |
| Lista de credenciais | campo de busca | `creds.list.search-field` |
| Lista de credenciais | filtro de categoria | `creds.list.category-filter` |
| Lista de credenciais | botão novo | `creds.list.add-button` |
| Lista de credenciais | um item | `creds.list.item` (+ `accessibilityLabel` com o título) |
| Formulário credencial | campo título | `creds.form.title-input` |
| Formulário credencial | campo usuário | `creds.form.username-input` |
| Formulário credencial | campo senha | `creds.form.password-input` |
| Formulário credencial | mostrar/ocultar senha | `creds.form.reveal-toggle` |
| Formulário credencial | abrir gerador | `creds.form.open-generator-button` |
| Formulário credencial | salvar | `creds.form.submit-button` |
| Detalhe credencial | copiar senha | `creds.detail.copy-button.password` |
| Detalhe credencial | copiar usuário | `creds.detail.copy-button.username` |
| Detalhe credencial | editar | `creds.detail.edit-button` |
| Detalhe credencial | excluir | `creds.detail.delete-button` |
| Gerador | slider de tamanho | `generator.form.length-slider` |
| Gerador | toggle símbolos | `generator.form.symbols-toggle` |
| Gerador | toggle números | `generator.form.digits-toggle` |
| Gerador | resultado | `generator.form.result-text` |
| Gerador | usar esta senha | `generator.form.use-button` |
| Exportar | senha de exportação | `backup.export.password-input` |
| Exportar | botão exportar | `backup.export.submit-button` |
| Importar | selecionar arquivo | `backup.import.file-picker-button` |
| Importar | senha do arquivo | `backup.import.password-input` |
| Toast global | container | `common.toast` |
| Toast "senha copiada / será limpa" | container | `common.toast.clipboard` |
| Diálogo de confirmação | confirmar | `common.confirm-dialog.confirm-button` |
| Diálogo de confirmação | cancelar | `common.confirm-dialog.cancel-button` |

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
