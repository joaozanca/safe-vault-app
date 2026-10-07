# Guia passo a passo — escrevendo testes mobile com Appium

Para quem já automatizou web (Cypress/Playwright) e está começando no mobile. Siga na
ordem: as partes 1 e 2 você faz uma vez para entender; da parte 4 em diante são
exercícios, do mais guiado ao mais livre.

---

## Parte 0 — O que muda em relação ao Cypress

No Cypress o teste roda **dentro** do navegador. No mobile existe um intermediário:

```
 seu teste (pytest)  ──HTTP──▶  servidor Appium  ──▶  driver UiAutomator2  ──▶  app no emulador
```

- O **servidor Appium** precisa estar rodando antes dos testes (num terminal só pra ele).
- Cada teste abre uma **sessão**: o Appium instala/abre o app e devolve um `driver`,
  que é o seu `cy` — tudo passa por ele.
- O app é **nativo**, não HTML: não existe `data-testid` no DOM. O `testID` do React
  Native vira o atributo `resource-id` do elemento Android. A função `por_test_id()`
  em `pages/base_page.py` já resolve isso para você.

| Você conhece | Aqui é |
|---|---|
| `cy.get('[data-testid=x]')` | `self.elemento("x")` (dentro de um Page Object) |
| `.click()` / `.type()` | `self.tocar("x")` / `self.digitar("x", texto)` |
| `should('have.text', ...)` | `assert pagina.mensagem_erro() == "..."` (no teste) |
| `beforeEach` | fixtures do `conftest.py` (`driver`, `cofre_aberto`...) |
| `npx cypress open` | janela do emulador + Appium Inspector (parte 2) |
| Mochawesome | Allure |

---

## Parte 1 — Preparar o ambiente (toda vez que for trabalhar)

Abra **3 terminais** no VS Code (PowerShell).

**Terminal 1 — emulador.** Se não estiver aberto:

```powershell
emulator -avd Pixel_10a
```

Espere a tela inicial do Android aparecer. Confira com `adb devices` (tem que listar
`emulator-5554   device`).

**Terminal 2 — servidor Appium** (deixe rodando, não feche):

```powershell
appium --use-plugins=inspector --allow-cors
```

Quando aparecer `Appium REST http interface listener started`, está pronto.

**Terminal 3 — onde você roda os testes:**

```powershell
cd e2e
$env:SAFEVAULT_APK = "..\android\app\build\outputs\apk\release\app-release.apk"
.venv\Scripts\python -m pytest -v
```

Os 3 testes de exemplo devem passar. Se passaram, o ambiente está pronto.

> **"Não foi possível carregar o módulo '.venv'"?** O terminal não está dentro de
> `e2e` (todo terminal novo abre na raiz do projeto). Confira o prompt — tem que
> terminar em `\e2e>` — e rode o `cd e2e`. Em terminal novo, defina de novo o
> `$env:SAFEVAULT_APK`: variável de ambiente vale só no terminal onde foi criada.

> **APK desatualizado?** Se alguém mudou o código do app (pasta `src/`), gere o APK
> de novo antes: `cd android; .\gradlew assembleRelease -PreactNativeArchitectures=x86_64`
> (uns 5 minutos). Teste rodando contra APK velho testa o app velho.

---

## Parte 2 — Vendo os testes visualmente

### 2.1 Assistindo na janela do emulador

Deixe a janela do emulador visível ao lado do VS Code e rode **um** teste só:

```powershell
.venv\Scripts\python -m pytest -v -k persiste
```

(`-k` filtra pelo nome do teste — igual ao `.only`, mas pela linha de comando.)

Você vai ver o app ser apagado, o cofre ser criado, a credencial digitada, o cofre
trancar e abrir de novo — tudo sozinho. É rápido; rode mais de uma vez prestando
atenção em cada etapa e compare com o código em `tests/test_credenciais.py`.

> Na tela do emulador você **vê** o app normalmente. O bloqueio de captura (FLAG_SECURE)
> só impede *capturas* (screenshot, gravação), não a exibição.

### 2.2 Appium Inspector — o "DevTools" do mobile

É aqui que você descobre os `testID`s e a estrutura de cada tela, como o seletor do
Cypress.

1. Abra o app no emulador e navegue até a tela que quer inspecionar (ex.: lista de
   credenciais).
