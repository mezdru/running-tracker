// Ouverture de la base et chargement du plan, AU CHARGEMENT DU MODULE et non
// dans un effet. L'opération est synchrone (cf. shared/db) et doit être finie
// avant le premier rendu : la faire dans un effet imposerait un écran d'attente
// pour rien, et un `setState` dans un effet pour signaler l'échec.
import { usePlanStore } from '@/features/plan/store';

function bootstrap(): string | null {
  try {
    usePlanStore.getState().hydrate();
    return null;
  } catch (error) {
    // Une base illisible doit produire un message, jamais un écran figé.
    return error instanceof Error ? error.message : 'Erreur inconnue';
  }
}

export const bootstrapError = bootstrap();
