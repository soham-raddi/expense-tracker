// Auto-sort rules: "if the payee name contains dominos, put it in Food & Dining".

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  addRule,
  deleteRule,
  listCategories,
  listRules,
  USER_RULE_PRIORITY,
  type Category,
  type RuleRow,
} from '../data/categoriesRepo';
import { recategorizeUncategorized } from '../data/categorizeRepo';
import { getDb } from '../data/db';
import type { RuleField } from '../data/types';
import { emitDataChanged } from '../ingest/events';
import { Button } from './components/Button';
import { Dot, Segmented } from './components/GroupBits';
import { GroupPickerModal } from './components/GroupPickerModal';
import { ScreenHeader } from './components/ScreenHeader';
import { radius, space, usePalette } from './theme';

const FIELD_LABEL: Record<RuleField, string> = {
  PAYEE_NAME: 'name has',
  VPA: 'UPI ID has',
  REMARK: 'note has',
};

export function RulesScreen({ onBack }: { onBack: () => void }) {
  const c = usePalette();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [groups, setGroups] = useState<Category[]>([]);
  const [keyword, setKeyword] = useState('');
  const [field, setField] = useState<RuleField>('PAYEE_NAME');
  const [target, setTarget] = useState<Category | null>(null);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const db = await getDb();
    const [r, g] = await Promise.all([listRules(db), listCategories(db)]);
    setRules(r);
    setGroups(g);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = async () => {
    if (keyword.trim() === '' || !target) {
      setMessage('Type a keyword and choose a group');
      return;
    }
    const db = await getDb();
    await addRule(db, field, keyword, target.id);
    const moved = await recategorizeUncategorized(db);
    setMessage(
      moved > 0
        ? `Rule added. ${moved} payment${moved === 1 ? '' : 's'} moved into groups.`
        : 'Rule added. It will apply to new payments and ones not in a group yet.',
    );
    setKeyword('');
    await reload();
    emitDataChanged();
  };

  const remove = async (rule: RuleRow) => {
    await deleteRule(await getDb(), rule.id);
    await reload();
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q === '' ? rules : rules.filter(r => r.pattern.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q));
  }, [rules, search]);

  const mine = shown.filter(r => r.priority >= USER_RULE_PRIORITY);
  const builtIn = shown.filter(r => r.priority < USER_RULE_PRIORITY);
  const data: (RuleRow | { heading: string })[] = [
    { heading: `Your rules (${mine.length})` },
    ...mine,
    { heading: `Built-in rules (${builtIn.length})` },
    ...builtIn,
  ];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <ScreenHeader title="Auto-sort rules" onBack={onBack} />
      <FlatList
        data={data}
        keyExtractor={(item, i) => ('heading' in item ? `h-${item.heading.slice(0, 4)}-${i}` : String(item.id))}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={[styles.intro, { color: c.textMuted }]}>
              When a payment matches a keyword, it goes into the group you pick, automatically. Your
              rules win over built-in ones. Short keywords (3 letters or fewer) must match a whole word.
            </Text>
            <Segmented
              options={[
                { key: 'PAYEE_NAME', label: 'Name' },
                { key: 'VPA', label: 'UPI ID' },
                { key: 'REMARK', label: 'Note' },
              ]}
              value={field}
              onChange={setField}
            />
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              placeholder={field === 'PAYEE_NAME' ? 'e.g. dominos' : field === 'VPA' ? 'e.g. rapido' : 'e.g. chai'}
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
            />
            <Pressable
              onPress={() => setPicking(true)}
              style={[styles.picker, { backgroundColor: c.card, borderColor: c.border }]}
              accessibilityLabel="Choose group">
              <Dot colour={target?.colour ?? null} size={14} />
              <Text style={[styles.pickerText, { color: target ? c.text : c.textMuted }]}>
                {target ? target.name : 'Choose a group'}
              </Text>
              <Text style={[styles.chevron, { color: c.textMuted }]}>›</Text>
            </Pressable>
            <Button label="Add rule" onPress={add} />
            {message && <Text style={[styles.message, { color: c.text, backgroundColor: c.cardAlt }]}>{message}</Text>}
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search rules"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
            />
          </View>
        }
        renderItem={({ item }) =>
          'heading' in item ? (
            <Text style={[styles.heading, { color: c.text }]}>{item.heading}</Text>
          ) : (
            <View style={[styles.rule, { backgroundColor: c.card }]}>
              <View style={styles.flex}>
                <Text style={[styles.rulePattern, { color: c.text }]} numberOfLines={1}>
                  {FIELD_LABEL[item.field]} “{item.pattern}”
                </Text>
                <Text style={[styles.ruleGroup, { color: c.textMuted }]} numberOfLines={1}>
                  → {item.categoryName}
                </Text>
              </View>
              <Pressable onPress={() => remove(item)} accessibilityLabel={`Delete rule ${item.pattern}`} hitSlop={8}>
                <Text style={[styles.delete, { color: c.debit }]}>Delete</Text>
              </Pressable>
            </View>
          )
        }
      />
      <GroupPickerModal
        visible={picking}
        title="Put matching payments in"
        categories={groups}
        selectedId={target?.id}
        onClose={() => setPicking(false)}
        onPick={cat => {
          setTarget(cat);
          setPicking(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.xl * 2 },
  form: { padding: space.lg, gap: space.md },
  intro: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, fontSize: 16 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
  },
  pickerText: { flex: 1, fontSize: 16, fontWeight: '600' },
  chevron: { fontSize: 22 },
  message: { fontSize: 14, borderRadius: radius.sm, padding: space.md, overflow: 'hidden' },
  heading: { fontSize: 16, fontWeight: '800', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.md + 2,
    borderRadius: radius.md,
  },
  rulePattern: { fontSize: 15, fontWeight: '700' },
  ruleGroup: { fontSize: 13, marginTop: 2 },
  delete: { fontSize: 13, fontWeight: '700' },
});