2. No navegador, abra **http://localhost:4723/inspector**
3. Em *Remote Host* deixe `127.0.0.1`, *Remote Port* `4723`, *Remote Path* `/`.
4. Em *JSON Representation* das capabilities, cole:

   ```json
   {
     "platformName": "Android",
     "appium:automationName": "UiAutomator2",
     "appium:appPackage": "com.joaozanca.safevault",
     "appium:appActivity": ".MainActivity",
     "appium:noReset": true
   }
   ```

   ⚠️ **`noReset: true` é obrigatório aqui.** Sem ele o Appium apaga os dados do app
   ao conectar — e lá se vai o cofre que você estava inspecionando.

5. Clique em **Start Session**.

O que você vai ver:

- **Painel do meio (árvore de elementos):** a "DOM" da tela. Clique num elemento e,
  à direita, aparecem os atributos. O que importa: **`resource-id`** (é o `testID`) e
  **`content-desc`** (é o `accessibilityLabel`).
- **Painel da esquerda (screenshot):** vai aparecer **vazio** (só a cor de fundo). Não é defeito: é o
  FLAG_SECURE do app (H3.4) bloqueando a captura, como manda o requisito. Use a árvore
  + a janela do emulador lado a lado.
- **Atualizar a árvore:** na barra de ícones do topo (centro da tela), o ícone de
  **duas setas em círculo**, logo à direita do globo. Depois de mudar de tela no
  emulador, clique nele para a árvore refletir a tela nova.
- **Testar um localizador:** na mesma barra, a **lupa** (à direita do atualizar).
  Na janela que abre, escolha a estratégia **UIAutomator** (em versões antigas do
  Inspector ela aparece como `-android uiautomator`) e cole, por ex.
  `new UiSelector().resourceId("creds.list.add-button")`. Se achar 1 elemento,
  o localizador está certo — é o mesmo que o `por_test_id()` faz no código.
- Não confunda com a caixa **Search Source** dentro do painel *App Source*: ela só
  procura texto na árvore (tipo Ctrl+F), não testa localizador. Mas é útil: digite
  `submit` e ela destaca o botão.

Lembre de **encerrar a sessão** no Inspector (botão de sair) antes de rodar a suíte —
duas sessões disputando o mesmo emulador dá erro.

Referência rápida de todos os `testID`s do app:
[docs/sprint-0/padrao-testid.md](../docs/sprint-0/padrao-testid.md).

### 2.3 Relatório do Allure

Depois de rodar os testes:

```powershell
allure serve allure-results
```

Abre o relatório no navegador. Onde olhar:

- **Overview:** total de passou/falhou.
- **Suites** (menu à esquerda) → clique num teste → aparece cada **passo** que ele
  executou ("Digitar em creds.form.title-input", "Tocar em ..."). O texto digitado
  **não** aparece, de propósito — senhas passam por ali.
- **Behaviors:** os testes agrupados por funcionalidade/história (vem do
  `@allure.feature` e `@allure.story` em cada teste).
- Num teste que **falhou**, há o anexo `tela-no-momento-da-falha`: o XML da tela
  (mesma árvore do Inspector) na hora do erro.

> O relatório mostra só a **última** execução: o `pytest.ini` usa `--clean-alluredir`,
> que apaga os resultados anteriores antes de cada rodada. Consequência prática: se
> você rodar só um teste (`-k ...`), o relatório terá só aquele teste. Para ver a
> suíte inteira no relatório, rode a suíte inteira.

---

## Parte 3 — Lendo um teste que já existe

Abra `tests/test_cofre.py`, função `test_desbloqueio_com_senha_errada_mantem_cofre_trancado`:

```python
def test_desbloqueio_com_senha_errada_mantem_cofre_trancado(driver, cofre_aberto, senha_mestra):
```

Os **parâmetros** são fixtures. O pytest vê os nomes e entrega pronto:
- `driver` → sessão Appium com o app limpo;
- `cofre_aberto` → já criou o cofre pela tela e devolveu a página da lista;
- `senha_mestra` → a senha (gerada com Faker) que a fixture usou.

Você não chama nada disso — só pede pelo nome. É o equivalente a ter um `beforeEach`
diferente por teste, escolhido à la carte.

O corpo segue **Arrange → Act → Assert**, com comentário marcando cada parte. Os
Page Objects (`DesbloqueioPage`, `ListaCredenciaisPage`) só **fazem** coisas e
**leem** coisas; quem decide se está certo é o `assert` no teste.

