import { StyleSheet, View } from 'react-native';

import { averagePace, type Activity } from '@/entities/activity/model';
import { findZone, type PaceZone } from '@/entities/pace/model';
import { formatDuration, formatKm, formatPace } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';
import { Body, Card, Label, Small, Stat } from '@/shared/ui';

import { RouteMap } from './RouteMap';
import { SplitList } from './SplitList';

type Props = {
  activity: Activity;
  zones: PaceZone[];
  /**
   * `summary` retire les chiffres déjà mis en avant par la célébration de fin
   * de séance — distance, temps, allure, dénivelé —, pour ne pas afficher deux
   * fois la même chose à dix centimètres d'écart.
   */
  variant?: 'full' | 'summary';
};

/**
 * Compte rendu d'un effort : carte, totaux, kilomètres, et — pour une séance
 * structurée — le réalisé étape par étape confronté à l'allure visée. C'est ce
 * dernier tableau qui dit si la séance a été tenue, pas la moyenne générale.
 */
export function ActivityReport({ activity, zones, variant = 'full' }: Props) {
  const pace = averagePace(activity);
  const full = variant === 'full';

  return (
    <View style={styles.wrap}>
      <RouteMap track={activity.track} />

      {full ? (
        <Card style={styles.stats}>
          <Stat value={formatKm(activity.distanceM, 2)} unit="km" label="Distance" />
          <Stat value={formatDuration(activity.durationS)} label="Temps" />
          <Stat value={formatPace(pace)} unit="/km" label="Allure" />
        </Card>
      ) : null}

      <Card style={styles.secondary}>
        <View style={styles.secondaryItem}>
          <Label>En mouvement</Label>
          {/* Même format que le temps total juste au-dessus : « 2 min » en face
              de « 01:31 » se lit comme une incohérence. */}
          <Body style={styles.secondaryValue}>{formatDuration(activity.movingS)}</Body>
        </View>
        {full ? (
          <View style={styles.secondaryItem}>
            <Label>Dénivelé +</Label>
            <Body style={styles.secondaryValue}>{Math.round(activity.elevGainM)} m</Body>
          </View>
        ) : null}
        <View style={styles.secondaryItem}>
          <Label>Points GPS</Label>
          <Body style={styles.secondaryValue}>{activity.track.length}</Body>
        </View>
      </Card>

      {activity.splits.length > 0 ? (
        <View style={styles.section}>
          <Label>Kilomètres</Label>
          <SplitList splits={activity.splits} />
        </View>
      ) : null}

      {activity.laps.length > 0 ? (
        <View style={styles.section}>
          <Label>Étapes de la séance</Label>
          <View style={styles.laps}>
            {activity.laps.map((lap, index) => {
              const zone = lap.zoneId ? findZone(zones, lap.zoneId) : undefined;
              const delta =
                lap.targetPaceSecPerKm && lap.paceSecPerKm > 0
                  ? lap.paceSecPerKm - lap.targetPaceSecPerKm
                  : null;
              return (
                <View key={`${lap.key}-${index}`} style={styles.lapRow}>
                  <View
                    style={[styles.lapBar, { backgroundColor: zone?.color ?? colors.borderStrong }]}
                  />
                  <View style={styles.lapTexts}>
                    <Body style={styles.lapLabel} numberOfLines={1}>
                      {lap.label}
                    </Body>
                    <Small>
                      {formatKm(lap.distanceM, 2)} km · {formatDuration(lap.durationS)}
                    </Small>
                  </View>
                  <View style={styles.lapPace}>
                    <Body style={styles.lapPaceValue}>{formatPace(lap.paceSecPerKm)}</Body>
                    {delta != null ? (
                      <Small
                        style={{
                          // Vert quand on a tenu ou dépassé la cible, ambre
                          // au-delà de 10 s/km de retard : la même tolérance
                          // que l'affichage en direct.
                          color:
                            delta <= 10 ? colors.success : delta <= 25 ? colors.warning : colors.danger,
                        }}
                      >
                        {delta > 0 ? '+' : ''}
                        {Math.round(delta)} s
                      </Small>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  secondary: { flexDirection: 'row', justifyContent: 'space-between' },
  secondaryItem: { gap: 2 },
  secondaryValue: { fontWeight: '700' },
  section: { gap: spacing.md },
  laps: { gap: spacing.xs },
  lapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  lapBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  lapTexts: { flex: 1, gap: 2 },
  lapLabel: { fontWeight: '600' },
  lapPace: { alignItems: 'flex-end' },
  lapPaceValue: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
