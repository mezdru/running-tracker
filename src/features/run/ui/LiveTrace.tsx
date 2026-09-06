import { memo } from 'react';

import { RouteMap } from '@/features/activity/ui/RouteMap';

import { useRunStore } from '../store';

/**
 * Carte du parcours pendant une sortie libre — là où il n'y a pas d'étape à
 * afficher, c'est ce qu'on veut voir.
 *
 * Deux précautions de rendu, et elles comptent : le composant est mémoïsé sans
 * propriété, donc le rafraîchissement de l'écran de course (quatre fois par
 * seconde, pour le chrono) ne le traverse pas ; et il s'abonne lui-même à la
 * seule trace, dont l'identité ne change qu'à l'arrivée d'un point GPS,
 * environ une fois par seconde. La carte suit donc le GPS, pas le chrono.
 */
export const LiveTrace = memo(function LiveTrace({ height }: { height: number }) {
  const track = useRunStore((state) => state.track);
  return <RouteMap track={track} height={height} />;
});
