// Opérations de sauvegarde vues de l'interface : exporter, importer, protéger.
//
// L'app n'a pas de serveur. Trois filets se superposent donc, du plus passif
// au plus explicite :
//
//   1. la base SQLite vit dans `Documents/`, donc dans la sauvegarde iCloud de
//      l'appareil — protection gratuite, mais invisible et liée au téléphone ;
//   2. des instantanés automatiques, écrits avant chaque opération risquée et
//      une fois par jour, qui permettent de revenir en arrière depuis l'app ;
//   3. l'export manuel, seul à sortir les données du téléphone — donc le seul
//      qui survive à sa perte. C'est pour cela que l'app le réclame quand il
//      date trop.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { backupFileName, readBackup, type BackupCheck } from '@/entities/backup/model';
import { collectBackup } from '@/entities/backup/repo';

import { listSnapshots, writeSnapshot, type Snapshot } from './files';

/** Au-delà, l'app considère que la sauvegarde hors appareil est trop vieille. */
export const EXPORT_STALE_AFTER_DAYS = 14;

/**
 * Écrit un instantané local. `reason` sert de préfixe de nom, pour qu'on
 * comprenne des mois plus tard pourquoi ce fichier existe.
 */
export function snapshotNow(reason: 'auto' | 'avant-restauration' | 'manuel'): Snapshot {
  return writeSnapshot(collectBackup(), reason);
}

/**
 * Instantané quotidien. Appelé au démarrage et quand l'app passe en arrière-
 * plan : on ne prend une copie que si la dernière date de plus d'un jour, pour
 * ne pas réécrire plusieurs mégaoctets à chaque bascule d'application.
 */
export function autoSnapshotIfDue(): Snapshot | null {
  const last = listSnapshots()[0];
  const oneDay = 24 * 3600 * 1000;
  if (last && Date.now() - last.createdAt < oneDay) return null;
  try {
    return snapshotNow('auto');
  } catch {
    // Disque plein, dossier inaccessible : l'app doit continuer de fonctionner.
    return null;
  }
}

/**
 * Exporte la sauvegarde hors de l'appareil via la feuille de partage iOS.
 * Rend `false` si l'utilisateur a annulé.
 */
export async function exportBackup(): Promise<boolean> {
  const backup = collectBackup();
  // Dans le cache : le fichier n'a d'intérêt que le temps du partage, la copie
  // durable est celle que l'utilisateur enregistre où il veut.
  const file = new File(Paths.cache, backupFileName(backup.exportedAt));
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Enregistrer la sauvegarde',
    UTI: 'public.json',
  });
  return true;
}

/**
 * Fait choisir un fichier et le valide, SANS rien écrire : la décision de
 * restaurer se prend ensuite, écran en main, une fois qu'on sait ce que le
 * fichier contient.
 */
export async function pickBackup(): Promise<BackupCheck | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    // Pas de filtre par extension : un fichier `.allure.json` arrive selon les
    // applications comme `public.json`, `public.text` ou sans type du tout, et
    // un filtre trop strict le rendrait tout simplement inélectible.
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  try {
    return readBackup(new File(picked.assets[0].uri).textSync());
  } catch {
    return { ok: false, reason: 'Fichier illisible.' };
  }
}
