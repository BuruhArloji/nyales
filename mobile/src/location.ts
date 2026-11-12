import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { VisitFix } from './api';

export type LocationResult =
  | { kind: 'fix'; fix: Pick<VisitFix, 'source' | 'latitude_e7' | 'longitude_e7' | 'accuracy_cm' | 'captured_at'> }
  | { kind: 'denied' | 'unavailable'; canAskAgain?: boolean };

/** Called only after an explicit check-in/out action, never during rendering.
 * The backend is authoritative for distance, freshness and accuracy. */
export async function captureVisitLocation(): Promise<LocationResult> {
  if (Platform.OS !== 'android') return { kind: 'unavailable' };
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { kind: 'denied', canAskAgain: permission.canAskAgain };
    if (!await Location.hasServicesEnabledAsync()) return { kind: 'unavailable' };
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude, accuracy } = location.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy == null || !Number.isFinite(accuracy) || accuracy < 0 || !Number.isFinite(location.timestamp)) return { kind: 'unavailable' };
    return { kind: 'fix', fix: { source: 'android_gps', latitude_e7: Math.round(latitude * 1e7), longitude_e7: Math.round(longitude * 1e7), accuracy_cm: Math.round(accuracy * 100), captured_at: new Date(location.timestamp).toISOString() } };
  } catch {
    return { kind: 'unavailable' };
  }
}
