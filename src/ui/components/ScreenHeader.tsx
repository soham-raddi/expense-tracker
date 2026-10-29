import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { space, usePalette } from '../theme';

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={[styles.bar, { backgroundColor: c.background, borderColor: c.border }]}>
      <Pressable onPress={onBack} style={styles.back} accessibilityLabel="Back" hitSlop={8}>
        <Text style={[styles.backText, { color: c.accent }]}>‹ Back</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 72 },
  backText: { fontSize: 16, fontWeight: '700' },
  title: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  right: { width: 72, alignItems: 'flex-end' },
});
