// Config "flat" do ESLint 9 — substitui o antigo .eslintrc. É um array: cada item é
// um bloco de regras que se aplica aos arquivos que ele casar (via `files`), na ordem
// em que aparece. Equivalente, em espírito, ao que o .eslintrc fazia com "extends" +
// "overrides", só que explícito em vez de mágico.
const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  // Regras JS básicas recomendadas pelo próprio ESLint.
  js.configs.recommended,

  // Arquivos de configuração na raiz (este arquivo, babel.config.js) e os
  // Config Plugins do Expo (plugins/**) rodam em Node durante o `expo
  // prebuild`, não no celular — precisam de `require`/`module`/`__dirname`
  // como globais conhecidas, senão o ESLint acusa "'require' is not defined".
  {
    files: ['*.config.js', '.prettierrc.js', 'plugins/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Regras de TypeScript, só para arquivos .ts/.tsx — que é onde o código do
  // app de fato mora.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        // Variável injetada pelo Metro (bundler do React Native) em runtime;
        // não existe em nenhuma lib de tipos, por isso precisa ser listada
        // manualmente como global conhecida.
        __DEV__: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
  },

  // Arquivos de teste (Jest) rodam em Node, com globais próprias (`describe`,
  // `it`, `expect`) injetadas pelo test runner — não existem em tempo de build
  // normal, por isso o ESLint não as conhece sem esta declaração.
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },

  // Regra de segurança do projeto (H1.4): Math.random é proibido no código do
  // app porque não é um gerador de números aleatórios seguro — nonce, salt, chave
  // e senha gerada nunca podem depender dele. Escopo é só `src/` de propósito
  // (decisão do refinamento, 2026-09-24): código de teste não protege dado real,
  // então ali Math.random é só estilo, não risco de segurança.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Proibido no código do app (H1.4): use src/crypto/csprng.ts, que usa o gerador aleatório seguro do sistema.',
        },
      ],
    },
  },

  // Desliga regras de estilo que conflitam com o Prettier — deixa o Prettier
  // cuidar de formatação, o ESLint cuida só de qualidade/correção.
  prettier,

  {
    ignores: ['node_modules/**', 'android/**', 'ios/**', '.expo/**', 'dist/**'],
  },
];
