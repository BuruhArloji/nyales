import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import {anyActiveLocalTracking,appendTrackingFixes,claimTrackingSyncAttempt} from './tracking-store.native';
import {getAuth} from '@react-native-firebase/auth';
import Constants from 'expo-constants';
import {readDeviceSession} from './session-store';
import {NyalesApi} from './api';
import {syncTrackingBatches} from './tracking-sync.native';

export const TRACKING_TASK = 'nyales-location-session-v1';

// Register at module scope so Android can deliver locations while the UI is closed.
TaskManager.defineTask<{locations:Location.LocationObject[]}>(TRACKING_TASK, async ({data,error})=>{
 if (error || !data?.locations) return;
 const points=data.locations.flatMap(location=>{
  const {latitude,longitude,accuracy}=location.coords;
  if (accuracy == null || !Number.isFinite(location.timestamp)) return [];
  return [{latitude,longitude,accuracy_m:accuracy,captured_at:new Date(location.timestamp).toISOString()}];
 });
 // No coordinates are written to logs. Keep the task failure visible to Android.
 await appendTrackingFixes(points);
 // Best effort only. Queue acknowledgement remains durable if networking fails.
 try {
  const active=await anyActiveLocalTracking(),user=getAuth().currentUser,origin=Constants.expoConfig?.extra?.apiOrigin;
  if(!active||!user||typeof origin!=='string'||!await claimTrackingSyncAttempt(active.owner))return;
  const session=await readDeviceSession(user.uid);if(!session)return;
  const api=new NyalesApi(origin,async()=>({idToken:await user.getIdToken(),deviceSession:session.session_token}));
  const identity=(await api.me()).data;
  if(`${identity.organization_id}:${identity.id}`!==active.owner||identity.portfolio_read_only)return;
  await syncTrackingBatches(api,active.owner);
 } catch { /* Keep encrypted points for the next retry, with no location in logs. */ }
});

export async function startLocationCollection() {
 await Location.startLocationUpdatesAsync(TRACKING_TASK,{
  accuracy:Location.Accuracy.Balanced,timeInterval:60_000,distanceInterval:25,
  foregroundService:{notificationTitle:'NYALES sedang merekam perjalanan kerja',notificationBody:'Tracking aktif selama sesi kerja.',killServiceOnDestroy:true},
 });
}

export async function stopLocationCollection() {
 if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK)) await Location.stopLocationUpdatesAsync(TRACKING_TASK);
}
