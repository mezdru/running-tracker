import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/shared/theme';

type Props = {
  /** Avancement entre 0 et 1. */
  progress: number;
  size: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
};

/**
 * Anneau de progression de l'étape en cours. Dessiné en SVG plutôt qu'avec des
 * vues arrondies : c'est le seul moyen d'avoir un arc exact, et il n'y a qu'un
 * anneau à l'écran — le coût de rendu est négligeable.
 */
export function ProgressRing({
  progress,
  size,
  stroke = 10,
  color = colors.accent,
  trackColor = colors.surfaceHi,
}: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        // L'arc part de midi et tourne dans le sens horaire, comme un chrono.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
