// Déclaré explicitement (Expo saurait s'en passer côté Metro) parce que
// jest-expo, lui, lit ce fichier pour transpiler les tests : sans lui, le JSX
// des tests de composants n'est pas transformé.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
