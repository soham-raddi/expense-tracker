// Home: your payments for one month (or all time), as a day-by-day timeline or split by group,
// with filters and sorting.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { groupBreakdown, totalsOf, type GroupSlice } from '../../data/aggregate';
import { getDb } from '../../data/db';
import { listCategories, type Category } from '../../data/repos/categoriesRepo';
import { clearCategory, recategorizeUncategorized, setAlwaysAsk, setUserCategory } from '../../data/repos/categorizeRepo';
import { deleteTransaction } from '../../data/repos/dataRepo';
import { setPayeeCustomName } from '../../data/repos/payeesRepo';
import { setTransactionNote, transactionsBetween, type TxnRow } from '../../data/repos/transactionsRepo';
import { emitDataChanged, onDataChanged } from '../../lib/events';
import { formatRupees, groupByDay, modeLabel, monthBounds, monthOf, sameMonth, type DaySection, type MonthRef } from '../../lib/format';
import {
  applyFilters,
  isAmountSort,
  isDefault,
  narrowingCount,
  NO_FILTERS,
  SORT_LABEL,
  type TxnFilters,
} from '../../lib/txnFilter';
import { EmptyState } from '../components/EmptyState';
import { FilterSheet } from '../components/FilterSheet';
import { Dot, Segmented } from '../components/GroupBits';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { PaymentGroupSheet } from '../components/PaymentGroupSheet';
import { SummaryCard } from '../components/SummaryCard';
import { TransactionDetailSheet } from '../components/TransactionDetailSheet';
import { TransactionItem } from '../components/TransactionItem';
import { radius, space, usePalette } from '../theme';

type View_ = 'timeline' | 'groups';

interface Props {
  month: MonthRef;
  onMonthChange: (month: MonthRef) => void;
  onOpenSettings: () => void;
}

interface ActiveChip {
  key: string;
  label: string;
  clear: Partial<TxnFilters>;
}

