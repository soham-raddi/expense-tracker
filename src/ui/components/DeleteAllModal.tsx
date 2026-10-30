// Asks you to type DELETE before wiping everything, because it cannot be undone.

import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { radius, space, usePalette } from '../theme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (ignoreOlderMessages: boolean) => void;
}

export function DeleteAllModal({ visible, busy, onCancel, onConfirm }: Props) {
  const c = usePalette();
  const [typed, setTyped] = useState('');
  const [ignoreOlder, setIgnoreOlder] = useState(true);

  useEffect(() => {
    if (visible) {
      setTyped('');
      setIgnoreOlder(true);
    }
  }, [visible]);

  const ready = typed.trim().toUpperCase() === 'DELETE';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      {/* The padding keeps the sheet above the keyboard; Android does not resize modals itself. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Cancel" />
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <Text style={[styles.title, { color: c.debit }]}>Delete all your data?</Text>
          <Text style={[styles.body, { color: c.text }]}>
            This permanently deletes every payment, payee name, saved message and import record from
            this phone. It cannot be undone, and there is no backup to restore from.
          </Text>
          <Text style={[styles.body, { color: c.textMuted }]}>
            Your groups and auto-sort rules are kept. Your bank messages in the phone's own Messages
            app are not touched.
          </Text>

          <View style={styles.option}>
            <Text style={[styles.optionText, { color: c.text }]}>
              Do not bring back old messages
              <Text style={{ color: c.textMuted }}>
                {' '}
                Later imports will skip messages received before today. Turn off to allow a full
                re-import.
              </Text>
            </Text>
            <Switch value={ignoreOlder} onValueChange={setIgnoreOlder} />
          </View>

          <Text style={[styles.label, { color: c.textMuted }]}>Type DELETE to confirm</Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="DELETE"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { color: c.text, backgroundColor: c.cardAlt, borderColor: c.border }]}
          />
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label="Cancel" kind="secondary" onPress={onCancel} disabled={busy} />
            </View>
            <View style={styles.flex}>
              <Button
                label="Delete everything"
                kind="danger"
                onPress={() => onConfirm(ignoreOlder)}
                disabled={!ready}
                loading={busy}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  title: { fontSize: 20, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  optionText: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, fontSize: 16 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
});
