// Filters and sorting for the payments list. Changes apply to the list straight away.

import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Category } from '../../data/repos/categoriesRepo';
import { formatRupees, modeLabel } from '../../lib/format';
import {
  NO_FILTERS,
  parseRupeesInput,
  SORT_LABEL,
  type DirectionFilter,
  type SortKey,
  type TxnFilters,
} from '../../lib/txnFilter';
import { radius, space, usePalette } from '../theme';
import { Button } from './Button';
import { Dot, Segmented } from './GroupBits';

interface Props {
  visible: boolean;
  filters: TxnFilters;
  categories: Category[];
  modes: string[]; // the payment types that appear in the current data
  resultCount: number;
  onChange: (filters: TxnFilters) => void;
  onClose: () => void;
}

const QUICK_MINIMUMS = [10000, 50000, 100000, 500000, 1000000]; // paise: 100, 500, 1,000, 5,000, 10,000
const SORTS: SortKey[] = ['NEWEST', 'OLDEST', 'LARGEST', 'SMALLEST'];

function Chip({ label, selected, onPress, colour }: { label: string; selected: boolean; onPress: () => void; colour?: string }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { backgroundColor: selected ? c.accent : c.cardAlt, borderColor: selected ? c.accent : c.border },
      ]}>
      {colour ? <Dot colour={colour} size={9} /> : null}
      <Text style={[styles.chipText, { color: selected ? c.onAccent : c.text }]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

export function FilterSheet({ visible, filters, categories, modes, resultCount, onChange, onClose }: Props) {
  const c = usePalette();
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');

  // Text boxes follow the filters when the sheet opens or the filters are reset.
  useEffect(() => {
    if (visible) {
      setMinText(filters.minPaise == null ? '' : String(filters.minPaise / 100));
      setMaxText(filters.maxPaise == null ? '' : String(filters.maxPaise / 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, filters.minPaise === null && filters.maxPaise === null]);

  const set = (patch: Partial<TxnFilters>) => onChange({ ...filters, ...patch });

  const setMin = (text: string) => {
    setMinText(text);
    set({ minPaise: parseRupeesInput(text) });
  };
  const setMax = (text: string) => {
    setMaxText(text);
    set({ maxPaise: parseRupeesInput(text) });
  };

  const groupId = filters.group ? filters.group.id : undefined;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* The padding keeps the sheet above the keyboard; Android does not resize modals itself. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <Text style={[styles.title, { color: c.text }]}>Filter and sort</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Section title="Show">
              <Segmented<DirectionFilter>
                options={[
                  { key: 'ALL', label: 'All' },
                  { key: 'DEBIT', label: 'Spent' },
                  { key: 'CREDIT', label: 'Received' },
                ]}
                value={filters.direction}
                onChange={direction => set({ direction })}
              />
            </Section>

            <Section title="Group">
              <View style={styles.chips}>
                <Chip label="Any" selected={filters.group == null} onPress={() => set({ group: null })} />
                {categories.map(cat => (
                  <Chip
                    key={cat.id}
                    label={cat.name}
                    colour={cat.colour}
                    selected={groupId === cat.id}
                    onPress={() => set({ group: { id: cat.id } })}
                  />
                ))}
                <Chip label="No group yet" selected={groupId === null} onPress={() => set({ group: { id: null } })} />
              </View>
            </Section>

            <Section title="Amount (₹)">
              <View style={styles.range}>
                <TextInput
                  value={minText}
                  onChangeText={setMin}
                  placeholder="At least"
                  placeholderTextColor={c.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.input, { color: c.text, backgroundColor: c.cardAlt, borderColor: c.border }]}
                />
                <Text style={[styles.to, { color: c.textMuted }]}>to</Text>
                <TextInput
                  value={maxText}
                  onChangeText={setMax}
                  placeholder="At most"
                  placeholderTextColor={c.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.input, { color: c.text, backgroundColor: c.cardAlt, borderColor: c.border }]}
                />
              </View>
              <View style={styles.chips}>
                {QUICK_MINIMUMS.map(paise => (
                  <Chip
                    key={paise}
                    label={`${formatRupees(paise, false)}+`}
                    selected={filters.minPaise === paise && filters.maxPaise == null}
                    onPress={() => {
                      setMinText(String(paise / 100));
                      setMaxText('');
                      set({ minPaise: paise, maxPaise: null });
                    }}
                  />
                ))}
              </View>
            </Section>

            {modes.length > 1 && (
              <Section title="Type">
                <View style={styles.chips}>
                  <Chip label="Any" selected={filters.mode == null} onPress={() => set({ mode: null })} />
                  {modes.map(mode => (
                    <Chip
                      key={mode}
                      label={modeLabel(mode)}
                      selected={filters.mode === mode}
                      onPress={() => set({ mode })}
                    />
                  ))}
                </View>
              </Section>
            )}

            <Section title="Search names and notes">
              <TextInput
                value={filters.search}
                onChangeText={search => set({ search })}
                placeholder="e.g. priya, rent, dinner"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.fullInput, { color: c.text, backgroundColor: c.cardAlt, borderColor: c.border }]}
              />
            </Section>

            <Section title="Sort">
              <View style={styles.chips}>
                {SORTS.map(sort => (
                  <Chip key={sort} label={SORT_LABEL[sort]} selected={filters.sort === sort} onPress={() => set({ sort })} />
                ))}
              </View>
            </Section>

            <Section title="Time">
              <Segmented<'MONTH' | 'ALL'>
                options={[
                  { key: 'MONTH', label: 'This month' },
                  { key: 'ALL', label: 'All time' },
                ]}
                value={filters.allTime ? 'ALL' : 'MONTH'}
                onChange={scope => set({ allTime: scope === 'ALL' })}
              />
            </Section>
          </ScrollView>

          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                label="Reset"
                kind="secondary"
                onPress={() => {
                  setMinText('');
                  setMaxText('');
                  onChange({ ...NO_FILTERS });
                }}
              />
            </View>
            <View style={styles.flexWide}>
              <Button label={`Show ${resultCount} payment${resultCount === 1 ? '' : 's'}`} onPress={onClose} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexWide: { flex: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: space.sm, marginBottom: space.md },
  title: { fontSize: 20, fontWeight: '800', marginBottom: space.xs },
  section: { marginTop: space.lg, gap: space.sm },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: space.sm - 1,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  range: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  to: { fontSize: 13, fontWeight: '600' },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 16,
  },
  fullInput: { flex: 0 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
});
