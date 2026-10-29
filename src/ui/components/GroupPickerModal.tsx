// A bottom sheet listing your groups. Used to place a payment and to choose a group for a rule.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../../data/repos/categoriesRepo';
import { radius, space, usePalette } from '../theme';
import { Dot } from './GroupBits';

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  categories: Category[];
  selectedId?: number | null;
  onPick: (category: Category) => void;
  onClose: () => void;
  children?: React.ReactNode; // extra options shown above the list
  footer?: React.ReactNode;
}

export function GroupPickerModal({
  visible,
  title,
  subtitle,
  categories,
  selectedId,
  onPick,
  onClose,
  children,
  footer,
}: Props) {
  const c = usePalette();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.card }]}>
        <View style={[styles.grabber, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text> : null}
        {children}
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {categories.map(cat => {
            const selected = cat.id === selectedId;
            return (
              <Pressable
                key={cat.id}
                onPress={() => onPick(cat)}
                style={[styles.row, selected && { backgroundColor: c.accentSoft }]}>
                <Dot colour={cat.colour} size={14} />
                <Text style={[styles.rowText, { color: c.text }]}>{cat.name}</Text>
                {selected && <Text style={[styles.tick, { color: c.accent }]}>✓</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
        {footer}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: space.sm, marginBottom: space.md },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2, marginBottom: space.sm },
  list: { marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  rowText: { flex: 1, fontSize: 16, fontWeight: '600' },
  tick: { fontSize: 18, fontWeight: '800' },
});
