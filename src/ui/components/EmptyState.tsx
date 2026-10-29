import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { space, usePalette } from '../theme';

interface Props {
  title: string;
  message: string;
  children?: React.ReactNode;
}

export function EmptyState({ title, message, children }: Props) {
  const c = usePalette();
  return (
    <View style={styles.box}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.message, { color: c.textMuted }]}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: space.xl * 2, paddingHorizontal: space.xl },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', marginTop: space.sm, lineHeight: 20 },
});
