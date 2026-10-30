// Plain-language explanation of what the app stores and how it is protected, including its limits.
// Keep every statement here true to what the app does; update this screen when behaviour changes.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { radius, space, usePalette } from '../theme';

interface Section {
  title: string;
  points: string[];
}

const SECTIONS: Section[] = [
  {
    title: 'Your data stays on this phone',
    points: [
      'The app has no internet permission. It cannot send anything anywhere, and there is no server, account, cloud sync or backup.',
      'There is no analytics, no advertising and no crash reporting. Nobody, including the people who made the app, can see your payments.',
      'You can check this yourself: turn on airplane mode and the app works exactly the same, and Android shows no data use for it.',
    ],
  },
  {
    title: 'How it is encrypted',
    points: [
      'Everything is stored in a database encrypted with AES-256 (SQLCipher). Without the key, the file is unreadable.',
      'The key is created on your phone the first time you open the app, from the phone\'s secure random generator. It is kept in Android\'s secure key storage, which is hardware-backed on most phones, and it never leaves this device.',
      'To save a bank message that arrives while the app is closed, the key is available once you have unlocked the phone after it started up.',
    ],
  },
  {
    title: 'Who can open it',
    points: [
      'Other apps cannot read this app\'s files. Android keeps each app\'s storage private, on a normal phone.',
      'The app locks every time you open it or come back to it, using your phone\'s fingerprint, face or PIN.',
      'Its screen is hidden in the recent-apps view and cannot be screenshotted.',
      'Cloud backup and device-to-device transfer are turned off, so your data is not copied anywhere when you change phones.',
    ],
  },
  {
    title: 'What the app can read',
    points: [
      'It reads text messages only from your bank\'s sender names. Everything else is dropped before the app sees it.',
      'One-time passwords (OTPs) are ignored and never saved.',
      'For each bank payment message it saves the amount, date, who it was with, the last digits of your account, the reference, the balance if shown, and the full original text. The text is kept exactly as the bank sent it, so anything the bank put in it is kept too. Notes you write on a payment, and names you give a payee, are stored with it.',
      'Messages you dismissed from the Unparsed tab are hidden, not erased, so they do not come back. They are removed by Delete all data.',
      'Message text is never written to logs.',
    ],
  },
  {
    title: 'What it cannot protect against',
    points: [
      'Anyone who can unlock your phone can open the app, because the app lock uses your phone\'s lock.',
      'A phone that is rooted or infected with malware can expose any app\'s data, including this one.',
      'Your bank messages in the phone\'s own Messages app are separate, and this app does not delete them.',
    ],
  },
  {
    title: 'Your control',
    points: [
      'Open any payment and choose Delete this payment to remove it. Only a short fingerprint is kept so a later import does not bring it back; the message text is gone.',
      'In Settings, Delete all my data wipes every payment, payee name, saved message and import record. Deleted content is overwritten rather than left in the file.',
      'Uninstalling the app removes everything it stored. Because there is no backup, deleted data cannot be recovered.',
    ],
  },
];

export function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const c = usePalette();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <ScreenHeader title="Privacy and security" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: c.textMuted }]}>
          This is what the app stores, how it is protected, and where the protection stops.
        </Text>
        {SECTIONS.map(section => (
          <View key={section.title} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.heading, { color: c.text }]}>{section.title}</Text>
            {section.points.map(point => (
              <View key={point} style={styles.point}>
                <View style={[styles.bullet, { backgroundColor: c.accent }]} />
                <Text style={[styles.pointText, { color: c.text }]}>{point}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.lg },
  intro: { fontSize: 14, lineHeight: 20 },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  heading: { fontSize: 17, fontWeight: '800' },
  point: { flexDirection: 'row', gap: space.md },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  pointText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
