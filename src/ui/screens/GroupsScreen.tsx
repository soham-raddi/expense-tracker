// Create, rename, recolour and delete your groups (friends, merchants, food, ...).

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  addCategory,
  deleteCategory,
  DuplicateNameError,
  listCategories,
  updateCategory,
  type Category,
} from '../../data/repos/categoriesRepo';
import { recategorizeUncategorized } from '../../data/repos/categorizeRepo';
import { getDb } from '../../data/db';
import { emitDataChanged } from '../../lib/events';
import { Button } from '../components/Button';
import { ColourPicker, Dot, GROUP_COLOURS } from '../components/GroupBits';
import { ScreenHeader } from '../components/ScreenHeader';
import { radius, space, usePalette } from '../theme';

interface Editing {
  id: number | null; // null = new group
  name: string;
  colour: string;
}

export function GroupsScreen({ onBack }: { onBack: () => void }) {
  const c = usePalette();
  const [groups, setGroups] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setGroups(await listCategories(await getDb()));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = async () => {
    if (!editing) {
      return;
    }
    if (editing.name.trim() === '') {
      setError('Give the group a name');
      return;
    }
    const db = await getDb();
    try {
      if (editing.id == null) {
        await addCategory(db, editing.name, editing.colour);
      } else {
        await updateCategory(db, editing.id, editing.name, editing.colour);
      }
    } catch (e) {
      setError(e instanceof DuplicateNameError ? e.message : 'Could not save this group');
      return;
    }
    setEditing(null);
    setError(null);
    await reload();
    emitDataChanged();
  };

  const remove = (group: Category) => {
    Alert.alert(
      `Delete "${group.name}"?`,
      'Payments in this group move back to "Add to a group". Its auto-sort rules are deleted too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const db = await getDb();
            await deleteCategory(db, group.id);
            await recategorizeUncategorized(db);
            setEditing(null);
            await reload();
            emitDataChanged();
          },
        },
      ],
    );
  };

  const startNew = () => {
    setError(null);
    setEditing({ id: null, name: '', colour: GROUP_COLOURS[groups.length % GROUP_COLOURS.length] });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <ScreenHeader title="Your groups" onBack={onBack} />
      <FlatList
        data={groups}
        keyExtractor={g => String(g.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={[styles.introText, { color: c.textMuted }]}>
              Groups sort your payments, like Food, Friends or a merchant you use a lot. Tap a group to
              rename or recolour it. Put a payment in a group from the Home screen, or set auto-sort
              rules so it happens by itself.
            </Text>
            <Button label="+ New group" onPress={startNew} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setError(null);
              setEditing({ id: item.id, name: item.name, colour: item.colour });
            }}
            style={[styles.row, { backgroundColor: c.card }]}
            accessibilityLabel={`Edit ${item.name}`}>
            <Dot colour={item.colour} size={16} />
            <Text style={[styles.rowName, { color: c.text }]}>{item.name}</Text>
            {item.excludeFromTotals && (
              <Text style={[styles.tag, { color: c.textMuted, backgroundColor: c.cardAlt }]}>not in totals</Text>
            )}
            <Text style={[styles.chevron, { color: c.textMuted }]}>›</Text>
          </Pressable>
        )}
      />

      <Modal visible={editing != null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        {/* The padding keeps the sheet above the keyboard; Android does not resize modals itself. */}
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <Pressable style={styles.backdrop} onPress={() => setEditing(null)} accessibilityLabel="Close" />
          <View style={[styles.sheet, { backgroundColor: c.card }]}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>
              {editing?.id == null ? 'New group' : 'Edit group'}
            </Text>
            <TextInput
              value={editing?.name ?? ''}
              onChangeText={name => editing && setEditing({ ...editing, name })}
              placeholder="Group name, e.g. Friends"
              placeholderTextColor={c.textMuted}
              autoFocus
              maxLength={30}
              style={[styles.input, { color: c.text, backgroundColor: c.cardAlt, borderColor: c.border }]}
            />
            <Text style={[styles.label, { color: c.textMuted }]}>Colour</Text>
            <ColourPicker value={editing?.colour ?? GROUP_COLOURS[0]} onChange={colour => editing && setEditing({ ...editing, colour })} />
            {error && <Text style={[styles.error, { color: c.debit }]}>{error}</Text>}
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button label="Save" onPress={save} />
              </View>
              {editing?.id != null && (
                <View style={styles.flex}>
                  <Button
                    label="Delete"
                    kind="secondary"
                    onPress={() => {
                      const g = groups.find(x => x.id === editing.id);
                      if (g) {
                        remove(g);
                      }
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.xl * 2 },
  intro: { padding: space.lg, gap: space.lg },
  introText: { fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
  },
  rowName: { flex: 1, fontSize: 16, fontWeight: '700' },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  chevron: { fontSize: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, fontSize: 16 },
  label: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
});
