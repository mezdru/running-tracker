import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '@/app/navigation/RootNavigator';
import { useAutoBackup } from '@/features/backup/useAutoBackup';
import { colors, spacing, type as typography } from '@/shared/theme';

import { bootstrapError } from './bootstrap';
import { ErrorBoundary } from './ErrorBoundary';

export default function App() {
  useAutoBackup();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        {bootstrapError ? (
          <View style={styles.center}>
            <Text style={[typography.h2, styles.title]}>Base de données inaccessible</Text>
            <Text style={[typography.body, styles.detail]}>{bootstrapError}</Text>
          </View>
        ) : (
          <RootNavigator />
        )}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { color: colors.text, textAlign: 'center' },
  detail: { color: colors.textMuted, textAlign: 'center' },
});
