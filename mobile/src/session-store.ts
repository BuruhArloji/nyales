import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { DeviceSession } from './api';

const SESSION_KEY = 'nyales.device_session.v1';
type StoredSession = DeviceSession & { subject: string };

/** The browser preview intentionally has no credential persistence. The session is
 * partitioned by verified Firebase subject; account changes cannot reuse it. */
export async function readDeviceSession(subject: string): Promise<DeviceSession | null> {
  if (Platform.OS === 'web' || !subject) return null;
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (value.subject !== subject || typeof value.id !== 'string' || typeof value.session_token !== 'string' || !Number.isInteger(value.version)) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
    return { id: value.id, session_token: value.session_token, version: value.version! };
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function saveDeviceSession(subject: string, session: DeviceSession): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Device session storage is not enabled in browser preview');
  if (!subject || !session.id || !session.session_token || !Number.isInteger(session.version)) throw new Error('Invalid device session');
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ ...session, subject }), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function clearDeviceSession(): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(SESSION_KEY);
}
