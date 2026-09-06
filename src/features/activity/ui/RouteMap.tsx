import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

import { boundsOf, simplifyPath, simplifyTrack, type TrackPoint } from '@/shared/lib/geo';
import { colors, radius, spacing } from '@/shared/theme';
import { Small } from '@/shared/ui';

type Props = { track: TrackPoint[]; height?: number };

/**
 * Tracé de la sortie sur la carte. Aucune clé d'API n'est nécessaire : sur iOS,
 * `react-native-maps` s'appuie sur Apple Plans, déjà présent sur l'appareil.
 */
export function RouteMap({ track, height = 240 }: Props) {
  if (track.length < 2) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Small>Aucun tracé GPS pour cette sortie</Small>
      </View>
    );
  }

  // La polyligne est allégée avant rendu : au-delà de quelques centaines de
  // points, la carte devient poussive sans rien montrer de plus. Douglas–
  // Peucker d'abord — il jette les points qui n'apportent aucune forme et
  // garde les virages —, puis un plafond dur pour les parcours très sinueux.
  const points = simplifyTrack(simplifyPath(track, 2), 800).map((point) => ({
    latitude: point.lat,
    longitude: point.lon,
  }));
  const bounds = boundsOf(track);
  const region: Region | undefined = bounds
    ? {
        latitude: (bounds.minLat + bounds.maxLat) / 2,
        longitude: (bounds.minLon + bounds.maxLon) / 2,
        // Marge de 40 % autour du parcours, et un plancher pour qu'un aller-
        // retour sur 200 m ne produise pas un zoom absurde.
        latitudeDelta: Math.max(0.004, (bounds.maxLat - bounds.minLat) * 1.4),
        longitudeDelta: Math.max(0.004, (bounds.maxLon - bounds.minLon) * 1.4),
      }
    : undefined;

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation={false}
        toolbarEnabled={false}
        userInterfaceStyle="dark"
      >
        <Polyline coordinates={points} strokeColor={colors.accent} strokeWidth={4} />
        <Marker coordinate={points[0]} title="Départ" pinColor={colors.success} />
        <Marker coordinate={points[points.length - 1]} title="Arrivée" pinColor={colors.danger} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
