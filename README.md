# Allure

Plans d'entraînement de course à pied, sur iPhone. On construit ses séances —
échauffement, séries, récupérations, retour au calme —, on les pose sur un
calendrier, et on les exécute à l'oreille pendant qu'on court.

Application personnelle, mono-utilisateur, **entièrement locale**.

---

## Ce qu'elle fait

**Construire une séance.** Des blocs simples et des blocs répétés (« 10 ×
(400 m + 1 min) »), chacun avec sa cible — une distance ou une durée — et son
allure. La distance et la durée prévues se recalculent à chaque modification.

**Marcher quand il faut marcher.** La marche est un type d'étape à part
entière : récupération marchée entre deux répétitions, échauffement en marche,
retour au calme. Elle a sa propre allure — la seule en valeur absolue, parce
que marcher ne va pas plus vite quand on progresse en course — et l'app cesse
d'annoncer une allure au kilomètre pendant qu'on souffle. Trois modèles
l'utilisent, dont une reprise course-marche.

**Raisonner en pourcentage de VMA.** Les allures sont définies par défaut en
pourcentage de vitesse maximale aérobie (récupération 60 %, endurance
fondamentale 70 %, seuil 85 %, VMA 100 %…). Changer sa VMA dans les réglages
mettent à jour toutes les allures cibles et toutes les estimations du plan, d'un
seul geste. Une zone peut aussi porter une allure absolue, pour un objectif
chronométré qui ne doit pas suivre la forme du moment.

**Voir le plan.** Vue mensuelle avec le kilométrage de chaque jour et le total
de chaque semaine en marge ; vue hebdomadaire avec les totaux prévus, le
réalisé, et le détail jour par jour.

**Manipuler des semaines.** Copier une semaine, la coller ailleurs (en
remplacement ou en ajout), la vider, décaler tout le plan d'une semaine.
Dupliquer une séance au lendemain ou à la semaine suivante. Enregistrer une
séance comme modèle réutilisable — neuf modèles classiques sont fournis.

**Courir la séance.** Un grand cadran indique l'étape en cours, ce qu'il en
reste et l'allure visée ; l'allure réelle change de couleur selon l'écart à la
cible. Trois bips avant chaque changement d'étape, un bip au changement, et une
voix française qui annonce l'étape suivante (« Intervalle 3 sur 8, 400 mètres à
3 minutes 45 au kilomètre ») ainsi que chaque kilomètre. Tout continue écran
verrouillé, en poche.

**Enregistrer l'effort.** Trace GPS filtrée (voir plus bas), distance, temps en
mouvement, dénivelé, temps au kilomètre, et le réalisé de chaque étape confronté
à son allure cible. Le tracé s'affiche sur une carte.

**Être récompensé.** La fin de séance est un moment, pas un tableau : confettis,
médaille, chiffres qui défilent — puis les récompenses réellement méritées,
calculées contre tout l'historique. Record de distance, d'allure moyenne ou de
meilleur kilomètre ; premier 5, 10, 21,1 ou 42,2 km ; série de jours
consécutifs ; semaine la plus longue ; séance bouclée comme prévu ; tous les
intervalles tenus ; semaine complète. Rien n'est décerné deux fois, et une
séance ordinaire ne décroche rien — c'est ce qui donne du prix aux autres.

**Exporter.** Chaque sortie s'exporte en GPX depuis la feuille de partage iOS —
de quoi l'importer dans Strava dès aujourd'hui, en attendant la synchronisation
automatique.

## Ce qui reste à faire

- **Dénivelé barométrique.** Le baromètre de l'iPhone donne une altitude
  relative bien plus stable que le GPS ; c'est le gain de précision suivant.
- **Synchronisation Strava automatique.** La colonne `strava_activity_id` existe
  déjà en base et l'export GPX couvre le besoin en manuel. L'automatiser
  demandera une brique serveur pour l'échange OAuth (le secret client ne peut
  pas vivre dans l'app) — c'est le seul morceau qui ferait sortir ce projet du
  tout-local.
- Capteur cardio (Bluetooth ou Apple Watch).

---

## Architecture, et pourquoi

### Pas de base de données distante, donc pas de Terraform

Les données de l'app sont un plan d'entraînement et des traces GPS, pour une
seule personne, sur un seul téléphone. Elles vivent dans **SQLite, sur
l'appareil** (`expo-sqlite`).

