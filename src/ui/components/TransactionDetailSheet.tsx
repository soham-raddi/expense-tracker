// Everything about one payment: the original message, your name for the payee, and its group.
// It shows whatever the payment was imported from (an SMS now, a statement row later).

import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TxnRow } from '../../data/repos/transactionsRepo';
import { dateTimeLabel, formatRupees, initials, modeLabel } from '../../lib/format';
import { cleanCustomName, cleanNote } from '../../lib/names';
import { radius, space, usePalette } from '../theme';
import { Button } from './Button';
import { GroupChip } from './GroupBits';

interface Props {
  txn: TxnRow | null;
  onClose: () => void;
  onChangeGroup: (txn: TxnRow) => void;
  onRename: (txn: TxnRow, name: string | null) => void;
  onSaveNote: (txn: TxnRow, note: string | null) => void;
  onDelete: (txn: TxnRow) => void;
}

const SOURCE_LABEL: Record<TxnRow['source'], string> = {
  SMS: 'Bank SMS',
  STATEMENT: 'Bank statement',
  BOTH: 'Bank SMS and statement',
};

export function TransactionDetailSheet({ txn, onClose, onChangeGroup, onRename, onSaveNote, onDelete }: Props) {
  const c = usePalette();
  const [draft, setDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const noteY = useRef(0);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const renameY = useRef(0);

  useEffect(() => {
    setDraft(txn?.payeeCustomName ?? '');
  }, [txn?.id, txn?.payeeCustomName]);

  useEffect(() => {
    setNoteDraft(txn?.note ?? '');
  }, [txn?.id, txn?.note]);

  const isDebit = txn?.direction === 'DEBIT';
  const changed = (cleanCustomName(draft) ?? '') !== (txn?.payeeCustomName ?? '');

  const noteChanged = (cleanNote(noteDraft) ?? '') !== (txn?.note ?? '');

  const saveNote = () => {
    if (txn && noteChanged) {
      onSaveNote(txn, cleanNote(noteDraft));
    }
  };

  const save = () => {
    if (txn && changed) {
      onRename(txn, cleanCustomName(draft));
    }
  };

  const confirmDelete = () => {
    if (!txn) {
      return;
    }
    Alert.alert(
      'Delete this payment?',
      'It is removed from this phone for good, along with its saved message. It will not come back when you import again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(txn) },
      ],
    );
  };

  // The keyboard covers the lower part of the sheet; bring the box being edited into view.
  const showRename = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: renameY.current, animated: true }), 300);
  };
  const showNote = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: noteY.current, animated: true }), 300);
  };

  const rows: [string, string | null][] = txn
    ? [
        ['Date', dateTimeLabel(txn.timestamp)],
        ['Type', modeLabel(txn.mode)],
        ['Account', txn.maskedAccount],
        ['Reference', txn.upiRef],
        ['Balance after', txn.balancePaise == null ? null : formatRupees(txn.balancePaise)],
        ['Source', SOURCE_LABEL[txn.source]],
      ]
    : [];

  return (
    <Modal visible={txn != null} transparent animationType="slide" onRequestClose={onClose}>
      {/* The padding keeps the sheet above the keyboard; Android does not resize modals itself. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          {txn && (
            <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <View style={[styles.avatar, { backgroundColor: isDebit ? c.debitSoft : c.creditSoft }]}>
                  <Text style={[styles.avatarText, { color: isDebit ? c.debit : c.credit }]}>
                    {initials(txn.payeeName)}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
                    {txn.payeeName ?? 'Unknown payee'}
                  </Text>
                  {txn.payeeCustomName && txn.payeeOriginalName ? (
                    <Text style={[styles.sub, { color: c.textMuted }]} numberOfLines={2}>
                      Bank shows: {txn.payeeOriginalName}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.amount, { color: isDebit ? c.text : c.credit }]}>
                {isDebit ? '−' : '+'}
                {formatRupees(txn.amountPaise)}
              </Text>

              <Pressable
                onPress={() => onChangeGroup(txn)}
                style={[styles.groupRow, { backgroundColor: c.cardAlt }]}
                accessibilityLabel="Change group">
                <View style={styles.flex}>
                  <Text style={[styles.label, { color: c.textMuted }]}>Group</Text>
                  <GroupChip name={txn.categoryName} colour={txn.categoryColour} />
                </View>
                <Text style={[styles.change, { color: c.accent }]}>Change ›</Text>
              </Pressable>

              <View style={[styles.table, { borderColor: c.border }]}>
                {rows
                  .filter(([, value]) => value != null)
                  .map(([label, value]) => (
                    <View key={label} style={styles.tableRow}>
                      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
                      <Text style={[styles.value, { color: c.text }]} selectable>
                        {value}
                      </Text>
                    </View>
                  ))}
              </View>

              <View style={styles.rename} onLayout={e => (noteY.current = e.nativeEvent.layout.y)}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Your note</Text>
                <TextInput
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="Add a note about this payment"
                  placeholderTextColor={c.textMuted}
                  maxLength={200}
                  multiline
                  onFocus={showNote}
                  style={[styles.input, styles.noteInput, { color: c.text, backgroundColor: c.cardAlt, borderColor: c.border }]}
                />
                <View style={styles.actions}>
                  <View style={styles.flex}>
                    <Button
                      label={cleanNote(noteDraft) ? 'Save note' : 'Remove note'}
                      onPress={saveNote}
                      disabled={!noteChanged}
                    />
                  </View>
                </View>
              </View>

              {txn.payeeId != null && (
                <View style={styles.rename} onLayout={e => (renameY.current = e.nativeEvent.layout.y)}>
                  <Text style={[styles.sectionTitle, { color: c.text }]}>Your name for this payee</Text>
                  <Text style={[styles.hint, { color: c.textMuted }]}>
                    Choose a name you will recognise when the bank shows something unclear, such as a
                    shop code or a name that is not the person you paid. It applies to every payment
                    to this payee.
                  </Text>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={txn.payeeOriginalName ?? 'A name you will recognise'}
                    placeholderTextColor={c.textMuted}
                    maxLength={40}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onFocus={showRename}
                    onSubmitEditing={save}
                    style={[styles.input, { color: c.text, backgroundColor: c.cardAlt, borderColor: c.border }]}
                  />
                  <View style={styles.actions}>
                    <View style={styles.flex}>
                      <Button
                        label={cleanCustomName(draft) ? 'Save name' : 'Use bank name'}
                        onPress={save}
                        disabled={!changed}
                      />
                    </View>
                  </View>
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: c.text }]}>{txn.source === 'STATEMENT' ? 'Statement row' : 'Original message'}</Text>
              <View style={[styles.message, { backgroundColor: c.cardAlt }]}>
                <Text style={[styles.messageText, { color: c.text }]} selectable>
                  {txn.rawText}
                </Text>
              </View>

              <View style={styles.deleteRow}>
                <Button label="Delete this payment" kind="danger" onPress={confirmDelete} />
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: space.sm, marginBottom: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 2 },
  amount: { fontSize: 34, fontWeight: '800', marginVertical: space.md },
  groupRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: space.md + 2 },
  change: { fontSize: 14, fontWeight: '700' },
  table: { marginTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    gap: space.lg,
  },
  label: { fontSize: 13, fontWeight: '600' },
  value: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  rename: { marginTop: space.md, gap: space.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: space.lg },
  hint: { fontSize: 13, lineHeight: 18 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, fontSize: 16 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  message: { borderRadius: radius.md, padding: space.lg, marginTop: space.sm },
  messageText: { fontSize: 14, lineHeight: 21 },
  noteInput: { minHeight: 76, textAlignVertical: 'top' },
  deleteRow: { marginTop: space.xl },
});
