import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Download, ShieldCheck, Upload } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import type { BackupSummary } from '@/entities/backup/model';
import { restoreBackup, type RestoreMode } from '@/entities/backup/repo';
import { EXPORT_STALE_AFTER_DAYS, exportBackup, pickBackup, snapshotNow } from '@/features/backup/service';
import {
  deleteSnapshot,
  formatBytes,
  listSnapshots,
  readSnapshot,
  type Snapshot,
} from '@/features/backup/files';
import { readBackup } from '@/entities/backup/model';
import { usePlanStore } from '@/features/plan/store';
import { formatKm } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';
import { Body, Button, Card, Label, Row, Screen, Small, Title } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Backup'>;

const DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function daysSince(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (24 * 3600 * 1000));
}

/**
 * Écran de sauvegarde. Il porte une responsabilité inhabituelle pour un écran
 * de réglages : sans serveur, c'est ici — et nulle part ailleurs — que les
 * données de l'utilisateur peuvent être mises à l'abri.
 */
export function BackupScreen() {
  const navigation = useNavigation<Nav>();
  const settings = usePlanStore((state) => state.settings);
  const workouts = usePlanStore((state) => state.workouts);
  const activities = usePlanStore((state) => state.activities);
  const updateSettings = usePlanStore((state) => state.updateSettings);
  const hydrate = usePlanStore((state) => state.hydrate);

  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => listSnapshots());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setSnapshots(listSnapshots()), []);

  const applyRestore = useCallback(
    (raw: string, summary: BackupSummary, mode: RestoreMode) => {
      try {
        const check = readBackup(raw);
        if (!check.ok) {
          Alert.alert('Restauration impossible', check.reason);
          return;
        }
        // Filet avant le filet : une restauration malencontreuse doit elle
        // aussi pouvoir être annulée.
        snapshotNow('avant-restauration');
        const result = restoreBackup(check.backup, mode);
        hydrate();
        refresh();
        Alert.alert(
          'Restauration terminée',
          `${result.workouts} séance(s), ${result.activities} activité(s) et ${result.templates} modèle(s) restaurés.\n\n` +
            `Une sauvegarde de l'état précédent a été conservée sur l'appareil.`,
        );
      } catch (error) {
        Alert.alert(
          'Restauration impossible',
          error instanceof Error ? error.message : 'Erreur inconnue.',
        );
      }
      void summary;
    },
    [hydrate, refresh],
  );

  const askRestore = useCallback(
    (raw: string, summary: BackupSummary, source: string) => {
      Alert.alert(
        'Restaurer cette sauvegarde ?',
        `${source}\n\n` +
          `${summary.workouts} séance(s), ${summary.activities} activité(s), ` +
          `${formatKm(summary.activityDistanceM, 1)} km enregistrés.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ajouter ce qui manque',
            onPress: () => applyRestore(raw, summary, 'merge'),
          },
          {
            text: 'Tout remplacer',
            style: 'destructive',
            onPress: () => applyRestore(raw, summary, 'replace'),
          },
        ],
      );
    },
    [applyRestore],
  );

  const handleExport = async () => {
    setBusy(true);
    try {
      await exportBackup();
      updateSettings({ lastExportAt: Date.now() });
    } catch (error) {
      Alert.alert(
        'Export impossible',
        error instanceof Error ? error.message : 'La sauvegarde n’a pas pu être créée.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      const picked = await pickBackup();
      if (!picked) return;
      if (!picked.ok) {
        Alert.alert('Fichier refusé', picked.reason);
        return;
      }
      askRestore(
        JSON.stringify(picked.backup),
        picked.summary,
        `Sauvegarde du ${DATE.format(new Date(picked.summary.exportedAt))}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSnapshot = () => {
    try {
      snapshotNow('manuel');
      refresh();
    } catch (error) {
      Alert.alert(
        'Sauvegarde impossible',
        error instanceof Error ? error.message : 'Espace disque insuffisant ?',
      );
    }
  };

  const exportedDays = settings.lastExportAt > 0 ? daysSince(settings.lastExportAt) : null;
  const exportStale = exportedDays === null || exportedDays >= EXPORT_STALE_AFTER_DAYS;
  const totalBytes = snapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={20} color={colors.text} />
        </Pressable>
      </View>

      <Title style={styles.title}>Sauvegarde</Title>
      <Small style={styles.intro}>
        Vos données ne quittent jamais cet appareil : il n’y a ni compte ni serveur. C’est ce qui
        rend l’app utilisable sans réseau — et ce qui rend cet écran important.
      </Small>

      <Card style={[styles.status, exportStale && styles.statusStale]}>
        <View style={styles.statusHeader}>
          <ShieldCheck size={18} color={exportStale ? colors.warning : colors.success} />
          <Body style={styles.statusTitle}>
            {exportedDays === null
              ? 'Jamais exporté hors de l’appareil'
              : exportedDays === 0
                ? 'Exporté aujourd’hui'
                : `Dernier export il y a ${exportedDays} jour${exportedDays > 1 ? 's' : ''}`}
          </Body>
        </View>
        <Small>
          {exportStale
            ? 'Les sauvegardes automatiques restent sur le téléphone : elles ne vous protègent pas de sa perte. Exportez le fichier vers iCloud Drive ou Fichiers.'
            : 'Une copie existe en dehors de l’appareil. C’est la seule qui survive à sa perte.'}
        </Small>
        <View style={styles.counts}>
          <Small>{workouts.length} séances</Small>
          <Small style={styles.dot}>·</Small>
          <Small>{activities.length} activités</Small>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          label="Exporter la sauvegarde"
          full
          loading={busy}
          icon={<Upload size={16} color={colors.accentInk} />}
          onPress={handleExport}
        />
        <Button
          label="Restaurer depuis un fichier"
          variant="secondary"
          full
          disabled={busy}
          icon={<Download size={16} color={colors.text} />}
          onPress={handleImport}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Label>Sur l’appareil</Label>
        <Button label="Sauvegarder" size="sm" variant="secondary" onPress={handleSnapshot} />
      </View>

      {snapshots.length === 0 ? (
        <Small style={styles.empty}>
          Aucune sauvegarde locale pour l’instant. L’app en prend une par jour, et une avant
          chaque restauration.
        </Small>
      ) : (
        <Card padded={false}>
          <View style={styles.rows}>
            {snapshots.map((snapshot) => (
              <Row
                key={snapshot.uri}
                label={DATE.format(new Date(snapshot.createdAt))}
                hint={`${labelOf(snapshot.name)} · ${formatBytes(snapshot.size)}`}
                onPress={() => {
                  const raw = readSnapshot(snapshot.uri);
                  const check = readBackup(raw);
                  if (!check.ok) {
                    Alert.alert('Sauvegarde illisible', check.reason, [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Supprimer',
                        style: 'destructive',
                        onPress: () => {
                          deleteSnapshot(snapshot.uri);
                          refresh();
                        },
                      },
                    ]);
                    return;
                  }
                  askRestore(raw, check.summary, `Sauvegarde locale « ${snapshot.name} ».`);
                }}
              />
            ))}
          </View>
        </Card>
      )}

      <Small style={styles.footnote}>
        {snapshots.length > 0 ? `${formatBytes(totalBytes)} occupés. ` : ''}
        Ces fichiers sont rangés dans les documents de l’app : ils sont donc inclus dans la
        sauvegarde iCloud du téléphone, et restaurés avec lui.
      </Small>
    </Screen>
  );
}

/** « avant-restauration » → « avant restauration », pour l'affichage. */
function labelOf(fileName: string): string {
  if (fileName.startsWith('avant-restauration')) return 'avant restauration';
  if (fileName.startsWith('manuel')) return 'manuelle';
  return 'automatique';
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  title: { paddingBottom: spacing.xs },
  intro: { paddingBottom: spacing.lg },
  status: { gap: spacing.sm },
  statusStale: { borderColor: colors.warning },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusTitle: { fontWeight: '700', flex: 1 },
  counts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { color: colors.textFaint },
  actions: { gap: spacing.sm, paddingTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  rows: { paddingHorizontal: spacing.lg },
  empty: { paddingVertical: spacing.md },
  footnote: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
});
