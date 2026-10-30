// Thin wrapper around the Kotlin statement reader (native/android/.../StatementReaderModule.kt).
// The file is opened through Android's own picker and read on the phone; nothing is copied or kept.

import { NativeModules, Platform } from 'react-native';
import { keepUnlockedDuring } from '../../lib/lockGuard';

const { StatementReader } = NativeModules;

export type PdfReadError = 'PASSWORD_REQUIRED' | 'WRONG_PASSWORD' | 'UNREADABLE';

/** Opens the file picker. Returns the chosen file, or null if you cancelled. */
export async function pickStatementPdf(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  return keepUnlockedDuring(() => StatementReader.pickPdf());
}

/** The PDF's text. Throws an Error whose message is a PdfReadError. */
export async function readStatementText(uri: string, password: string): Promise<string> {
  try {
    return await StatementReader.readText(uri, password);
  } catch (e) {
    const code = (e as { code?: string }).code;
    throw new Error(code === 'PASSWORD_REQUIRED' || code === 'WRONG_PASSWORD' ? code : 'UNREADABLE');
  }
}
