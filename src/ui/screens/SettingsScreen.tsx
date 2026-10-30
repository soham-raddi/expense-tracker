// Settings: SMS permission and import, groups and rules, your data, privacy, about.

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../data/db';
import { deleteAllData } from '../../data/repos/dataRepo';
import { getImportLimit, setImportLimit } from '../../data/repos/settingsRepo';
import { importInbox } from '../../ingest/smsIngest';
import { dateTimeLabel } from '../../lib/format';
import { emitDataChanged } from '../../lib/events';
import { hasSmsPermission, requestSmsPermission, syncSenderCodes } from '../../ingest/smsNative';
import { Button } from '../components/Button';
import { DeleteAllModal } from '../components/DeleteAllModal';
import { radius, space, usePalette } from '../theme';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export function SettingsScreen({ onOpen }: { onOpen: (screen: 'groups' | 'rules' | 'privacy') => void }) {
  const c = usePalette();
  const [smsAllowed, setSmsAllowed] = useState<boolean | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [importLimit, setLimit] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);

  const refreshPermission = useCallback(async () => {
    setSmsAllowed(await hasSmsPermission());
  }, []);

  const refreshLimit = useCallback(async () => {
    setLimit(await getImportLimit(await getDb()));
  }, []);

  useEffect(() => {
    refreshPermission();
    refreshLimit();
  }, [refreshPermission, refreshLimit]);

  const onDeleteAll = async (ignoreOlderMessages: boolean) => {
    setDeleting(true);
    try {
      await deleteAllData(await getDb(), ignoreOlderMessages);
      setConfirmingDelete(false);
      setResult(null);
      setDeleteResult('All your data was deleted from this phone.');
      await refreshLimit();
      emitDataChanged();
    } catch {
      setDeleteResult('Something went wrong and not everything was deleted. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const allowOldMessages = async () => {
    await setImportLimit(await getDb(), null);
    await refreshLimit();
  };

  const onImport = async () => {
    setResult(null);
    const granted = (await hasSmsPermission()) || (await requestSmsPermission());
    setSmsAllowed(granted);
    if (!granted) {
      setResult('SMS permission was not granted. You can still use statement import once it is added.');
      return;
    }
    setImporting(true);
    try {
      await syncSenderCodes();
      const n = await importInbox();
      setResult(
        `New: ${n.saved} · Already saved: ${n.duplicate} · Could not read: ${n.unparsed}`,
      );
    } catch {
      setResult('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const body = [styles.body, { color: c.textMuted }];

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: c.text }]}>Settings</Text>

      <Card title="Bank SMS">
        <Text style={body}>
          Read your bank payment messages to record every debit and credit automatically. Only
          messages from your bank are kept, and OTP messages are ignored.
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: smsAllowed ? c.credit : smsAllowed === false ? c.debit : c.border },
            ]}
          />
          <Text style={[styles.status, { color: c.text }]}>
            {smsAllowed ? 'SMS access allowed' : 'SMS access not allowed'}
          </Text>
        </View>
        <Button
          label={smsAllowed ? 'Import last 6 months' : 'Allow SMS and import'}
          onPress={onImport}
          loading={importing}
        />
        {result && <Text style={[styles.result, { color: c.text, backgroundColor: c.cardAlt }]}>{result}</Text>}
      </Card>

      <Card title="Groups and rules">
        <Text style={body}>
          Make your own groups (friends, merchants, food) and set rules so payments to places like
          Dominos, Swiggy or Zomato sort themselves.
        </Text>
        <Button label="Your groups" kind="secondary" onPress={() => onOpen('groups')} />
        <Button label="Auto-sort rules" kind="secondary" onPress={() => onOpen('rules')} />
      </Card>

      <Card title="Bank statements">
        <Text style={body}>
          Import a PDF statement for any date range, even for a half month. This is coming in the
          next update.
        </Text>
        <Button label="Import statement" kind="secondary" onPress={() => {}} disabled />
      </Card>

      <Card title="Your data">
        <Text style={body}>
          Your payments and the original messages are saved only on this phone. You can delete one
          payment from its details, or wipe everything here. Your groups and rules are kept.
        </Text>
        {importLimit != null && (
          <View style={[styles.note, { backgroundColor: c.cardAlt }]}>
            <Text style={[styles.noteText, { color: c.text }]}>
              Imports skip messages received before {dateTimeLabel(importLimit)}.
            </Text>
            <Button label="Allow older messages again" kind="secondary" onPress={allowOldMessages} />
          </View>
        )}
        {deleteResult && <Text style={[styles.result, { color: c.text, backgroundColor: c.cardAlt }]}>{deleteResult}</Text>}
        <Button label="Delete all my data" kind="danger" onPress={() => setConfirmingDelete(true)} />
      </Card>

      <Card title="Privacy and security">
        <Text style={body}>
          Everything stays on this phone, encrypted, and the app has no internet access. Read exactly
          what it stores, how it is protected, and what it cannot protect against.
        </Text>
        <Button label="How your data is protected" kind="secondary" onPress={() => onOpen('privacy')} />
      </Card>

      <Text style={[styles.footer, { color: c.textMuted }]}>Expense Tracker · version 0.1</Text>
      <DeleteAllModal
        visible={confirmingDelete}
        busy={deleting}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={onDeleteAll}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xl * 2 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: space.lg },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    marginBottom: space.lg,
    gap: space.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontSize: 14, fontWeight: '600' },
  note: { borderRadius: radius.sm, padding: space.md, gap: space.md },
  noteText: { fontSize: 14, lineHeight: 20 },
  result: { fontSize: 14, borderRadius: radius.sm, padding: space.md, overflow: 'hidden' },
  footer: { fontSize: 12, textAlign: 'center', marginTop: space.md },
});