C'était la contrainte forte : **on court sans réseau.** Une séance doit démarrer
en forêt ou en montagne sans couverture, et une base distante rendrait
indisponible, précisément dans ce cas, la seule chose dont l'app a besoin. Il
n'y a donc ni serveur, ni compte, ni synchronisation à réconcilier, ni coût
récurrent, ni surface d'attaque — et pas d'infrastructure à provisionner : le
dépôt ne contient pas de Terraform parce qu'il n'y a rien à déployer.

La sauvegarde est celle du téléphone : une sauvegarde iCloud restaure la base
avec le reste. Le jour où la synchronisation Strava arrive, elle demandera un
petit service d'échange OAuth — c'est à ce moment-là, et pas avant, qu'un
`infra/` aura une raison d'exister.

### Un dépôt, une pipeline

- `.github/workflows/ci.yml` — types, style, tests, santé du projet Expo, à
  chaque push et chaque PR.
- `.github/workflows/release-ios.yml` — déclenché à la main : rejoue les
  vérifications, réécrit la version marketing, lance le build EAS et enchaîne
  sur l'envoi App Store Connect.

Le numéro de build est incrémenté par EAS (`appVersionSource: remote`). La
version marketing ne bouge que si on la donne en entrée du workflow.

### La précision GPS, en quatre étages

C'est le point qui décide de tout le reste : une distance fausse rend faux le
kilométrage de la semaine, l'allure de chaque intervalle et le bilan de la
séance. Le problème est connu — un GPS de téléphone livre une position par
seconde avec une erreur de 3 à 10 m qui **change de sens à chaque relevé**.
Relier les points bruts donne un tracé en dents de scie et, surtout, une
distance systématiquement **surestimée** : les zigzags parasites s'additionnent.

Aucun réglage de seuil ne corrige cela. Il faut estimer la trajectoire réelle.
`src/features/run/gps-filter.ts` le fait en quatre étages :

1. **Rejet** des relevés inexploitables : horodatage antérieur au dernier accepté
   (fréquent au retour d'arrière-plan, où iOS livre un lot d'un coup), précision
   au-delà de 25 m, et sauts physiquement impossibles — la tolérance du saut
   s'élargit avec l'incertitude du moment, pour qu'un recalage légitime après un
   tunnel ne soit pas confondu avec une aberration.
2. **Préchauffage.** Le capteur s'allume à l'ouverture de l'écran de départ, pas
   au coup de chrono, et l'écran affiche l'état du signal. Tant qu'aucune
   position à 12 m ou mieux n'est arrivée, la trace est enregistrée mais la
   distance reste à zéro : les premières secondes d'un GPS froid sont les pires
   de toute la séance, et c'est la seule erreur qu'on ne peut plus corriger
   après coup.
