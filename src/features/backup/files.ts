// Sauvegardes sur le disque de l'appareil.
//
// Elles vivent dans `Documents/backups/`, et l'emplacement n'est pas anodin :
// iOS inclut ce dossier dans la sauvegarde iCloud de l'appareil. Une
// sauvegarde automatique voyage donc avec le téléphone sans que l'utilisateur
// n'ait rien à faire — c'est la protection passive. L'export manuel, lui, met
// le fichier là où l'utilisateur le décide (Fichiers, iCloud Drive, mail) :
// c'est la protection active, la seule qui survive à la perte du téléphone.
import { Directory, File, Paths } from 'expo-file-system';

import { backupFileName, type Backup } from '@/entities/backup/model';

const DIR_NAME = 'backups';

/**
 * Budget disque des sauvegardes automatiques. Au-delà, les plus anciennes
 * sont supprimées — jamais la plus récente. Une trace GPS pèse quelques
 * centaines de kilo-octets, donc une année de course tient largement dedans,
 * mais on ne laisse pas le dossier grossir sans limite sur un téléphone.
 */
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

/** Et jamais plus de N fichiers, même minuscules. */
const MAX_FILES = 12;

export type Snapshot = {
  name: string;
  uri: string;
  size: number;
  /** Horodatage de création, lu dans le nom du fichier. */
  createdAt: number;
};

function directory(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Sauvegardes présentes, de la plus récente à la plus ancienne. */
export function listSnapshots(): Snapshot[] {
  try {
    return directory()
      .list()
      .filter((entry): entry is File => entry instanceof File && entry.name.endsWith('.json'))
      .map((file) => ({
        name: file.name,
        uri: file.uri,
        size: file.size ?? 0,
        createdAt: timestampFromName(file.name),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    // Dossier illisible : on préfère une liste vide à un écran en erreur.
    return [];
  }
}

/**
 * L'horodatage est LU DANS LE NOM et non dans les métadonnées du fichier :
 * une restauration système peut réécrire les dates de fichiers, alors que le
 * nom, lui, dit toujours quand la sauvegarde a été prise.
 */
function timestampFromName(name: string): number {
  const match = name.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/);
  if (!match) return 0;
  const [, y, m, d, hh, mm] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)).getTime();
}

/** Écrit une sauvegarde et fait le ménage. Rend le fichier créé. */
export function writeSnapshot(backup: Backup, prefix = 'allure'): Snapshot {
  const dir = directory();
  const name = backupFileName(backup.exportedAt, prefix);
  const file = new File(dir, name);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));

  prune();

  return {
    name,
    uri: file.uri,
    size: file.size ?? 0,
    createdAt: backup.exportedAt,
  };
}

/**
 * Supprime les plus anciennes au-delà du budget. La plus récente n'est JAMAIS
 * supprimée, quelle que soit sa taille : mieux vaut dépasser le budget que de
 * se retrouver sans aucune sauvegarde.
 */
function prune(): void {
  const snapshots = listSnapshots();
  let total = 0;
  snapshots.forEach((snapshot, index) => {
    total += snapshot.size;
    const tooMany = index >= MAX_FILES;
    const tooBig = index > 0 && total > MAX_TOTAL_BYTES;
    if (!tooMany && !tooBig) return;
    try {
      new File(snapshot.uri).delete();
    } catch {
      // fichier déjà parti
    }
  });
}

export function readSnapshot(uri: string): string {
  return new File(uri).textSync();
}

export function deleteSnapshot(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // déjà supprimé
  }
}

export function totalSize(): number {
  return listSnapshots().reduce((sum, snapshot) => sum + snapshot.size, 0);
}

/** `12,4 Mo`, `840 ko` — la taille d'une sauvegarde doit rester lisible. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
