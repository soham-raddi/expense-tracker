// The database encryption key is generated once on the device and kept in
// Android Keystore / iOS Keychain. It never leaves the device and is never logged.

import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'upitracker.db-key';

export async function getOrCreateDbKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: SERVICE });
  if (existing) {
    return existing.password;
  }
  // 32 bytes from the OS secure random generator (native/android/.../SecureRandomModule.kt).
  const key: string = await NativeModules.SecureRandom.hexBytes(32);
  await Keychain.setGenericPassword('db', key, {
    service: SERVICE,
    // Available after first unlock so live SMS can be saved while the phone is locked.
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return key;
}
