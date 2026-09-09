# Appium em 10 linhas (e a diferença para Cypress e Playwright)

## As 10 linhas

1. **Appium é um servidor HTTP** que implementa o protocolo WebDriver do W3C — o mesmo
   "idioma" do Selenium, só que para apps **nativos** de celular, não só navegador.
2. O seu teste em **pytest** é um **cliente**: ele manda requisições HTTP com JSON
   ("ache o elemento X", "clique", "digite") para o Appium Server na porta 4723.
3. O Appium Server (um processo **Node.js** rodando no seu Windows) recebe esse comando
   genérico e escolhe um **driver** conforme a plataforma.
4. Para Android, o driver é o **UiAutomator2**, que empacota o framework de automação de
   testes do próprio Google.
5. Ao iniciar a sessão, o Appium usa o **adb** para instalar no emulador dois APKs
   auxiliares: um *servidor de automação* e um *stub*, que ficam **rodando dentro do
   emulador**.
6. O comando "clique no botão" então viaja: pytest → HTTP → Appium Server → adb → servidor
   UiAutomator2 **dentro do emulador** → APIs de acessibilidade do Android → o seu app.
7. O app é tratado como **caixa-preta**: o Appium enxerga a árvore de elementos que o
   Android expõe (via acessibilidade), com `resource-id` (o seu `testID`), texto,
   `content-desc`, classe — e é só isso que ele tem para localizar as coisas.
8. A resposta faz o caminho de volta pela mesma cadeia, e o `assert` do pytest roda no
   Windows com o resultado.
9. Tudo é **fora do processo do app** e passa por várias pontes (HTTP, adb, IPC no
   Android) — por isso Appium é mais **lento e mais sujeito a flakiness** que testes de
   navegador, e por isso `testID` estável importa tanto.
10. Vantagem em troca: você testa o **app real no sistema operacional real**, incluindo
    biometria, clipboard, app switcher, permissões — coisas que um teste dentro do
    navegador não alcança.

---

## Desenho do caminho

```
   [pytest no Windows]
          │  HTTP + JSON (protocolo WebDriver W3C)  :4723
          ▼
   [Appium Server  (Node.js, Windows)]
          │  carrega o driver uiautomator2
          │  fala com o emulador via adb
          ▼
   [adb]  ──────────────────────────────►  emulador Android
                                             │
                                    [servidor UiAutomator2 .apk]  (roda DENTRO do emulador)
                                             │  APIs de acessibilidade do Android
                                             ▼
                                        [ app SafeVault ]
```

---

## Comparando com o que você já usa

| | **Cypress** | **Playwright** | **Appium** |
|---|---|---|---|
| Onde o teste roda | **dentro do navegador**, no mesmo processo/loop de eventos da página | processo Node separado, dirige o navegador por um canal de controle (CDP/BiDi) | processo Python separado, fala HTTP com um servidor que dirige o SO do celular |
| O que ele controla | uma aba de navegador | navegadores (Chromium, Firefox, WebKit) | apps nativos + o Android/iOS em volta |
| Acesso ao "interior" do alvo | total: enxerga o DOM, faz stub de `fetch`/rede, mexe no relógio, no `localStorage` | bom: DOM completo, intercepta rede, mas fora do processo | **nenhum**: caixa-preta, só a árvore de acessibilidade; sem stub de rede da app |
| Espera automática | sim (retry nas asserções) | sim (auto-waiting nos locators) | parcial — mais `wait` explícito; o app não avisa quando "terminou" |
| Seletor típico | `[data-cy=submit]` | `getByTestId('submit')` | `accessibility id` = o `resById`/`testID` (`AppiumBy.ACCESSIBILITY_ID`) |
| Velocidade / estabilidade | rápido, estável | rápido, estável | mais lento, mais flaky (várias pontes + emulador) |
| Infraestrutura | só o navegador | baixa os navegadores sozinho | precisa de SDK Android, emulador, adb, servidor Appium, driver |
| Mobile | só web mobile (viewport) | só web mobile (emulação de device) | **apps nativos de verdade** |

**Resumo mental:** Cypress mora *dentro* da página. Playwright fica *do lado de fora* do
navegador, mas ainda é só navegador. Appium fica do lado de fora do **app inteiro**,
dirigindo o **celular** — mais poder, mais peças móveis, mais cuidado com espera e
seletor.

O que **transfere** direto do seu conhecimento: a ideia de cliente/servidor (você já viu
no Selenium/REST Assured), seletores estáveis via atributo dedicado (`data-cy` →
`testID`), Page Objects, e a disciplina de asserção explícita do pytest/JUnit
(`assert`, sem `assertEquals`).
