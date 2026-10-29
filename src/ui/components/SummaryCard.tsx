import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatRupees } from '../format';
import { radius, space, usePalette } from '../theme';

interface Props {
  spentPaise: number;
  receivedPaise: number;
  count: number;
}

export function SummaryCard({ spentPaise, receivedPaise, count }: Props) {
  const c = usePalette();
  const net = receivedPaise - spentPaise;
  return (
    <View style={[styles.card, { backgroundColor: c.accent }]}>
      <Text style={[styles.caption, { color: c.onAccent }]}>Spent this month</Text>
      <Text style={[styles.big, { color: c.onAccent }]} accessibilityLabel={`Spent ${formatRupees(spentPaise)}`}>
        {formatRupees(spentPaise, false)}
      </Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.onAccent }]}>Received</Text>
          <Text style={[styles.statValue, { color: c.onAccent }]}>{formatRupees(receivedPaise, false)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.onAccent }]}>Net</Text>
          <Text style={[styles.statValue, { color: c.onAccent }]}>
            {net > 0 ? '+' : ''}
            {formatRupees(net, false)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.onAccent }]}>Payments</Text>
          <Text style={[styles.statValue, { color: c.onAccent }]}>{count}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg + 2 },
  caption: { fontSize: 13, fontWeight: '600', opacity: 0.85 },
  big: { fontSize: 38, fontWeight: '800', marginTop: space.xs, marginBottom: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.md, paddingVertical: space.sm + 2, paddingHorizontal: space.md },
  statLabel: { fontSize: 11, fontWeight: '600', opacity: 0.85 },
  statValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
});
