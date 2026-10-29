import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, usePalette } from '../theme';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  glyph: string;
  badge?: number;
}

interface Props<K extends string> {
  tabs: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
}

export function TabBar<K extends string>({ tabs, active, onChange }: Props<K>) {
  const c = usePalette();
  return (
    <View style={[styles.bar, { backgroundColor: c.card, borderColor: c.border }]}>
      {tabs.map(tab => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}>
            <View style={[styles.pill, selected && { backgroundColor: c.accentSoft }]}>
              <Text style={[styles.glyph, { color: selected ? c.accent : c.textMuted }]}>
                {tab.glyph}
              </Text>
              {!!tab.badge && (
                <View style={[styles.badge, { backgroundColor: c.debit }]}>
                  <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: selected ? c.accent : c.textMuted }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  tab: { flex: 1, alignItems: 'center' },
  pill: {
    width: 56,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
