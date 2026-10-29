// Tap a payment to put it in a group. Optionally applies to every payment to the same payee.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { Category } from '../../data/categoriesRepo';
import type { TxnRow } from '../../data/transactionsRepo';
import { formatRupees } from '../format';
import { space, usePalette } from '../theme';
import { Button } from './Button';
import { GroupPickerModal } from './GroupPickerModal';

interface Props {
  txn: TxnRow | null;
  categories: Category[];
  onClose: () => void;
  onChoose: (txn: TxnRow, categoryId: number, applyToPayee: boolean) => void;
  onClear: (txn: TxnRow) => void;
  onAlwaysAsk: (payeeId: number, value: boolean) => void;
}

export function PaymentGroupSheet({ txn, categories, onClose, onChoose, onClear, onAlwaysAsk }: Props) {
  const c = usePalette();
  const [applyToPayee, setApplyToPayee] = useState(true);
  const [alwaysAsk, setAlwaysAsk] = useState(false);

  useEffect(() => {
    if (txn) {
      setApplyToPayee(true);
      setAlwaysAsk(txn.payeeAlwaysAsk);
    }
  }, [txn]);

  const hasPayee = txn?.payeeId != null;
  const sign = txn?.direction === 'CREDIT' ? '+' : '−';

  return (
    <GroupPickerModal
      visible={txn != null}
      title={txn ? `${txn.payeeName ?? 'Unknown payee'}` : ''}
      subtitle={txn ? `${sign}${formatRupees(txn.amountPaise)} · choose a group` : undefined}
      categories={categories}
      selectedId={txn?.categoryId}
      onClose={onClose}
      onPick={cat => txn && onChoose(txn, cat.id, hasPayee && applyToPayee && !alwaysAsk)}
      footer={
        txn?.categoryId != null ? (
          <View style={styles.footer}>
            <Button label="Remove from group" kind="secondary" onPress={() => onClear(txn)} />
          </View>
        ) : undefined
      }>
      {hasPayee && (
        <View style={styles.options}>
          <View style={styles.option}>
            <Text style={[styles.optionText, { color: c.text }]}>
              Same group for all payments to {txn?.payeeName ?? 'this payee'}
            </Text>
            <Switch value={applyToPayee && !alwaysAsk} onValueChange={setApplyToPayee} disabled={alwaysAsk} />
          </View>
          <View style={styles.option}>
            <Text style={[styles.optionText, { color: c.text }]}>
              Always ask for this payee
              <Text style={{ color: c.textMuted }}> (for people you pay for different things)</Text>
            </Text>
            <Switch
              value={alwaysAsk}
              onValueChange={value => {
                setAlwaysAsk(value);
                if (txn?.payeeId != null) {
                  onAlwaysAsk(txn.payeeId, value);
                }
              }}
            />
          </View>
        </View>
      )}
    </GroupPickerModal>
  );
}

const styles = StyleSheet.create({
  options: { gap: space.sm, marginBottom: space.xs },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600' },
  footer: { marginTop: space.md },
});
