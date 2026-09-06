// ESLint « flat config » (format par défaut depuis Expo SDK 53), étend
// eslint-config-expo : globals React Native / Hermes / Node, règles react-hooks.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['dist/*', 'node_modules/*', '.expo/*', 'ios/*', 'android/*', '.claude/**']),
  expoConfig,
  {
    rules: {
      // React Native ne rend pas d'entités HTML : une apostrophe dans <Text>
      // est valide telle quelle.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Outillage exécuté par Node, jamais embarqué dans l'app : la config Expo
    // ne déclare pas les globals Node pour les modules ES.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { Buffer: 'readonly' } },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
]);
