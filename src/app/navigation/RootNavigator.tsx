import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarDays, History, Play, Settings2 } from 'lucide-react-native';

import { ActivitiesScreen } from '@/screens/ActivitiesScreen';
import { BackupScreen } from '@/screens/BackupScreen';
import { ActivityDetailScreen } from '@/screens/ActivityDetailScreen';
import { PlanScreen } from '@/screens/PlanScreen';
import { RunSessionScreen } from '@/screens/RunSessionScreen';
import { RunSetupScreen } from '@/screens/RunSetupScreen';
import { RunSummaryScreen } from '@/screens/RunSummaryScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { WorkoutEditorScreen } from '@/screens/WorkoutEditorScreen';
import { ZonesScreen } from '@/screens/ZonesScreen';
import { colors } from '@/shared/theme';

import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Thème de navigation aligné sur celui de l'app : sans cela, React Navigation
// peint ses propres fonds clairs entre deux écrans, ce qui produit un flash
// blanc à chaque transition sur une app entièrement sombre.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Plan"
        component={PlanScreen}
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Run"
        component={RunSetupScreen}
        options={{
          title: 'Courir',
          tabBarIcon: ({ color, size }) => <Play size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Activities"
        component={ActivitiesScreen}
        options={{
          title: 'Activités',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Réglages',
          tabBarIcon: ({ color, size }) => <Settings2 size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen
          name="WorkoutEditor"
          component={WorkoutEditorScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="RunSession"
          component={RunSessionScreen}
          options={{
            // Plein écran et sans geste de retour : pendant une séance, un
            // balayage accidentel ne doit pas quitter l'écran de course.
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="RunSummary" component={RunSummaryScreen} />
        <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
        <Stack.Screen name="Zones" component={ZonesScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Backup" component={BackupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