export function HomeScreen({ month, onMonthChange, onOpenSettings }: Props) {
  const c = usePalette();
  const current = useMemo(() => monthOf(Date.now()), []);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<View_>('timeline');
  const [filters, setFilters] = useState<TxnFilters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [sheetTxn, setSheetTxn] = useState<TxnRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const allTime = filters.allTime;

  const reload = useCallback(async () => {
    const db = await getDb();
    const { start, end } = allTime ? { start: 0, end: Number.MAX_SAFE_INTEGER } : monthBounds(month);
    const [list, cats] = await Promise.all([transactionsBetween(db, start, end), listCategories(db)]);
    setRows(list);
    setCategories(cats);
    setLoaded(true);
  }, [month, allTime]);

  useEffect(() => {
    reload();
    return onDataChanged(reload);
  }, [reload]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const set = (patch: Partial<TxnFilters>) => setFilters(f => ({ ...f, ...patch }));

  // Totals for the whole month (or all time), and for just the payments that pass the filters.
  const totals = useMemo(() => totalsOf(rows), [rows]);
  const spentSlices = useMemo(() => groupBreakdown(rows, 'DEBIT'), [rows]);
  const receivedSlices = useMemo(() => groupBreakdown(rows, 'CREDIT'), [rows]);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const narrowed = narrowingCount(filters) > 0;
  const filteredTotals = useMemo(
    // A group you pick on purpose is counted even if it is normally left out of totals (own transfers).
    () => totalsOf(filtered.map(r => (filters.group ? { ...r, excluded: false } : r))),
    [filtered, filters.group],
  );
  const modes = useMemo(() => [...new Set(rows.map(r => r.mode))].sort(), [rows]);

  const sections: DaySection<TxnRow>[] = useMemo(() => {
    if (isAmountSort(filters.sort)) {
      const net = filtered.reduce((n, r) => n + (r.direction === 'CREDIT' ? r.amountPaise : -r.amountPaise), 0);
      return filtered.length === 0 ? [] : [{ key: 'all', title: SORT_LABEL[filters.sort], totalPaise: net, data: filtered }];
    }
    return groupByDay(filtered, Date.now());
  }, [filtered, filters.sort]);

  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (filters.direction !== 'ALL') {
      chips.push({ key: 'dir', label: filters.direction === 'DEBIT' ? 'Spent' : 'Received', clear: { direction: 'ALL' } });
    }
    if (filters.group) {
      const id = filters.group.id;
      chips.push({
        key: 'group',
        label: id == null ? 'No group yet' : categories.find(x => x.id === id)?.name ?? 'Group',
        clear: { group: null },
      });
    }
    if (filters.minPaise != null || filters.maxPaise != null) {
      const min = filters.minPaise, max = filters.maxPaise;
      const label =
        min != null && max != null
          ? `${formatRupees(min, false)}–${formatRupees(max, false)}`
          : min != null
            ? `${formatRupees(min, false)} or more`
            : `up to ${formatRupees(max ?? 0, false)}`;
      chips.push({ key: 'amount', label, clear: { minPaise: null, maxPaise: null } });
    }
    if (filters.mode) {
      chips.push({ key: 'mode', label: modeLabel(filters.mode), clear: { mode: null } });
    }
    if (filters.search.trim() !== '') {
      chips.push({ key: 'search', label: `“${filters.search.trim()}”`, clear: { search: '' } });
    }
    if (filters.sort !== NO_FILTERS.sort) {
      chips.push({ key: 'sort', label: SORT_LABEL[filters.sort], clear: { sort: NO_FILTERS.sort } });
    }
    if (filters.allTime) {
      chips.push({ key: 'time', label: 'All time', clear: { allTime: false } });
    }
    return chips;
  }, [filters, categories]);

  // Looked up from the loaded rows so the sheet updates when the payment changes (e.g. a rename).
  const detailTxn = useMemo(() => rows.find(r => r.id === detailId) ?? null, [rows, detailId]);

  const rename = async (txn: TxnRow, name: string | null) => {
    if (txn.payeeId == null) {
      return;
    }
    const db = await getDb();
    await setPayeeCustomName(db, txn.payeeId, name);
    await recategorizeUncategorized(db); // a rule may match the new name
    emitDataChanged();
  };

  const saveNote = async (txn: TxnRow, note: string | null) => {
    await setTransactionNote(await getDb(), txn.id, note);
    emitDataChanged();
  };

  const remove = async (txn: TxnRow) => {
    await deleteTransaction(await getDb(), txn);
    setDetailId(null);
    emitDataChanged();
  };

  const choose = async (txn: TxnRow, categoryId: number, applyToPayee: boolean) => {
    await setUserCategory(await getDb(), txn.id, categoryId, applyToPayee);
    setSheetTxn(null);
    emitDataChanged();
  };

  const openSlice = (slice: GroupSlice, direction: 'DEBIT' | 'CREDIT') => {
    set({ group: { id: slice.categoryId }, direction });
    setView('timeline');
  };

  const scopeCaption = allTime ? 'Spent, all time' : 'Spent this month';

  const header = (
    <View style={styles.header}>
      <Text style={[styles.appName, { color: c.textMuted }]}>Expense Tracker</Text>
      {allTime ? (
        <Pressable
          onPress={() => set({ allTime: false })}
          style={[styles.allTime, { backgroundColor: c.accentSoft }]}
          accessibilityLabel="Go back to a single month">
          <Text style={[styles.allTimeText, { color: c.accent }]}>All time · tap to pick a month</Text>
        </Pressable>
      ) : (
        <MonthSwitcher month={month} current={current} onChange={onMonthChange} />
      )}
      <View style={styles.summary}>
        <SummaryCard
          caption={scopeCaption}
          spentPaise={totals.spentPaise}
          receivedPaise={totals.receivedPaise}
          count={totals.count}
        />
      </View>
      <View style={styles.segmented}>
        <Segmented
          options={[
            { key: 'timeline', label: 'Timeline' },
            { key: 'groups', label: 'Groups' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'timeline' && (
        <>
          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setFilterOpen(true)}
              style={[styles.filterButton, { backgroundColor: c.card, borderColor: c.border }]}
              accessibilityLabel="Filter and sort">
              <Text style={[styles.filterButtonText, { color: c.text }]}>Filter and sort</Text>
              {narrowingCount(filters) > 0 && (
                <View style={[styles.badge, { backgroundColor: c.accent }]}>
                  <Text style={[styles.badgeText, { color: c.onAccent }]}>{narrowingCount(filters)}</Text>
                </View>
              )}
            </Pressable>
            {!isDefault(filters) && (
              <Pressable onPress={() => setFilters(NO_FILTERS)} accessibilityLabel="Reset filters" hitSlop={8}>
                <Text style={[styles.reset, { color: c.accent }]}>Reset</Text>
              </Pressable>
            )}
          </View>
          {activeChips.length > 0 && (
            <View style={styles.chipRow}>
              {activeChips.map(chip => (
                <Pressable
                  key={chip.key}
                  onPress={() => set(chip.clear)}
                  style={[styles.activeChip, { backgroundColor: c.accentSoft }]}
                  accessibilityLabel={`Remove filter ${chip.label}`}>
                  <Text style={[styles.activeChipText, { color: c.accent }]}>{chip.label}  ✕</Text>
                </Pressable>
              ))}
            </View>
          )}
          {narrowed && (
            <View style={[styles.result, { backgroundColor: c.card, borderColor: c.border }]} accessibilityLabel="Totals for the filtered payments">
              <Text style={[styles.resultCount, { color: c.textMuted }]}>
                {filtered.length} payment{filtered.length === 1 ? '' : 's'} match
              </Text>
              <View style={styles.resultTotals}>
                <View style={styles.resultCell}>
                  <Text style={[styles.resultLabel, { color: c.textMuted }]}>Spent</Text>
                  <Text style={[styles.resultValue, { color: c.text }]}>{formatRupees(filteredTotals.spentPaise)}</Text>
                </View>
                <View style={styles.resultCell}>
                  <Text style={[styles.resultLabel, { color: c.textMuted }]}>Received</Text>
                  <Text style={[styles.resultValue, { color: c.credit }]}>{formatRupees(filteredTotals.receivedPaise)}</Text>
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );

  const detail = (
    <TransactionDetailSheet
      txn={detailTxn}
      onClose={() => setDetailId(null)}
      onChangeGroup={txn => {
        setDetailId(null);
        setSheetTxn(txn);
      }}
      onRename={rename}
      onSaveNote={saveNote}
      onDelete={remove}
    />
  );

  const sheet = (
    <PaymentGroupSheet
      txn={sheetTxn}
      categories={categories}
      onClose={() => setSheetTxn(null)}
      onChoose={choose}
      onClear={async txn => {
        await clearCategory(await getDb(), txn.id);
        setSheetTxn(null);
        emitDataChanged();
      }}
      onAlwaysAsk={async (payeeId, value) => {
        await setAlwaysAsk(await getDb(), payeeId, value);
        emitDataChanged();
      }}
    />
  );

  const filterSheet = (
    <FilterSheet
      visible={filterOpen}
      filters={filters}
      categories={categories}
      modes={modes}
      resultCount={filtered.length}
      onChange={setFilters}
      onClose={() => setFilterOpen(false)}
    />
  );

  const empty =
    loaded && rows.length === 0 ? (
      sameMonth(month, current) || allTime ? (
        <EmptyState
          title="No transactions yet"
          message="Import your bank SMS from Settings. New bank SMS will appear here by themselves.">
          <Text style={[styles.link, { color: c.accent }]} onPress={onOpenSettings}>
            Open Settings
          </Text>
        </EmptyState>
      ) : (
        <EmptyState title="Nothing this month" message="No transactions were recorded in this month." />
      )
    ) : undefined;

  const sliceCard = (s: GroupSlice, direction: 'DEBIT' | 'CREDIT') => (
    <Pressable
      key={`${direction}-${String(s.categoryId)}`}
      onPress={() => openSlice(s, direction)}
      style={[styles.slice, { backgroundColor: c.card }]}
      accessibilityLabel={`${s.name}, ${formatRupees(s.totalPaise)}`}>
      <View style={styles.sliceTop}>
        <Dot colour={s.colour} size={14} />
        <Text style={[styles.sliceName, { color: c.text }]} numberOfLines={1}>
          {s.name}
        </Text>
        <Text style={[styles.sliceAmount, { color: direction === 'CREDIT' ? c.credit : c.text }]}>
          {formatRupees(s.totalPaise, false)}
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: c.cardAlt }]}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.max(2, Math.round(s.share * 100))}%`, backgroundColor: s.colour ?? c.textMuted },
          ]}
        />
      </View>
      <Text style={[styles.sliceMeta, { color: c.textMuted }]}>
        {Math.round(s.share * 100)}% · {s.count} payment{s.count === 1 ? '' : 's'}
      </Text>
    </Pressable>
  );

  if (view === 'groups') {
    return (
      <>
        <ScrollView
          style={{ backgroundColor: c.background }}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}>
          {header}
          {loaded && spentSlices.length === 0 && receivedSlices.length === 0 && (empty ?? <EmptyState title="Nothing here" message="No money moved in this period." />)}
          {spentSlices.length > 0 && (
            <>
              <Text style={[styles.sliceHeading, { color: c.text }]}>Money spent</Text>
              <View style={styles.sliceList}>{spentSlices.map(s => sliceCard(s, 'DEBIT'))}</View>
            </>
          )}
          {receivedSlices.length > 0 && (
            <>
              <Text style={[styles.sliceHeading, { color: c.text }]}>Money received</Text>
              <Text style={[styles.sliceHint, { color: c.textMuted }]}>
                Where your money came from. Put a payer in Friends or Income from their payments.
              </Text>
              <View style={styles.sliceList}>{receivedSlices.map(s => sliceCard(s, 'CREDIT'))}</View>
            </>
          )}
        </ScrollView>
        {sheet}
        {detail}
      </>
    );
  }

  return (
    <>
      <SectionList
        style={{ backgroundColor: c.background }}
        sections={sections}
        keyExtractor={r => String(r.id)}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          loaded && rows.length > 0 ? (
            <EmptyState title="No payments match" message="Try removing a filter, or switch to All time.">
              <Text style={[styles.link, { color: c.accent }]} onPress={() => setFilters(NO_FILTERS)}>
                Reset filters
              </Text>
            </EmptyState>
          ) : (
            empty
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={[styles.dayTitle, { color: c.textMuted }]}>{section.title}</Text>
            <Text style={[styles.dayTotal, { color: c.textMuted }]}>
              {section.totalPaise < 0 ? 'Spent ' : 'Net '}
              {formatRupees(Math.abs(section.totalPaise))}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={[
              styles.itemWrap,
              index === 0 && styles.itemFirst,
              index === section.data.length - 1 && styles.itemLast,
              { backgroundColor: c.card },
            ]}>
            <TransactionItem txn={item} onPress={() => setDetailId(item.id)} />
            {index < section.data.length - 1 && <View style={[styles.divider, { backgroundColor: c.border }]} />}
          </View>
        )}
      />
      {sheet}
      {detail}
      {filterSheet}
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xl * 2 },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg },
  appName: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: space.md },
  summary: { marginTop: space.lg },
  segmented: { marginTop: space.lg },
  allTime: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm },
  allTimeText: { fontSize: 14, fontWeight: '800' },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 1,
  },
  filterButtonText: { fontSize: 14, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  reset: { fontSize: 14, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  activeChip: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm - 2 },
  activeChipText: { fontSize: 13, fontWeight: '700' },
  result: { marginTop: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  resultCount: { fontSize: 13, fontWeight: '700' },
  resultTotals: { flexDirection: 'row', gap: space.xl, marginTop: space.sm },
  resultCell: { flex: 1 },
  resultLabel: { fontSize: 12, fontWeight: '600' },
  resultValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg + space.sm,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  dayTitle: { fontSize: 13, fontWeight: '700' },
  dayTotal: { fontSize: 12, fontWeight: '600' },
  itemWrap: { marginHorizontal: space.lg, overflow: 'hidden' },
  itemFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  itemLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 44 + space.lg + space.md },
  link: { marginTop: space.lg, fontSize: 15, fontWeight: '700' },
  sliceHeading: { fontSize: 18, fontWeight: '800', paddingHorizontal: space.lg, marginTop: space.xl },
  sliceHint: { fontSize: 13, lineHeight: 18, paddingHorizontal: space.lg, marginTop: space.xs },
  sliceList: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  slice: { borderRadius: radius.md, padding: space.lg },
  sliceTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sliceName: { flex: 1, fontSize: 16, fontWeight: '700' },
  sliceAmount: { fontSize: 16, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, marginTop: space.md, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  sliceMeta: { fontSize: 12, marginTop: space.sm },
});
