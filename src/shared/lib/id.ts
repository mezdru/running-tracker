// Identifiants locaux. L'app n'a pas de serveur : un identifiant n'a besoin
// d'être unique que sur cet appareil, sur toute sa durée de vie. Un préfixe
// temporel garantit l'ordre de création, le suffixe aléatoire évite la
// collision entre deux créations dans la même milliseconde (duplication d'une
// semaine entière, par exemple).
export function newId(prefix = 'id'): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${rand}`;
}
