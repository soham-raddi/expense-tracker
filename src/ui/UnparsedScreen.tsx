// Bank SMS that no parser could read. Shown in full so nothing is silently lost.

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../data/db';
import { unparsedList, type UnparsedRow } from '../data/transactionsRepo';
import { onDataChanged } from '../ingest/events';
import { EmptyState } from './components/EmptyState';
import { dateTimeLabel } from './format';
import { radius, space, usePalette } from './theme';

export function UnparsedScreen() {
  const c = usePalette();
  const [rows, setRows] = useState<UnparsedRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setRows(await unparsedList(await getDb()));
  }, []);

  useEffect(() => {
    reload();
    return onDataChanged(reload);
  }, [reload]);

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      data={rows}
      keyExtractor={r => String(r.id)}
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
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Unparsed messages</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Bank messages that look like payments but are in a format the app does not know yet.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="All clear"
          message="Every bank payment message so far was understood."
        />
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.cardTop}>
            <View style={[styles.chip, { backgroundColor: c.warningSoft }]}>
              <Text style={[styles.chipText, { color: c.warning }]}>{item.sender}</Text>
            </View>
            <Text style={[styles.date, { color: c.textMuted }]}>{dateTimeLabel(item.timestamp)}</Text>
          </View>
          <Text style={[styles.body, { color: c.text }]} selectable>
            {item.body}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xl * 2 },
  header: { padding: space.lg },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: space.xs, lineHeight: 20 },
  card: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  chip: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  chipText: { fontSize: 12, fontWeight: '700' },
  date: { fontSize: 12 },
  body: { fontSize: 14, lineHeight: 20 },
});
