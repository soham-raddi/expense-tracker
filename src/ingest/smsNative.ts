// Thin wrapper around the Kotlin SMS module (native/android/.../SmsReaderModule.kt).
// Android only; on iOS every function is a no-op because iOS apps cannot read SMS.

import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import banks from '../config/banks.json';
import type { RawSms } from '../data/types';
import { keepUnlockedDuring } from '../lib/lockGuard';

const { SmsReader } = NativeModules;

function allSenderCodes(): string[] {
  return Object.entries(banks)
    .filter(([key]) => !key.startsWith('_'))
    .flatMap(([, bank]) => (bank as { senderCodes: string[] }).senderCodes);
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const result = await keepUnlockedDuring(() =>
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]),
  );
  return Object.values(result).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
}

export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

/** Tells the native receiver which senders to forward, so other SMS never reach JS. */
export async function syncSenderCodes(): Promise<void> {
  if (Platform.OS === 'android') {
    await SmsReader.setSenderCodes(allSenderCodes());
  }
}

/** Bank SMS received since `sinceMs`, read from the inbox. */
export async function readInbox(sinceMs: number): Promise<RawSms[]> {
  if (Platform.OS !== 'android') {
    return [];
  }
  return SmsReader.readInbox(sinceMs, allSenderCodes());
}
