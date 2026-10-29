import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addMonths, monthLabel, sameMonth, type MonthRef } from '../../lib/format';
import { radius, space, usePalette } from '../theme';

interface Props {
  month: MonthRef;
  current: MonthRef; // the real current month; you cannot go past it
  onChange: (month: MonthRef) => void;
}

export function MonthSwitcher({ month, current, onChange }: Props) {
  const c = usePalette();
  const atCurrent = sameMonth(month, current);
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.arrow, { backgroundColor: c.card, borderColor: c.border }]}
        onPress={() => onChange(addMonths(month, -1))}
        accessibilityLabel="Previous month">
        <Text style={[styles.arrowText, { color: c.text }]}>‹</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.text }]}>{monthLabel(month)}</Text>
      <Pressable
        style={[styles.arrow, { backgroundColor: c.card, borderColor: c.border }, atCurrent && styles.disabled]}
        onPress={() => onChange(addMonths(month, 1))}
        disabled={atCurrent}
        accessibilityLabel="Next month">
        <Text style={[styles.arrowText, { color: c.text }]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700' },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: space.xs,
  },
  arrowText: { fontSize: 24, lineHeight: 28, fontWeight: '600' },
  disabled: { opacity: 0.35 },
});
