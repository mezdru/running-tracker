import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { resolvePace } from '@/entities/pace/model';
import { usePlanStore } from '@/features/plan/store';
import { formatDurationShort, formatPace } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';
import { Body, Card, Label, Row, Screen, Small, Stepper, Title, ToggleRow } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const settings = usePlanStore((state) => state.settings);
  const updateSettings = usePlanStore((state) => state.updateSettings);
  const workouts = usePlanStore((state) => state.workouts);
  const activities = usePlanStore((state) => state.activities);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Title>Réglages</Title>
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Label>Vitesse maximale aérobie</Label>
          <Small>
            Toutes les allures en pourcentage de VMA sont recalculées, dans le plan comme dans les
            séances déjà saisies.
          </Small>
        </View>
        <Stepper
          value={settings.vmaKmh}
          onChange={(vmaKmh) => updateSettings({ vmaKmh })}
          step={0.5}
          min={8}
          max={26}
          format={(value) => `${value.toFixed(1).replace('.', ',')} km/h`}
        />
        <View style={styles.zonePreview}>
          {settings.zones.map((zone) => (
            <View key={zone.id} style={styles.zoneItem}>
              <View style={[styles.zoneDot, { backgroundColor: zone.color }]} />
              <Small style={styles.zoneShort}>{zone.short}</Small>
              <Body style={styles.zonePace}>{formatPace(resolvePace(zone, settings.vmaKmh))}</Body>
            </View>
          ))}
        </View>
      </Card>

      <Card padded={false} style={styles.card}>
        <View style={styles.rows}>
          <Row
            label="Allures"
            hint={`${settings.zones.length} zones`}
            onPress={() => navigation.navigate('Zones')}
          />
        </View>
      </Card>

      <Label style={styles.sectionLabel}>Pendant la séance</Label>
      <Card padded={false} style={styles.card}>
        <View style={styles.rows}>
          <ToggleRow
            label="Annonces vocales"
            hint="Chaque étape est annoncée, avec sa cible et son allure."
            value={settings.voiceEnabled}
            onChange={(voiceEnabled) => updateSettings({ voiceEnabled })}
          />
          <ToggleRow
            label="Bips"
            hint="Décompte de trois secondes avant chaque changement d’étape."
            value={settings.beepsEnabled}
            onChange={(beepsEnabled) => updateSettings({ beepsEnabled })}
          />
          <ToggleRow
            label="Pause automatique"
            hint="Le temps continue mais ne compte plus à l’arrêt. À éviter sur piste."
            value={settings.autoPause}
            onChange={(autoPause) => updateSettings({ autoPause })}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Label>Décompte avant le départ</Label>
        <Stepper
          value={settings.countdownS}
          onChange={(countdownS) => updateSettings({ countdownS })}
          step={1}
          min={0}
          max={30}
          format={(value) => (value === 0 ? 'Départ immédiat' : formatDurationShort(value))}
        />
      </Card>

      <Card style={styles.card}>
        <Label>Annonce automatique</Label>
        <Stepper
          value={settings.autoLapKm}
          onChange={(autoLapKm) => updateSettings({ autoLapKm })}
          step={1}
          min={0}
          max={10}
          format={(value) =>
            value === 0 ? 'Désactivée' : `Tous les ${value} km`
          }
        />
      </Card>

      <Label style={styles.sectionLabel}>Données</Label>
      <Card padded={false} style={styles.card}>
        <View style={styles.rows}>
          <Row label="Séances planifiées" value={String(workouts.length)} />
          <Row label="Activités enregistrées" value={String(activities.length)} />
        </View>
      </Card>
      <Small style={styles.footnote}>
        Tout est stocké sur cet appareil, dans une base SQLite locale : aucun compte, aucun serveur.
        Pensez à garder une sauvegarde iCloud du téléphone.
      </Small>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  card: { gap: spacing.lg, marginBottom: spacing.md },
  cardHeader: { gap: spacing.xs },
  rows: { paddingHorizontal: spacing.lg },
  sectionLabel: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  zonePreview: { gap: spacing.sm },
  zoneItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneShort: { flex: 1, color: colors.textMuted },
  zonePace: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  footnote: { paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
});
