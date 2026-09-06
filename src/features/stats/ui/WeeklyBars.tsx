import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { colors, radius } from '@/shared/theme';
import { Label } from '@/shared/ui';

import type { WeekStat } from '../compute';

type Props = { weeks: WeekStat[]; height?: number };

/**
 * Volume hebdomadaire : le réalisé en plein, le prévu en creux derrière, et
 * l'objectif du plan en trait horizontal.
 *
 * Trois informations superposées et non trois graphiques, parce que la seule
 * question qui compte se lit d'un coup d'œil : est-ce que la barre pleine
 * atteint le trait ?
 */
export function WeeklyBars({ weeks, height = 150 }: Props) {
  if (weeks.length === 0) return null;

  const max = Math.max(
    1,
    ...weeks.map((week) => Math.max(week.doneM, week.plannedM, week.targetM ?? 0)),
  );
  // Repère haut arrondi : une échelle qui colle au maximum exact fait varier
  // la hauteur des barres d'une période à l'autre sans que rien n'ait changé.
  const ceiling = Math.ceil(max / 10000) * 10000 || max;

  const width = 100; // pourcentages : le SVG s'étire à la largeur disponible
  const gap = 1.4;
  const slot = width / weeks.length;
  const barWidth = Math.max(1.5, slot - gap);
  const scale = (meters: number) => (meters / ceiling) * height;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {weeks.map((week, index) => {
          const x = index * slot + gap / 2;
          const done = scale(week.doneM);
          const planned = scale(week.plannedM);
          return (
            <React.Fragment key={week.monday}>
              {week.plannedM > 0 ? (
                <Rect
                  x={x}
                  y={height - planned}
                  width={barWidth}
                  height={planned}
                  fill={colors.surfaceHi}
                  rx={0.6}
                />
              ) : null}
              {week.doneM > 0 ? (
                <Rect
                  x={x}
                  y={height - done}
                  width={barWidth}
                  height={done}
                  fill={colors.accent}
                  rx={0.6}
                />
              ) : null}
              {week.targetM ? (
                <Line
                  x1={x - gap / 4}
                  x2={x + barWidth + gap / 4}
                  y1={height - scale(week.targetM)}
                  y2={height - scale(week.targetM)}
                  stroke={colors.warning}
                  strokeWidth={1.4}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={styles.legend}>
        <Legend color={colors.accent} label="Réalisé" />
        <Legend color={colors.surfaceHi} label="Prévu" />
        {weeks.some((week) => week.targetM) ? (
          <Legend color={colors.warning} label="Objectif du plan" />
        ) : null}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Label>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 8, height: 8, borderRadius: radius.sm / 3 },
});
