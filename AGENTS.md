# Allure

Application iOS de plans d'entraînement de course à pied. Expo SDK 57 /
React Native 0.86, TypeScript strict, **100 % locale** — aucun serveur, aucun
compte, aucune donnée qui sort de l'appareil.

## Avant d'écrire du code

Expo a beaucoup changé. Les API du SDK 57 sont documentées ici et ce sont
celles-là qui font foi : <https://docs.expo.dev/versions/v57.0.0/>.
En particulier `expo-audio` (et non `expo-av`) et la nouvelle API classe de
`expo-file-system` (`new File(Paths.cache, …)`).

## Organisation

Découpage par couches, du plus générique au plus spécifique. Une couche
n'importe jamais une couche plus spécifique qu'elle.

| Dossier | Contenu |
| --- | --- |
| `src/shared` | Thème, bibliothèque de composants, utilitaires purs (`format`, `geo`, `date`), accès SQLite |
| `src/entities` | Modèles métier et persistance : `pace`, `workout`, `activity`, `plan`, `settings`, `backup` |
| `src/features` | Logique applicative : `plan` (magasin, calendrier), `run` (moteur, GPS, sons), `activity` (rapport, récompenses, GPX), `stats` (calculs), `backup` |
| `src/screens` | Un fichier par écran, assemblage uniquement |
| `src/app` | Amorçage, navigation, garde-fou d'erreur |

## Règles du projet

- **Le moteur de séance reste pur.** `src/features/run/engine.ts` ne touche ni
  au GPS, ni au son, ni à l'horloge : il reçoit des incréments et rend des
  évènements. C'est ce qui le rend testable au sol — un bug qui ne se
  reproduit qu'en courant coûte une séance à chaque essai.
- **La chaîne GPS reste pure elle aussi.** `src/features/run/gps-filter.ts`
  (rejet, préchauffage, Kalman, distance) ne touche à aucun module natif : il
  reçoit des relevés et rend des points corrigés. C'est ce qui permet de
  mesurer l'erreur de distance sur trajectoire de référence plutôt que de la
  deviner en courant. Toute modification des constantes du filtre doit être
  justifiée par un chiffre de `gps-filter.test.ts`.
- **Toutes les grandeurs sont en unités SI** dans le code : mètres et secondes.
  La conversion en texte n'a lieu que dans `shared/lib/format`.
- **Une date de séance est une chaîne `YYYY-MM-DD`**, jamais un timestamp : un
  plan est un calendrier, et une clé de jour ne doit pas glisser avec le fuseau.
- **Dupliquer, c'est régénérer les identifiants** (`cloneBlocks`). Sans cela,
  deux séances partagent leurs étapes et s'éditent ensemble.
- **La sauvegarde ne se dégrade jamais silencieusement.** Un format de
  sauvegarde ne se modifie qu'en incrémentant `BACKUP_VERSION`, et
  `readBackup` doit continuer à lire les versions antérieures : un fichier
  exporté aujourd'hui doit se restaurer dans deux ans. Toute restauration
  passe par une transaction et par un instantané préalable.
- **Une migration ne se modifie pas après coup.** On en ajoute une nouvelle à la
  fin de `src/shared/db/migrations.ts`.
- Les commentaires expliquent **pourquoi**, pas quoi. En français.

## Commandes

```bash
npm run typecheck     # tsc --noEmit
npm run lint
npm test
npm run prebuild      # régénère ios/ depuis app.config.ts
npm run ios           # build + lancement sur simulateur (Metro inclus)
npm run cues          # régénère les bips de assets/audio
```

Les modules natifs utilisés (GPS en arrière-plan, carte, synthèse vocale) ne
fonctionnent pas dans Expo Go : il faut un build de développement.