---

## Parte 4 — Exercício 1 (totalmente guiado): senhas diferentes ao criar o cofre

**Cenário:** ao criar o cofre com confirmação diferente da senha, o app mostra
`As senhas digitadas não são iguais.` e continua na tela de criação.

**Passo 1 — o Page Object já tem o que precisa?** Abra `pages/criar_cofre_page.py`.
O método `criar(senha, confirmacao)` aceita uma confirmação diferente, e
`mensagem_erro()` lê o erro. Então **não precisa mexer** no Page Object.

**Passo 2 — escrever o teste.** No fim de `tests/test_cofre.py`, adicione:

```python
@allure.feature("Cofre")
@allure.story("H1.1 — criar cofre")
def test_criar_cofre_com_confirmacao_diferente_mostra_erro(driver, senha_mestra):
    # Arrange
    criar_cofre = CriarCofrePage(driver)

    # Act — a confirmação difere da senha só no último caractere: é o erro de
    # digitação real que a tela existe para pegar.
    criar_cofre.criar(senha_mestra, confirmacao=senha_mestra + "x")

    # Assert — mensagem exata E continua na mesma tela (o cofre não foi criado).
    assert criar_cofre.mensagem_erro() == "As senhas digitadas não são iguais."
    assert criar_cofre.esta_aberta(), "com senhas diferentes o app não pode sair da criação"
```

Repare: este teste **não** usa `cofre_aberto` — o cenário acontece antes de existir
cofre, então só precisa de `driver` (app limpo) e `senha_mestra`.

**Passo 3 — rodar só ele, olhando o emulador:**

```powershell
.venv\Scripts\python -m pytest -v -k confirmacao_diferente
```

> **Apareceu `0 selected` / `deselected` e nada rodou?** O pytest não achou nenhum
> teste com esse nome. Quase sempre é o arquivo **não salvo** (aba com ● no VS Code →
> Ctrl+S) ou o código colado no arquivo errado. Não é falha do teste: é o pytest
> dizendo que não tinha o que executar (por isso sai com código 5).

**Passo 4 — prova negativa (não pule!).** Troque a mensagem esperada por uma errada
(ex.: `"As senhas NÃO são iguais."`), rode de novo e confirme que **falha** com uma
mensagem clara mostrando o texto real vs. o esperado. Depois desfaça. Um teste que
nunca viu falhar pode estar passando por engano (ex.: assert que nunca é executado).

**Passo 5 — commit:**

```powershell
git add e2e/tests/test_cofre.py
git commit -m "test(e2e): valida erro ao criar cofre com confirmacao diferente"
```

---

## Parte 5 — Exercícios com cada vez menos ajuda

Faça um por vez: escreva → rode → prova negativa → commit. Se travar, me chame com o
erro que apareceu.

### Exercício 2 — senha mestra fraca (só dicas)

**Cenário:** senha sem número (ex.: só letras, 12 caracteres) é recusada.

- Mesmo Page Object do exercício 1, nenhuma mudança nele.
- A mensagem começa com `Senha mestra inválida:` e lista os problemas. Para senha sem
  número, ela contém `precisa ter ao menos 1 número`.
- Pense: vale comparar a mensagem inteira (`==`) ou checar que contém o trecho
  (`in`)? A mensagem inteira depende de *todos* os problemas da senha — se você gerar
  a senha com Faker, o texto final pode variar. Escolha e justifique num comentário.
- Bônus: use `@pytest.mark.parametrize` para testar 3 senhas inválidas (sem número,
  sem maiúscula, curta demais) num teste só — é o "data-driven" do pytest.

### Exercício 3 — excluir credencial (precisa criar Page Object)

**Cenário:** com uma credencial cadastrada, excluir e confirmar → a lista fica vazia.

O que você vai precisar construir:

1. **Um jeito de cadastrar a credencial antes** — já existe nos passos do teste de
   `test_credenciais.py`. Se for repetir isso em vários testes, considere criar uma
   fixture `credencial_cadastrada` no `conftest.py` (que usa `cofre_aberto`).
