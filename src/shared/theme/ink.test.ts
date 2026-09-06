// Garde-fou contre le texte invisible.
//
// Un `<Text>` qui n'applique qu'un jeton typographique sans couleur retombe sur
// le noir de React Native — donc du noir sur un fond noir. Le bug était passé
// quatre fois, dont sur l'écran de secours et sur tous les intitulés de
// réglages, parce qu'il ne manque rien à l'œil dans le code : la ligne fautive
// ressemble en tout point à une ligne correcte.
//
// Les jetons portent désormais leur encre. Ce test empêche qu'on la retire.
import { type as typography } from './index';

describe('encre du texte', () => {
  it('chaque rôle typographique porte une couleur', () => {
    const sansEncre = Object.entries(typography)
      .filter(([, style]) => style.color === undefined)
      .map(([role]) => role);
    expect(sansEncre).toEqual([]);
  });
});
