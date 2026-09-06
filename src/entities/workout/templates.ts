// Modèles de séance. Deux sources : un catalogue intégré (les séances
// classiques d'un plan de course à pied, prêtes à poser sur une date) et les
// modèles enregistrés par l'utilisateur depuis une de ses propres séances.
import { ZONE_IDS } from '@/entities/pace/model';
import { db } from '@/shared/db';
import { newId } from '@/shared/lib/id';

import { cloneBlocks, makeStep, repeatBlock, singleBlock, type Block, type WorkoutKind } from './model';

export type Template = {
  id: string;
  name: string;
  kind: WorkoutKind;
  blocks: Block[];
  /** Modèle du catalogue intégré : ni modifiable ni supprimable. */
  builtin: boolean;
};

// Les identifiants de zone référencés ici sont ceux de `DEFAULT_ZONES`. Un
// modèle appliqué après suppression d'une zone garde une étape sans allure —
// l'éditeur la signale, plutôt que de choisir à la place de l'utilisateur.
const Z = ZONE_IDS;

const warmup = (minutes: number) =>
  singleBlock(
    makeStep({ kind: 'warmup', zoneId: Z.easy, target: { type: 'time', seconds: minutes * 60 } }),
  );

const cooldown = (minutes: number) =>
  singleBlock(
    makeStep({ kind: 'cooldown', zoneId: Z.recovery, target: { type: 'time', seconds: minutes * 60 } }),
  );

const walk = (minutes: number, kind: 'warmup' | 'walk' | 'cooldown' = 'walk') =>
  singleBlock(
    makeStep({ kind, zoneId: Z.walk, target: { type: 'time', seconds: minutes * 60 } }),
  );

/**
 * Catalogue intégré. Recréé à chaque appel — et non figé dans une constante —
 * parce que chaque bloc porte des identifiants générés : un catalogue partagé
 * ferait éditer le modèle en même temps que la séance qui en est issue.
 */
