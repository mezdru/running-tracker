// Modules natifs sans implémentation JS utilisable hors appareil. Les tests
// unitaires portent sur la logique (estimation d'une séance, moteur de
// séance, calculs GPS) : on neutralise le reste plutôt que de l'embarquer.
jest.mock('expo-sqlite', () => {
  // Le compteur de profondeur n'est pas de la coquetterie : SQLite N'IMBRIQUE
  // PAS les transactions. Un `BEGIN` dans un autre termine le premier, et la
  // validation extérieure échoue ensuite sur « cannot rollback - no
  // transaction is active ». Le vrai moteur le refuse, le mock aussi — sinon
  // le bug ne se voit qu'à l'exécution, au pire moment : pendant une
  // restauration de sauvegarde.
  let depth = 0;
  return {
    openDatabaseSync: () => ({
      execSync: () => undefined,
      getFirstSync: () => undefined,
      getAllSync: () => [],
      runSync: () => ({ changes: 0, lastInsertRowId: 0 }),
      withTransactionSync: (fn) => {
        if (depth > 0) {
          throw new Error('SQLite : transaction imbriquée (cannot rollback - no transaction is active)');
        }
        depth += 1;
        try {
          fn();
        } finally {
          depth -= 1;
        }
      },
    }),
  };
});

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

// Modules natifs touchés par la sauvegarde. Les tests portent sur le format et
// les règles de restauration, jamais sur le système de fichiers lui-même.
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));
jest.mock('expo-file-system', () => ({
  File: class {},
  Directory: class {},
  Paths: { document: '', cache: '' },
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
