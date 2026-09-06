// Étend le préréglage jest-expo au lieu de le remplacer : `setupFiles` y porte
// les mocks React Native dont dépendent tous les tests de composants, les
// écraser reviendrait à casser l'environnement entier.
const preset = require('jest-expo/jest-preset');

// lucide-react-native est publié en ESM seul (.mjs) et arriverait tel quel dans
// un environnement CommonJS. On réutilise le transformateur du préréglage.
const JS_TRANSFORM = '\\.[jt]sx?$';
const babelTransform = preset.transform?.[JS_TRANSFORM];
if (!babelTransform) {
  throw new Error(
    `jest-expo : transformateur introuvable pour ${JS_TRANSFORM} (le préréglage a changé de forme).`,
  );
}

// La liste des paquets de node_modules à transpiler quand même est DÉRIVÉE de
// celle du préréglage, jamais recopiée : jest-expo l'allonge à chaque SDK et
// une copie figée perdrait ses ajouts en silence.
const [nodeModulesPattern, ...otherIgnores] = preset.transformIgnorePatterns;
const withLucide = nodeModulesPattern.replace(/\)\)$/, '|lucide-react-native))');
if (withLucide === nodeModulesPattern) {
  throw new Error(
    'jest-expo : forme inattendue de transformIgnorePatterns[0], lucide-react-native ne serait pas transpilé.',
  );
}

module.exports = {
  ...preset,
  setupFiles: [...(preset.setupFiles ?? []), '<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [withLucide, ...otherIgnores],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/ios/'],
};
