import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TxnRow } from '../../data/transactionsRepo';
import { formatRupees, initials, modeLabel, timeLabel } from '../format';
import { radius, space, usePalette } from '../theme';
import { GroupChip } from './GroupBits';

export function TransactionItem({ txn, onPress }: { txn: TxnRow; onPress: () => void }) {
  const c = usePalette();
  const isDebit = txn.direction === 'DEBIT';
  const time = timeLabel(txn.timestamp);
  const meta = [modeLabel(txn.mode), time, txn.maskedAccount].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${txn.payeeName ?? 'Payment'}, choose group`}
      style={({ pressed }) => [styles.row, { backgroundColor: c.card }, pressed && styles.pressed]}>
      <View style={[styles.avatar, { backgroundColor: isDebit ? c.debitSoft : c.creditSoft }]}>
        <Text style={[styles.avatarText, { color: isDebit ? c.debit : c.credit }]}>
          {initials(txn.payeeName)}
        </Text>
      </View>
      <View style={styles.middle}>
        <Text style={[styles.payee, { color: c.text }]} numberOfLines={1}>
          {txn.payeeName ?? 'Unknown payee'}
        </Text>
        <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
        <GroupChip name={txn.categoryName} colour={txn.categoryColour} />
      </View>
      <Text style={[styles.amount, { color: isDebit ? c.text : c.credit }]}>
        {isDebit ? '−' : '+'}
        {formatRupees(txn.amountPaise)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  middle: { flex: 1, marginHorizontal: space.md },
  payee: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
