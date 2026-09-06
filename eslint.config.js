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
    // Aucune couleur littérale dans un composant. Le thème est la seule source :
    // une valeur écrite sur place échappe à la vérification de contraste de
    // `theme/contrast.test.ts`, et c'est exactement comme ça qu'on se retrouve
    // avec un gris illisible en plein soleil.
    files: ['src/**/*.tsx'],
    ignores: ['src/features/activity/ui/Confetti.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message:
            'Pas de couleur codée en dur : ajoutez un jeton dans src/shared/theme.',
        },
      ],
    },
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
