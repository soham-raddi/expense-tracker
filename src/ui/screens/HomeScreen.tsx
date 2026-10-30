// Home: spending for one month, as a day-by-day timeline or split into your groups.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { totalsOf } from '../../data/aggregate';
import { listCategories, type Category } from '../../data/repos/categoriesRepo';
import { clearCategory, recategorizeUncategorized, setAlwaysAsk, setUserCategory } from '../../data/repos/categorizeRepo';
import { setPayeeCustomName } from '../../data/repos/payeesRepo';
import { getDb } from '../../data/db';
import { transactionsBetween, type TxnRow } from '../../data/repos/transactionsRepo';
import { groupBreakdown } from '../../data/aggregate';
import { emitDataChanged, onDataChanged } from '../../lib/events';
import { Dot, Segmented } from '../components/GroupBits';
import { EmptyState } from '../components/EmptyState';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { PaymentGroupSheet } from '../components/PaymentGroupSheet';
import { TransactionDetailSheet } from '../components/TransactionDetailSheet';
import { SummaryCard } from '../components/SummaryCard';
import { TransactionItem } from '../components/TransactionItem';
import { formatRupees, groupByDay, monthBounds, monthOf, sameMonth, type MonthRef } from '../../lib/format';
import { radius, space, usePalette } from '../theme';

type View_ = 'timeline' | 'groups';
type GroupFilter = { id: number | null; name: string } | null; // id null = payments with no group

interface Props {
  month: MonthRef;
  onMonthChange: (month: MonthRef) => void;
  onOpenSettings: () => void;
}

export function HomeScreen({ month, onMonthChange, onOpenSettings }: Props) {
  const c = usePalette();
  const current = useMemo(() => monthOf(Date.now()), []);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<View_>('timeline');
  const [filter, setFilter] = useState<GroupFilter>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [sheetTxn, setSheetTxn] = useState<TxnRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const { start, end } = monthBounds(month);
    const db = await getDb();
    const [list, cats] = await Promise.all([transactionsBetween(db, start, end), listCategories(db)]);
    setRows(list);
    setCategories(cats);
    setLoaded(true);
  }, [month]);

  useEffect(() => {
    reload();
    return onDataChanged(reload);
  }, [reload]);

  // A filter from another month would be confusing; start fresh when the month changes.
  useEffect(() => {
    setFilter(null);
  }, [month]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const totals = useMemo(() => totalsOf(rows), [rows]);
  const slices = useMemo(() => groupBreakdown(rows), [rows]);
  const visibleRows = useMemo(
    () => (filter ? rows.filter(r => r.categoryId === filter.id) : rows),
    [rows, filter],
  );
  const sections = useMemo(() => groupByDay(visibleRows, Date.now()), [visibleRows]);

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

  const choose = async (txn: TxnRow, categoryId: number, applyToPayee: boolean) => {
    await setUserCategory(await getDb(), txn.id, categoryId, applyToPayee);
    setSheetTxn(null);
    emitDataChanged();
  };

  const header = (
    <View style={styles.header}>
      <Text style={[styles.appName, { color: c.textMuted }]}>Expense Tracker</Text>
      <MonthSwitcher month={month} current={current} onChange={onMonthChange} />
      <View style={styles.summary}>
        <SummaryCard spentPaise={totals.spentPaise} receivedPaise={totals.receivedPaise} count={totals.count} />
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
      {filter && (
        <Pressable
          onPress={() => setFilter(null)}
          style={[styles.filterChip, { backgroundColor: c.accentSoft }]}
          accessibilityLabel="Clear group filter">
          <Text style={[styles.filterText, { color: c.accent }]}>{filter.name}  ✕</Text>
        </Pressable>
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

  const empty =
    loaded && rows.length === 0 ? (
      sameMonth(month, current) ? (
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

  if (view === 'groups') {
    return (
      <>
        <ScrollView
          style={{ backgroundColor: c.background }}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}>
          {header}
          {slices.length === 0 && (loaded ? empty ?? <EmptyState title="No spending" message="Nothing was spent this month." /> : null)}
          <View style={styles.sliceList}>
            {slices.map(s => (
              <Pressable
                key={String(s.categoryId)}
                onPress={() => {
                  setFilter({ id: s.categoryId, name: s.name });
                  setView('timeline');
                }}
                style={[styles.slice, { backgroundColor: c.card }]}
                accessibilityLabel={`${s.name}, ${formatRupees(s.spentPaise)}`}>
                <View style={styles.sliceTop}>
                  <Dot colour={s.colour} size={14} />
                  <Text style={[styles.sliceName, { color: c.text }]} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={[styles.sliceAmount, { color: c.text }]}>{formatRupees(s.spentPaise, false)}</Text>
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
            ))}
          </View>
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
          filter && rows.length > 0 ? (
            <EmptyState title="No payments here" message="Nothing in this group for this month." />
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
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xl * 2 },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg },
  appName: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: space.md },
  summary: { marginTop: space.lg },
  segmented: { marginTop: space.lg },
  filterChip: {
    alignSelf: 'flex-start',
    marginTop: space.md,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm - 2,
  },
  filterText: { fontSize: 13, fontWeight: '700' },
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
  sliceList: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  slice: { borderRadius: radius.md, padding: space.lg },
  sliceTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sliceName: { flex: 1, fontSize: 16, fontWeight: '700' },
  sliceAmount: { fontSize: 16, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, marginTop: space.md, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  sliceMeta: { fontSize: 12, marginTop: space.sm },
});