2. **Tocar no "Excluir" da credencial certa.** Cada linha tem um botão com
   `testID="creds.list.delete-button"` — mas todas as linhas têm o mesmo testID!
   Para pegar o da linha certa, use o `accessibilityLabel`, que é
   `Excluir <título>`. No Appium isso é o localizador **accessibility id**:

   ```python
   from appium.webdriver.common.appiumby import AppiumBy
   self.driver.find_element(AppiumBy.ACCESSIBILITY_ID, f"Excluir {titulo}").click()
   ```

   Crie um método `excluir(titulo)` em `ListaCredenciaisPage`.
3. **O diálogo de confirmação** é um componente comum, com
   `common.confirm-dialog.confirm-button` e `common.confirm-dialog.cancel-button`.
   Crie `pages/dialogo_confirmacao_page.py` com `confirmar()` e `cancelar()`.
4. Use o Inspector (parte 2.2) para ver o diálogo aberto e conferir os testIDs.

Bônus: o caminho **cancelar** — tocar em Excluir, cancelar → a credencial continua lá.

### Exercício 4 — editar credencial

**Cenário:** abrir uma credencial, trocar o título, salvar → a lista mostra o título
novo e não mostra mais o antigo.

- Para abrir a credencial, toque na linha dela. O item tem `accessibilityLabel` igual
  ao título → `AppiumBy.ACCESSIBILITY_ID` com o título. Crie `abrir(titulo)` na lista.
- O formulário é o mesmo da criação (`FormularioCredencialPage`).
- Detalhe do Appium: `send_keys` no Android **substitui** o texto do campo (não soma
  ao que já estava), então não precisa limpar antes.
- Assert pensado: compare a lista inteira (`== [novo_titulo]`), igual ao exemplo — isso
  pega tanto "não editou" quanto "duplicou em vez de editar".

### Exercício 5 — busca

**Cenário:** com 2 credenciais, buscar por parte do título de uma → só ela aparece.

- Campo: `creds.list.search-field`. Crie `buscar(termo)` na lista.
- Você vai cadastrar 2 credenciais — boa hora de ter a fixture/método reutilizável do
  exercício 3 aceitando uma lista.
- Pense nos casos: busca por **usuário** também funciona? Busca sem resultado mostra o
  quê? Cada um é um teste separado e pequeno.

### Exercício 6 — gerador de senha (desafio, sem dicas de código)

Botão `creds.form.open-generator-button` no formulário abre o gerador (testIDs
`generator.form.*` no [padrão de testID](../docs/sprint-0/padrao-testid.md)).
Ideias de cenário, escolha 2:

- Senha gerada tem o tamanho padrão (16).
- Desligando maiúsculas, a senha gerada não tem nenhuma letra maiúscula.
- Desligando **todas** as classes, aparece mensagem de erro em vez de senha.
- "Usar" preenche o campo senha do formulário (como validar sem ler a senha num
  campo mascarado? Investigue o botão "Mostrar senha" com o Inspector).

---

## Parte 6 — Quando um teste falha

Na ordem:

1. **Leia a mensagem do pytest até o fim.** `AssertionError: assert 'X' == 'Y'` é
   diferença de valor; `TimeoutException` é "não achei o elemento a tempo".
2. **TimeoutException:** o testID está certo? Confira no Inspector, na tela onde o
   teste estava. O teste estava na tela que você *acha* que estava? Veja o anexo
   `tela-no-momento-da-falha` no Allure.
3. **O toque não fez nada:** o teclado pode estar cobrindo o botão (o `digitar` já
   fecha o teclado, mas se você usar o `driver` direto, não).
4. **Nunca resolva com `time.sleep()`** — mesma regra do `cy.wait(5000)`. Se precisa
   esperar algo, espere *a condição*: `self.elemento(...)` já espera até o elemento
   existir; `esta_visivel(..., timeout=...)` espera e devolve True/False.
5. Rode **só aquele teste** (`-k nome`) olhando o emulador para ver onde o fluxo desviou.

---

## Parte 7 — Checklist antes de cada commit

- [ ] Rodei o teste novo sozinho e ele passa.
- [ ] Fiz a prova negativa (vi falhar com o assert alterado e desfiz).
- [ ] Rodei a suíte inteira (`pytest -v`) — o teste novo não quebrou os outros.
- [ ] Asserções no teste, nenhuma no Page Object.
- [ ] Nenhum `sleep`, nenhum dado fixo que deveria ser gerado.
- [ ] Nome do teste diz o comportamento (`test_<acao>_<resultado_esperado>`).
- [ ] Um commit por cenário: `test(e2e): <o que valida>`.
