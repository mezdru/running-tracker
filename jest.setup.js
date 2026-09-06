// Modules natifs sans implémentation JS utilisable hors appareil. Les tests
// unitaires portent sur la logique (estimation d'une séance, moteur de
// séance, calculs GPS) : on neutralise le reste plutôt que de l'embarquer.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: () => undefined,
    getFirstSync: () => undefined,
    getAllSync: () => [],
    runSync: () => ({ changes: 0, lastInsertRowId: 0 }),
    withTransactionSync: (fn) => fn(),
  }),
}));

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
