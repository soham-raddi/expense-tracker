// Settings: SMS permission and import, privacy summary, about.

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { importInbox } from '../ingest/smsIngest';
import { hasSmsPermission, requestSmsPermission, syncSenderCodes } from '../ingest/smsNative';
import { Button } from './components/Button';
import { radius, space, usePalette } from './theme';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export function SettingsScreen({ onOpen }: { onOpen: (screen: 'groups' | 'rules') => void }) {
  const c = usePalette();
  const [smsAllowed, setSmsAllowed] = useState<boolean | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const refreshPermission = useCallback(async () => {
    setSmsAllowed(await hasSmsPermission());
  }, []);

  useEffect(() => {
    refreshPermission();
  }, [refreshPermission]);

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

      <Card title="Privacy">
        <Text style={body}>
          Everything stays on this phone, encrypted. The app has no internet access, no accounts,
          no analytics and no cloud backup. It locks every time you leave and come back.
        </Text>
      </Card>

      <Text style={[styles.footer, { color: c.textMuted }]}>Expense Tracker · version 0.1</Text>
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
  result: { fontSize: 14, borderRadius: radius.sm, padding: space.md, overflow: 'hidden' },
  footer: { fontSize: 12, textAlign: 'center', marginTop: space.md },
});