export function builtinTemplates(): Template[] {
  const make = (name: string, kind: WorkoutKind, blocks: Block[]): Template => ({
    id: newId('tpl'),
    name,
    kind,
    blocks,
    builtin: true,
  });

  return [
    make('Footing 45 min', 'easy', [
      singleBlock(
        makeStep({ kind: 'run', zoneId: Z.easy, target: { type: 'time', seconds: 45 * 60 } }),
      ),
    ]),
    make('Sortie longue 1 h 30', 'long', [
      singleBlock(
        makeStep({ kind: 'run', zoneId: Z.easy, target: { type: 'time', seconds: 90 * 60 } }),
      ),
    ]),
    make('10 × 400 m VMA', 'intervals', [
      warmup(20),
      repeatBlock(10, [
        makeStep({ kind: 'interval', zoneId: Z.vma, target: { type: 'distance', meters: 400 } }),
        makeStep({ kind: 'recovery', zoneId: Z.recovery, target: { type: 'time', seconds: 60 } }),
      ]),
      cooldown(10),
    ]),
    make('30/30 × 12', 'intervals', [
      warmup(20),
      repeatBlock(12, [
        makeStep({ kind: 'interval', zoneId: Z.vma, target: { type: 'time', seconds: 30 } }),
        makeStep({ kind: 'recovery', zoneId: Z.recovery, target: { type: 'time', seconds: 30 } }),
      ]),
      cooldown(10),
    ]),
    make('3 × 10 min au seuil', 'tempo', [
      warmup(20),
      repeatBlock(3, [
        makeStep({ kind: 'interval', zoneId: Z.threshold, target: { type: 'time', seconds: 600 } }),
        makeStep({ kind: 'recovery', zoneId: Z.recovery, target: { type: 'time', seconds: 180 } }),
      ]),
      cooldown(10),
    ]),
    make('Pyramide 200-400-800-400-200', 'intervals', [
      warmup(20),
      ...[200, 400, 800, 400, 200].flatMap((meters) => [
        singleBlock(
          makeStep({ kind: 'interval', zoneId: Z.vma, target: { type: 'distance', meters } }),
        ),
        singleBlock(
          makeStep({
            kind: 'recovery',
            zoneId: Z.recovery,
            target: { type: 'time', seconds: meters >= 800 ? 180 : 90 },
          }),
        ),
      ]),
      cooldown(10),
    ]),
    make('Séance allure spécifique 2 × 20 min', 'tempo', [
      warmup(15),
      repeatBlock(2, [
        makeStep({ kind: 'interval', zoneId: Z.marathon, target: { type: 'time', seconds: 20 * 60 } }),
        makeStep({ kind: 'recovery', zoneId: Z.recovery, target: { type: 'time', seconds: 300 } }),
      ]),
      cooldown(10),
    ]),
    make('Test VMA — 6 × 300 m', 'intervals', [
      warmup(20),
      repeatBlock(6, [
        makeStep({ kind: 'interval', zoneId: Z.tenK, target: { type: 'distance', meters: 300 } }),
        makeStep({ kind: 'recovery', zoneId: Z.recovery, target: { type: 'time', seconds: 90 } }),
      ]),
      cooldown(10),
    ]),
    // Séances à récupération MARCHÉE : c'est la forme classique du fractionné
    // court quand on cherche à récupérer vraiment entre les répétitions, et la
    // base de toute reprise après une coupure.
    make('12 × 1 min / 1 min marche', 'intervals', [
      warmup(15),
      repeatBlock(12, [
        makeStep({ kind: 'interval', zoneId: Z.vma, target: { type: 'time', seconds: 60 } }),
        makeStep({ kind: 'walk', zoneId: Z.walk, target: { type: 'time', seconds: 60 } }),
      ]),
      cooldown(10),
    ]),
    make('Reprise course-marche 8 × (3 min / 2 min)', 'easy', [
      walk(5, 'warmup'),
      repeatBlock(8, [
        makeStep({ kind: 'run', zoneId: Z.easy, target: { type: 'time', seconds: 180 } }),
        makeStep({ kind: 'walk', zoneId: Z.walk, target: { type: 'time', seconds: 120 } }),
      ]),
      walk(5, 'cooldown'),
    ]),
    make('Côtes 8 × 45 s, retour marché', 'intervals', [
      warmup(20),
      repeatBlock(8, [
        makeStep({ kind: 'interval', zoneId: Z.sprint, target: { type: 'time', seconds: 45 } }),
        makeStep({ kind: 'walk', zoneId: Z.walk, target: { type: 'time', seconds: 120 } }),
      ]),
      cooldown(10),
    ]),
    make('Récupération 30 min', 'recovery', [
      singleBlock(
        makeStep({ kind: 'run', zoneId: Z.recovery, target: { type: 'time', seconds: 30 * 60 } }),
      ),
    ]),
  ];
}

type Row = { id: string; name: string; kind: string; blocks: string; created_at: number };

export function listUserTemplates(): Template[] {
  return db()
    .getAllSync<Row>('SELECT * FROM templates ORDER BY created_at DESC')
    .map((row) => {
      let blocks: Block[] = [];
      try {
        const parsed: unknown = JSON.parse(row.blocks);
        if (Array.isArray(parsed)) blocks = parsed as Block[];
      } catch {
        // modèle illisible : il s'affiche vide plutôt que de faire échouer la liste
      }
      return { id: row.id, name: row.name, kind: row.kind as WorkoutKind, blocks, builtin: false };
    });
}

export function saveUserTemplate(name: string, kind: WorkoutKind, blocks: Block[]): Template {
  const template: Template = {
    id: newId('tpl'),
    name,
    kind,
    // On stocke une copie aux identifiants neufs : le modèle doit être
    // indépendant de la séance dont il est issu.
    blocks: cloneBlocks(blocks),
    builtin: false,
  };
  db().runSync('INSERT INTO templates (id, name, kind, blocks, created_at) VALUES (?, ?, ?, ?, ?)', [
    template.id,
    template.name,
    template.kind,
    JSON.stringify(template.blocks),
    Date.now(),
  ]);
  return template;
}

export function deleteUserTemplate(id: string): void {
  db().runSync('DELETE FROM templates WHERE id = ?', [id]);
}
