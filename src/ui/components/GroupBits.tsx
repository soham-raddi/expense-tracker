// Small pieces shared by the group screens: colour dot, chip, colour picker, segmented control.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, usePalette } from '../theme';

export const GROUP_COLOURS = [
  '#E4572E', '#F49D37', '#F1A208', '#76B041', '#3BB273', '#1B998B',
  '#2E86AB', '#3F88C5', '#7B2CBF', '#A23B72', '#D7263D', '#6C757D',
];

export function Dot({ colour, size = 10 }: { colour: string | null; size?: number }) {
  const c = usePalette();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colour ?? c.border,
      }}
    />
  );
}

/** "● Food & Dining", or a muted "Add to a group" when the payment has no group. */
export function GroupChip({ name, colour }: { name: string | null; colour: string | null }) {
  const c = usePalette();
  return (
    <View style={styles.chip}>
      <Dot colour={colour} size={8} />
      <Text style={[styles.chipText, { color: name ? c.textMuted : c.accent }]} numberOfLines={1}>
        {name ?? 'Add to a group'}
      </Text>
    </View>
  );
}

export function ColourPicker({ value, onChange }: { value: string; onChange: (colour: string) => void }) {
  const c = usePalette();
  return (
    <View style={styles.swatches}>
      {GROUP_COLOURS.map(colour => (
        <Pressable
          key={colour}
          onPress={() => onChange(colour)}
          accessibilityLabel={`Colour ${colour}`}
          style={[styles.swatch, { backgroundColor: colour }, value === colour && { borderColor: c.text }]}
        />
      ))}
    </View>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const c = usePalette();
  return (
    <View style={[styles.segmented, { backgroundColor: c.cardAlt }]}>
      {options.map(o => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: c.card }]}>
            <Text style={[styles.segmentText, { color: selected ? c.text : c.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  chipText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: 'transparent' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
  segmentText: { fontSize: 14, fontWeight: '700' },
});
