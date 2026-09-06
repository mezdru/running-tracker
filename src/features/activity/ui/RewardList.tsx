import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/shared/theme';
import { Body, Small } from '@/shared/ui';

import type { Reward } from '../rewards';

const TIER_COLOR: Record<Reward['tier'], string> = {
  record: colors.accent,
  milestone: '#C77DFF',
  goal: colors.success,
};

const TIER_LABEL: Record<Reward['tier'], string> = {
  record: 'Record',
  milestone: 'Première fois',
  goal: 'Objectif',
};

/**
 * Récompenses obtenues, révélées l'une après l'autre.
 *
 * Le décalage entre les cartes n'est pas décoratif : afficher trois badges
 * d'un bloc les fait lire comme une liste, les faire arriver l'un après
 * l'autre les fait lire comme un palmarès qui s'allonge.
 */
export function RewardList({ rewards }: { rewards: Reward[] }) {
  // Une valeur animée par récompense, créée une fois. La liste ne change pas
  // après le montage de cet écran : elle est calculée à l'arrivée sur le bilan.
  const [entrance] = useState(() => rewards.map(() => new Animated.Value(0)));

  useEffect(() => {
    const animation = Animated.stagger(
      110,
      entrance.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 380,
          delay: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [entrance]);

  if (rewards.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {rewards.map((reward, index) => {
        const tint = TIER_COLOR[reward.tier];
        return (
          <Animated.View
            key={reward.id}
            style={[
              styles.card,
              { borderColor: `${tint}55` },
              {
                opacity: entrance[index],
                transform: [
                  {
                    translateY: entrance[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                  {
                    scale: entrance[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: `${tint}22` }]}>
              <Text style={styles.emoji}>{reward.icon}</Text>
            </View>
            <View style={styles.texts}>
              <Text style={[typography.label, { color: tint }]}>
                {TIER_LABEL[reward.tier].toUpperCase()}
              </Text>
              <Body style={styles.title}>{reward.title}</Body>
              <Small>{reward.detail}</Small>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  texts: { flex: 1, gap: 1 },
  title: { fontWeight: '700' },
});
