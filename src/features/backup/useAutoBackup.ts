import { useEffect } from 'react';
import { AppState } from 'react-native';

import { autoSnapshotIfDue } from './service';

/**
 * Prend un instantané quotidien des données, au démarrage et à chaque passage
 * en arrière-plan.
 *
 * Le passage en arrière-plan est le bon moment, et pas un minuteur : c'est
 * l'instant où l'utilisateur vient de finir ce qu'il faisait — la séance est
 * enregistrée, le plan modifié —, et c'est aussi le dernier moment où l'app a
 * la main avant qu'iOS ne la suspende ou ne la tue.
 *
 * `autoSnapshotIfDue` ne fait rien si la dernière copie date de moins d'un
 * jour : basculer dix fois entre deux apps ne réécrit pas dix fois plusieurs
 * mégaoctets.
 */
export function useAutoBackup(): void {
  useEffect(() => {
    autoSnapshotIfDue();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') autoSnapshotIfDue();
    });
    return () => subscription.remove();
  }, []);
}
