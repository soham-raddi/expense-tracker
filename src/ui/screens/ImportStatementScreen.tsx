// Imports a bank statement PDF: pick the file, enter its password if it has one, see what was added.
// The password is only held in memory while reading; it is never saved.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { importStatementText, looksLikeStatement, type ImportSummary } from '../../ingest/pdf/importStatement';
import { pickStatementPdf, readStatementText } from '../../ingest/pdf/pdfNative';
import { formatRupees } from '../../lib/format';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { radius, space, usePalette } from '../theme';

type Stage = 'start' | 'password' | 'reading' | 'done';

function dateOnly(timestamp: number): string {
  return new Date(timestamp + 5.5 * 3600 * 1000).toISOString().slice(0, 10).split('-').reverse().join('-');
}

export function ImportStatementScreen({ onBack }: { onBack: () => void }) {
  const c = usePalette();
  const [stage, setStage] = useState<Stage>('start');
  const [uri, setUri] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const read = async (file: string, pass: string) => {
    setStage('reading');
    setMessage(null);
    try {
      const text = await readStatementText(file, pass);
      if (!looksLikeStatement(text)) {
        setMessage('This does not look like an ICICI Bank account statement. Other banks are not supported yet.');
        setStage('start');
        return;
      }
      setSummary(await importStatementText(text));
      setPassword('');
      setStage('done');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'PASSWORD_REQUIRED' || code === 'WRONG_PASSWORD') {
        setMessage(code === 'WRONG_PASSWORD' ? 'That password did not open the file. Try again.' : null);
        setStage('password');
      } else {
        setMessage('This file could not be read as a PDF statement.');
        setStage('start');
      }
    }
  };

  const choose = async () => {
    const file = await pickStatementPdf();
    if (file) {
      setUri(file);
      setPassword('');
      await read(file, '');
    }
  };

  const reset = () => {
    setStage('start');
    setSummary(null);
    setMessage(null);
    setUri(null);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <ScreenHeader title="Import statement" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {stage === 'start' && (
          <>
            <Text style={[styles.body, { color: c.textMuted }]}>
              Choose the account statement PDF from your bank. It lists every transaction, not only UPI,
              for any date range. The file is read on this phone and not kept. Payments you already have
              from messages are matched, not duplicated.
            </Text>
            {message && <Text style={[styles.notice, { color: c.text, backgroundColor: c.cardAlt }]}>{message}</Text>}
            <Button label="Choose statement PDF" onPress={choose} />
          </>
        )}

        {stage === 'password' && (
          <>
            <Text style={[styles.body, { color: c.textMuted }]}>
              This PDF is password protected. Enter its password. It is used only to open the file now and
              is not saved.
            </Text>
            {message && <Text style={[styles.notice, { color: c.text, backgroundColor: c.cardAlt }]}>{message}</Text>}
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="PDF password"
              placeholderTextColor={c.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: c.text, backgroundColor: c.cardAlt, borderColor: c.border }]}
            />
            <Button label="Open and import" onPress={() => uri && read(uri, password)} disabled={password.length === 0} />
            <Button label="Choose a different file" kind="secondary" onPress={reset} />
          </>
        )}

        {stage === 'reading' && <Text style={[styles.body, { color: c.textMuted }]}>Reading the statement…</Text>}

        {stage === 'done' && summary && <Summary summary={summary} onAgain={reset} onDone={onBack} />}
      </ScrollView>
    </View>
  );
}

function Summary({ summary, onAgain, onDone }: { summary: ImportSummary; onAgain: () => void; onDone: () => void }) {
  const c = usePalette();
  const ok = summary.complete && summary.rowsRead > 0;
  return (
    <>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: ok ? c.credit : c.debit }]}>
        <Text style={[styles.heading, { color: c.text }]}>
          {ok ? 'Every transaction was read' : summary.rowsRead === 0 ? 'No transactions found' : 'Some rows need a look'}
        </Text>
        {summary.fromDate != null && summary.toDate != null && (
          <Text style={[styles.line, { color: c.textMuted }]}>
            {dateOnly(summary.fromDate)} to {dateOnly(summary.toDate)}
          </Text>
        )}
        <Text style={[styles.line, { color: c.text }]}>{summary.rowsRead} transactions read</Text>
        <Text style={[styles.line, { color: c.text }]}>{summary.added} added</Text>
        <Text style={[styles.line, { color: c.text }]}>{summary.alreadyHad} already in the app</Text>
        {summary.skippedDeleted > 0 && (
          <Text style={[styles.line, { color: c.text }]}>{summary.skippedDeleted} skipped, you deleted them earlier</Text>
        )}
        {summary.openingPaise != null && summary.closingPaise != null && (
          <Text style={[styles.line, { color: c.textMuted }]}>
            Balance {formatRupees(summary.openingPaise)} to {formatRupees(summary.closingPaise)}
          </Text>
        )}
        <Text style={[styles.line, { color: ok ? c.credit : c.debit }]}>
          {ok
            ? 'The rows add up to the statement balance, so nothing is missing.'
            : 'The rows do not fully add up to the statement balance. Something may be missing.'}
        </Text>
      </View>

      {summary.unreadable.length > 0 && (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.heading, { color: c.text }]}>{summary.unreadable.length} rows could not be read</Text>
          {summary.unreadable.map((row, i) => (
            <Text key={i} style={[styles.raw, { color: c.textMuted, backgroundColor: c.cardAlt }]}>
              {row}
            </Text>
          ))}
        </View>
      )}

      <Button label="Done" onPress={onDone} />
      <Button label="Import another statement" kind="secondary" onPress={onAgain} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
  body: { fontSize: 14, lineHeight: 21 },
  notice: { fontSize: 14, lineHeight: 20, padding: space.md, borderRadius: radius.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 16,
  },
  card: { borderRadius: radius.md, borderWidth: 1, padding: space.lg, gap: space.sm },
  heading: { fontSize: 17, fontWeight: '800' },
  line: { fontSize: 14, lineHeight: 20 },
  raw: { fontSize: 12, lineHeight: 17, padding: space.sm, borderRadius: radius.md },
});
