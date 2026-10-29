// Asks for biometrics or the device PIN on every open and every return from background.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';
import { Button } from '../components/Button';
import { radius, space, usePalette } from '../theme';

const biometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

// The system prompt makes Android report the app as inactive and then active again. Those events
// come from the prompt itself and must not lock the app or start a second prompt.
const PROMPT_SETTLE_MS = 1500;

export function AppLock({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  const [unlocked, setUnlockedState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlockedRef = useRef(false);
  const prompting = useRef(false);
  const promptEndedAt = useRef(0);

  const setUnlocked = useCallback((value: boolean) => {
    unlockedRef.current = value;
    setUnlockedState(value);
  }, []);

  const unlock = useCallback(async () => {
    if (prompting.current || unlockedRef.current) {
      return;
    }
    prompting.current = true;
    setError(null);
    try {
      const { success } = await biometrics.simplePrompt({
        promptMessage: 'Unlock Expense Tracker',
      });
      setUnlocked(success);
    } catch {
      setError('Set up a screen lock (PIN, pattern or fingerprint) on this phone to use the app.');
    } finally {
      prompting.current = false;
      promptEndedAt.current = Date.now();
    }
  }, [setUnlocked]);

  useEffect(() => {
    unlock();
    const sub = AppState.addEventListener('change', state => {
      if (prompting.current || Date.now() - promptEndedAt.current < PROMPT_SETTLE_MS) {
        return;
      }
      if (state === 'background') {
        setUnlocked(false);
      } else if (state === 'active') {
        unlock();
      }
    });
    return () => sub.remove();
  }, [unlock, setUnlocked]);

  if (unlocked) {
    return <>{children}</>;
  }
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.logo, { backgroundColor: c.accent }]}>
        <Text style={[styles.logoText, { color: c.onAccent }]}>₹</Text>
      </View>
      <Text style={[styles.title, { color: c.text }]}>Expense Tracker</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>Locked to keep your money private</Text>
      {error && <Text style={[styles.error, { color: c.debit }]}>{error}</Text>}
      <View style={styles.button}>
        <Button label="Unlock" onPress={unlock} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  logo: { width: 84, height: 84, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 44, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800', marginTop: space.lg },
  subtitle: { fontSize: 14, marginTop: space.xs },
  error: { textAlign: 'center', marginTop: space.lg },
  button: { marginTop: space.xl, alignSelf: 'stretch', paddingHorizontal: space.xl },
});
