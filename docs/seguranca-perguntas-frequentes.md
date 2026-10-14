# Segurança do SafeVault — perguntas frequentes

Para quem vai **usar** o app e quer entender, sem termos técnicos, como as senhas ficam
protegidas — e o que depende de você.

## Em uma frase

O SafeVault guarda suas senhas **só no seu celular**, embaralhadas com criptografia que
só a **sua senha mestra** desfaz. Não existe conta, servidor nem nuvem.

---

## Perguntas

### Se roubarem meu celular, pegam minhas senhas?

Não sem a sua senha mestra. Funciona como um cofre de verdade: levar o cofre embora não
o abre. Além disso:

- o app **tranca sozinho** depois de 3 minutos sem uso;
- depois de 5 senhas erradas, ele **bloqueia** por um tempo que vai aumentando — não dá
  para ficar chutando senhas;
- quando você volta a entrar, ele **avisa** quantas tentativas erradas houve.

### E se ligarem meu celular num computador com um cabo?

O computador só enxerga os arquivos comuns (fotos, downloads, músicas). A pasta do
SafeVault fica **escondida pelo próprio Android**, que não deixa um aplicativo — nem um
computador — ver os dados de outro. A versão do app que vai para o usuário também foi
conferida para não permitir que as ferramentas de programador do Android abram essa
pasta, nem que o cofre seja copiado num backup do sistema.

### E se alguém muito técnico conseguir copiar os arquivos do app?

Eles não servem para nada sem a sua senha mestra: o cofre é guardado **embaralhado**. Nos
testes, o arquivo do cofre se mostrou impossível de diferenciar de dados aleatórios — sem
nenhum nome, usuário ou senha legível. Para tentar abrir, a pessoa teria que adivinhar a
sua senha mestra, e o app foi feito para que **cada tentativa seja lenta e cara**.

### Quem fez o app consegue ver minhas senhas?

Não. Nada sai do seu celular — não há para onde enviar. É justamente por isso que, se
você esquecer a senha mestra **e** perder a chave de recuperação, **ninguém** consegue
recuperar o cofre.

### E se alguém tirar print da tela?

O app **bloqueia** prints e gravação de tela, e esconde o conteúdo na tela de "apps
recentes".

### Copiei uma senha. Ela fica guardada no celular?

Ela é **apagada da área de transferência sozinha** depois de 30 segundos — e, se você
copiar outra coisa nesse meio-tempo, o app não apaga o que é seu.

### Posso usar a digital ou o rosto?

Pode, se ativar nas configurações do app. A digital é uma comodidade **a mais**: ao abrir
o app de novo depois de fechá-lo, ele pede a senha mestra — uma camada extra de proteção.

### O teclado do celular "aprende" as senhas que eu digito?

Os campos de senha do SafeVault avisam o teclado para **não sugerir nem aprender** o que
é digitado — inclusive a chave de recuperação.

---

## O que depende de você

| Cuidado | Por quê |
|---|---|
| **Senha mestra forte** (12 caracteres ou mais, misturando letras maiúsculas, minúsculas e números) e que você não usa em nenhum outro lugar | é a única coisa entre um ladrão e o seu cofre |
| **Chave de recuperação anotada** em papel e guardada em lugar seguro | é a única saída se você esquecer a senha mestra — sem ela, o cofre se perde |
| **Bloqueio de tela do celular** ligado | é a primeira barreira; o auto-lock do app é a segunda |
| **Backups exportados guardados com cuidado**, com uma senha de exportação forte | o arquivo de backup fica fora da área protegida do app (é seu, para guardar onde quiser) — ele está cifrado, mas a força dele é a da senha que você escolher |
| **Só dar permissão de "acessibilidade" a apps de confiança** | apps com essa permissão conseguem ler o que aparece na tela enquanto o cofre está aberto |

## Ao trocar de celular ou desinstalar

Desinstalar o app **apaga o cofre** — de propósito, o SafeVault não deixa o Android
copiar o cofre para a nuvem sem a sua proteção. Antes de trocar de celular ou
desinstalar, use **Exportar** (ou **Backup rápido**) e depois **Importar** no aparelho
novo.

---

Detalhes técnicos de cada proteção e como foram testadas:
[análise de risco](sprint-0/analise-de-risco.md) e
[critérios de saída da v1](sprint-5/criterios-de-saida.md).
