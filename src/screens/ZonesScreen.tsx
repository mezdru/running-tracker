import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { resolvePace, type PaceZone } from '@/entities/pace/model';
import { usePlanStore } from '@/features/plan/store';
import { formatPace } from '@/shared/lib/format';
import { newId } from '@/shared/lib/id';
import { colors, radius, spacing, type as typography, zonePalette } from '@/shared/theme';
import { Body, Button, Card, Label, Screen, Segmented, Small, Stepper, Title } from '@/shared/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Zones'>;

/**
 * Édition des zones d'allure. Chaque zone est soit un pourcentage de VMA — qui
 * suit la forme du moment — soit une allure absolue, pour un objectif
 * chronométré qui, lui, ne doit pas bouger quand la VMA change.
 */
export function ZonesScreen() {
  const navigation = useNavigation<Nav>();
  const settings = usePlanStore((state) => state.settings);
  const updateSettings = usePlanStore((state) => state.updateSettings);
  const workouts = usePlanStore((state) => state.workouts);
  const [zones, setZones] = useState<PaceZone[]>(settings.zones);

  const patch = (id: string, changes: Partial<PaceZone>) =>
    setZones((current) => current.map((zone) => (zone.id === id ? { ...zone, ...changes } : zone)));

  const remove = (zone: PaceZone) => {
    // Une zone supprimée laisse les étapes qui la référencent sans allure :
    // elles restent visibles et signalées dans l'éditeur, mais autant le dire
    // avant plutôt que de le laisser découvrir.
    const used = workouts.reduce(
      (count, workout) =>
        count +
        workout.blocks.reduce(
          (inner, block) =>
            inner +
            (block.type === 'single'
              ? block.step.zoneId === zone.id
                ? 1
                : 0
              : block.steps.filter((step) => step.zoneId === zone.id).length),
          0,
        ),
      0,
    );
    const confirm = () => setZones((current) => current.filter((item) => item.id !== zone.id));
    if (used === 0) {
      confirm();
      return;
    }
    Alert.alert(
      'Supprimer l’allure',
      `${used} étape(s) utilisent « ${zone.name} » et se retrouveront sans allure.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: confirm },
      ],
    );
  };

  const save = () => {
    updateSettings({ zones });
    navigation.goBack();
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Button label="Annuler" variant="ghost" size="sm" onPress={() => navigation.goBack()} />
        <Button label="Enregistrer" size="sm" onPress={save} />
      </View>

      <Title style={styles.title}>Allures</Title>
      <Small style={styles.intro}>
        VMA de référence : {settings.vmaKmh.toFixed(1).replace('.', ',')} km/h.
      </Small>

      {zones.map((zone) => (
        <Card key={zone.id} style={styles.card} accent={zone.color}>
          <View style={styles.cardHeader}>
            <TextInput
              value={zone.name}
              onChangeText={(name) => patch(zone.id, { name })}
              style={styles.nameInput}
              placeholder="Nom de l’allure"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Nom de l’allure"
            />
            <Pressable
              onPress={() => remove(zone)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Supprimer ${zone.name}`}
            >
              <Trash2 size={18} color={colors.danger} />
            </Pressable>
          </View>

          <View style={styles.shortRow}>
            <Label>Abréviation</Label>
            <TextInput
              value={zone.short}
              onChangeText={(short) => patch(zone.id, { short: short.toUpperCase().slice(0, 8) })}
              style={styles.shortInput}
              autoCapitalize="characters"
              accessibilityLabel="Abréviation"
            />
          </View>

          <Segmented
            value={zone.mode}
            onChange={(mode) => patch(zone.id, { mode })}
            options={[
              { value: 'vma', label: '% VMA' },
              { value: 'pace', label: 'Allure fixe' },
            ]}
          />

          {zone.mode === 'vma' ? (
            <Stepper
              value={zone.vmaPercent}
              onChange={(vmaPercent) => patch(zone.id, { vmaPercent })}
              step={1}
              min={40}
              max={130}
              format={(value) => `${value} %`}
            />
          ) : (
            <Stepper
              value={zone.paceSecPerKm}
              onChange={(paceSecPerKm) => patch(zone.id, { paceSecPerKm })}
              step={5}
              min={150}
              max={900}
              format={(value) => `${formatPace(value)} /km`}
            />
          )}

          <View style={styles.colors}>
            {zonePalette.map((color) => (
              <Pressable
                key={color}
                onPress={() => patch(zone.id, { color })}
                accessibilityRole="button"
                accessibilityLabel={`Couleur ${color}`}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  zone.color === color && styles.swatchActive,
                ]}
              />
            ))}
          </View>

          <Body style={styles.result}>
            {formatPace(resolvePace(zone, settings.vmaKmh))} /km
          </Body>
        </Card>
      ))}

      <Button
        label="Ajouter une allure"
        variant="secondary"
        full
        icon={<Plus size={16} color={colors.text} />}
        onPress={() =>
          setZones((current) => [
            ...current,
            {
              id: newId('z'),
              name: 'Nouvelle allure',
              short: 'NEW',
              color: zonePalette[current.length % zonePalette.length],
              mode: 'vma',
              vmaPercent: 75,
              paceSecPerKm: 300,
            },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { paddingBottom: spacing.xs },
  intro: { paddingBottom: spacing.lg },
  card: { gap: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameInput: { ...typography.h2, color: colors.text, flex: 1, paddingVertical: 2 },
  shortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shortInput: {
    ...typography.bodyStrong,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 96,
    textAlign: 'center',
  },
  colors: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  swatch: { width: 26, height: 26, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.text },
  result: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
