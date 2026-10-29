// All months at a glance: a six-month trend and every month's totals.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { fillMonths, monthlyTotals, type MonthTotals } from '../../data/aggregate';
import { getDb } from '../../data/db';
import { allTransactionsLite } from '../../data/repos/transactionsRepo';
import { onDataChanged } from '../../lib/events';
import { EmptyState } from '../components/EmptyState';
import { formatRupees, monthLabel, monthOf, type MonthRef } from '../../lib/format';
import { radius, space, usePalette } from '../theme';

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_HEIGHT = 110;

export function MonthsScreen({ onPickMonth }: { onPickMonth: (month: MonthRef) => void }) {
  const c = usePalette();
  const [totals, setTotals] = useState<MonthTotals[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    setTotals(monthlyTotals(await allTransactionsLite(await getDb())));
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    return onDataChanged(reload);
  }, [reload]);

  const trend = useMemo(() => fillMonths(totals, monthOf(Date.now()), 6), [totals]);
  const maxTrend = Math.max(1, ...trend.map(t => t.spentPaise));
  const maxAll = Math.max(1, ...totals.map(t => t.spentPaise));

  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: c.text }]}>Months</Text>
      <View style={[styles.chart, { backgroundColor: c.card }]}>
        <Text style={[styles.chartTitle, { color: c.textMuted }]}>Spending, last 6 months</Text>
        <View style={styles.bars}>
          {trend.map(t => (
            <Pressable key={`${t.month.year}-${t.month.month}`} style={styles.barCol} onPress={() => onPickMonth(t.month)}>
              <Text style={[styles.barValue, { color: c.textMuted }]} numberOfLines={1}>
                {t.spentPaise > 0 ? formatRupees(t.spentPaise, false) : ''}
              </Text>
              <View style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(t.spentPaise > 0 ? 6 : 2, (t.spentPaise / maxTrend) * CHART_HEIGHT),
                      backgroundColor: t.spentPaise > 0 ? c.accent : c.border,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, { color: c.textMuted }]}>{SHORT[t.month.month]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {totals.length > 0 && <Text style={[styles.sectionTitle, { color: c.text }]}>Every month</Text>}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      data={totals}
      keyExtractor={t => `${t.month.year}-${t.month.month}`}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={c.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await reload();
            setRefreshing(false);
          }}
        />
      }
      ListEmptyComponent={
        loaded ? <EmptyState title="No months yet" message="Months appear here once you have transactions." /> : undefined
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onPickMonth(item.month)}
          style={[styles.row, { backgroundColor: c.card }]}
          accessibilityLabel={`${monthLabel(item.month)}, spent ${formatRupees(item.spentPaise)}`}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowMonth, { color: c.text }]}>{monthLabel(item.month)}</Text>
            <Text style={[styles.rowSpent, { color: c.text }]}>{formatRupees(item.spentPaise)}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: c.cardAlt }]}>
            <View
              style={[styles.fill, { width: `${Math.max(1, Math.round((item.spentPaise / maxAll) * 100))}%`, backgroundColor: c.accent }]}
            />
          </View>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Received {formatRupees(item.receivedPaise, false)} · {item.count} payment{item.count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xl * 2 },
  header: { padding: space.lg },
  title: { fontSize: 24, fontWeight: '800', marginBottom: space.lg },
  chart: { borderRadius: radius.lg, padding: space.lg },
  chartTitle: { fontSize: 13, fontWeight: '600' },
  bars: { flexDirection: 'row', marginTop: space.lg, gap: space.sm },
  barCol: { flex: 1, alignItems: 'center' },
  barValue: { fontSize: 10, fontWeight: '600', height: 14 },
  barSlot: { height: CHART_HEIGHT, justifyContent: 'flex-end', alignSelf: 'stretch', alignItems: 'center' },
  bar: { width: '70%', borderRadius: 6 },
  barLabel: { fontSize: 12, fontWeight: '600', marginTop: space.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: space.xl },
  row: { marginHorizontal: space.lg, marginBottom: space.md, borderRadius: radius.md, padding: space.lg },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rowMonth: { fontSize: 16, fontWeight: '700' },
  rowSpent: { fontSize: 16, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, marginTop: space.md, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  rowMeta: { fontSize: 12, marginTop: space.sm },
});