3. **Filtre de Kalman** à vitesse constante, dans un plan tangent local en
   mètres (une position en degrés n'est pas isotrope : le filtre lisserait deux
   fois plus en longitude qu'en latitude). Il est alimenté par la position —
   avec une variance égale à la précision annoncée — **et par la vitesse Doppler
   du récepteur**, qui ne dérive pas de la position et est donc bien plus
   fiable. Une vitesse nulle contraint les deux axes même sans cap, ce qui tue
   la dérive à l'arrêt.
4. **Accumulation** de la distance sur la trajectoire estimée, avec un seuil de
   bruit dérivé de l'incertitude propre du filtre : quand le signal est bon on
   compte des déplacements de quelques dizaines de centimètres, quand il se
   dégrade le seuil monte tout seul.

Mesuré sur trajectoire de référence bruitée (`gps-filter.test.ts`) :

| Bruit | Distance brute | Distance filtrée | Avec Doppler |
| --- | --- | --- | --- |
| 3 m | +33 % | +2,6 % | +0,6 % |
| 5 m | +82 % | +4,5 % | +0,7 % |
| 8 m | +169 % | +3,5 % | +0,9 % |

Le tracé affiché et exporté est la trajectoire **estimée**, pas les points
bruts : il doit raconter la même chose que la distance annoncée. Il est allégé
par Douglas–Peucker, qui garde les points portant la forme du parcours — un
échantillonnage « un point sur N » redresserait les lacets.

L'altitude passe par un filtre à un état pondéré par la précision verticale, et
le dénivelé est ensuite cumulé au-delà d'un seuil, comme sur une montre.

**Ce qui n'est volontairement pas fait :** la correspondance au réseau de
chemins (*map matching*). Elle suppose un graphe routier, donc du réseau, alors
que l'app est faite pour tourner sans couverture — et elle est fausse dès qu'on
quitte les routes, ce qui arrive tout le temps en course à pied (piste, sentier,
stade, plage). Un baromètre donnerait un meilleur dénivelé que le GPS ; c'est le
prochain gain de précision identifié.

### Les récompenses sont des faits, pas des félicitations

`src/features/activity/rewards.ts` est pur et testé pour une raison précise :
une app qui félicite à chaque sortie ne récompense plus rien. Chaque badge est
donc une comparaison à l'historique complet — et les tests vérifient surtout ce
qui NE doit pas se déclencher : un effort ne se compare jamais à lui-même, un
premier 10 km ne se fête qu'une fois, une sortie écourtée n'est pas « bouclée
comme prévu », un 1,2 km très rapide ne prive pas une sortie longue de son
record d'allure.

### Le moteur de séance est pur

`src/features/run/engine.ts` ne connaît ni le GPS, ni le son, ni l'heure. Il
reçoit « il s'est écoulé 1,2 s et on a parcouru 4,3 m » et rend un nouvel état
plus la liste des évènements à annoncer. Deux conséquences :

- il se teste **au sol**, sans appareil et sans courir — 45 tests couvrent la
  dérive des séries, le report d'un tick d'une étape à la suivante, les
  kilomètres livrés d'un bloc après une perte de signal ;
- le chrono **lit l'horloge au lieu de compter les ticks**, ce qui le rend
  insensible au ralentissement des minuteurs quand iOS éteint l'écran.

---

## Démarrer

```bash
npm install
npm run prebuild        # génère ios/ depuis app.config.ts
npm run ios             # build + lancement sur simulateur
```

Les modules natifs employés — GPS en arrière-plan, carte, synthèse vocale — ne
fonctionnent pas dans Expo Go : il faut un build de développement. Sur
simulateur, le GPS se simule depuis *Features → Location* de Simulator.

### Mise en service

Un seul **secret** GitHub, `EXPO_TOKEN` — mais trois choses à faire une fois
hors de GitHub, parce qu'un build non interactif ne sait ni créer un projet, ni
générer des certificats Apple.

**1. Projet Expo** (2 min)

```bash
npx eas init
```

Le projet est créé côté Expo. Comme la configuration est dynamique
(`app.config.ts`), eas-cli n'y écrit pas l'identifiant lui-même : collez-le dans
la constante `EAS_PROJECT_ID` en haut du fichier, ou posez-le en **variable** de
dépôt GitHub `EAS_PROJECT_ID` (ce n'est pas un secret, il figure dans l'URL du
projet). Sans lui, `eas build --non-interactive` s'arrête avant de compiler.

**2. Credentials iOS** (une fois, depuis votre Mac, compte Apple Developer requis)

```bash
npx eas credentials --platform ios
```

Laissez EAS générer et conserver le certificat de distribution et le profil de
provisionnement. C'est indispensable : la CI ne peut pas les créer toute seule,
elle ne fait que les réutiliser. Un premier `eas build --platform ios` lancé à
la main depuis le Mac fait le même travail et valide toute la chaîne d'un coup.

**3. Soumission App Store Connect**

- Créer la fiche de l'app (bundle `com.mezdru.allure`), récupérer son
  identifiant numérique et le mettre dans `eas.json` → `submit.production.ios.ascAppId`.
- Enregistrer une clé d'API App Store Connect côté EAS (proposé au premier
  `eas submit`, ou via `eas credentials`). Sans elle, l'envoi demanderait un mot
  de passe à chaque fois — ce qu'un workflow ne peut pas fournir.

**4. Secret GitHub**

`EXPO_TOKEN` — un jeton d'accès personnel créé sur
<https://expo.dev/settings/access-tokens>, à ajouter dans
*Settings → Secrets and variables → Actions*.

Ensuite : *Actions → Release iOS → Run workflow*. La CI (`ci.yml`), elle, ne
demande **aucun** secret et tourne dès le premier push.

Identifiant de bundle : `com.mezdru.allure`.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires |
| `npm run prebuild` | Régénère `ios/` depuis `app.config.ts` |
| `npm run ios` | Build et lancement sur simulateur |
| `npm run cues` | Régénère les bips de `assets/audio` |
