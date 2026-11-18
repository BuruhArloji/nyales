import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type {TrackingFix} from './api';

const KEY='nyales.tracking.database.key.v1';
const FILE='nyales-tracking-v1.db';
let openPromise:Promise<SQLite.SQLiteDatabase>|undefined;

/** Create the encryption key only from the foreground start flow. */
export async function initializeTrackingStore() {
 let key=await SecureStore.getItemAsync(KEY);
 if (!key) {
  key=Array.from(await Crypto.getRandomBytesAsync(32),v=>v.toString(16).padStart(2,'0')).join('');
  await SecureStore.setItemAsync(KEY,key);
 }
 return openTrackingStore();
}

export function openTrackingStore():Promise<SQLite.SQLiteDatabase> {
 if (!openPromise) openPromise=(async()=>{
  const key=await SecureStore.getItemAsync(KEY);
  if (!key || !/^[0-9a-f]{64}$/.test(key)) throw new Error('TRACKING_KEY_UNAVAILABLE');
  const db=await SQLite.openDatabaseAsync(FILE);
  const cipher=await db.getFirstAsync<{cipher_version:string}>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) {await db.closeAsync();throw new Error('TRACKING_ENCRYPTION_UNAVAILABLE')}
  await db.execAsync(`PRAGMA key = "x'${key}'";`);
  await db.execAsync(`CREATE TABLE IF NOT EXISTS tracking_session (id TEXT PRIMARY KEY, owner TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('active','stopped')), started_at TEXT NOT NULL, stopped_at TEXT); CREATE UNIQUE INDEX IF NOT EXISTS tracking_one_active ON tracking_session(state) WHERE state='active'; CREATE TABLE IF NOT EXISTS tracking_fix (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, captured_at TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy_m REAL NOT NULL, batch_id TEXT, UNIQUE(session_id,captured_at)); CREATE TABLE IF NOT EXISTS tracking_batch (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, owner TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS tracking_stop_event (session_id TEXT PRIMARY KEY,owner TEXT NOT NULL,stopped_at TEXT NOT NULL,event_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS tracking_sync_control(owner TEXT PRIMARY KEY,last_attempt_ms INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS tracking_retention_control(owner TEXT PRIMARY KEY,last_server_time TEXT NOT NULL,expired_points INTEGER NOT NULL DEFAULT 0);`);
  return db;
 })().catch(error=>{openPromise=undefined;throw error});
 return openPromise;
}

export async function activateLocalTracking(owner:string,session:{id:string;started_at:string}) {
 const db=await initializeTrackingStore();
 await db.runAsync('INSERT INTO tracking_session(id,owner,state,started_at) VALUES(?,?,\'active\',?)',session.id,owner,session.started_at);
}

/** Stopping updates the local database before any network request. */
export async function stopLocalTracking(owner:string,sessionId:string,stoppedAt:string) {
 const db=await openTrackingStore();
 await db.withExclusiveTransactionAsync(async tx=>{
  const changed=await tx.runAsync("UPDATE tracking_session SET state='stopped',stopped_at=? WHERE id=? AND owner=? AND state='active'",stoppedAt,sessionId,owner);
  if (changed.changes) await tx.runAsync('INSERT INTO tracking_stop_event(session_id,owner,stopped_at,event_id) VALUES(?,?,?,?)',sessionId,owner,stoppedAt,Crypto.randomUUID());
 });
}

export async function activeLocalTracking(owner:string) {
 const db=await openTrackingStore();
 return db.getFirstAsync<{id:string;started_at:string}>('SELECT id,started_at FROM tracking_session WHERE owner=? AND state=\'active\'',owner);
}
export async function anyActiveLocalTracking() {
 const db=await openTrackingStore();
 return db.getFirstAsync<{id:string;owner:string}>('SELECT id,owner FROM tracking_session WHERE state=\'active\'');
}
export async function claimTrackingSyncAttempt(owner:string,nowMs=Date.now()) {
 const db=await openTrackingStore();
 const result=await db.runAsync('INSERT INTO tracking_sync_control(owner,last_attempt_ms) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET last_attempt_ms=excluded.last_attempt_ms WHERE tracking_sync_control.last_attempt_ms<=?',owner,nowMs,nowMs-300_000);
 return result.changes===1;
}

export async function pendingTrackingStop(owner:string) {
 const db=await openTrackingStore();
 return db.getFirstAsync<{session_id:string;stopped_at:string;event_id:string}>('SELECT session_id,stopped_at,event_id FROM tracking_stop_event WHERE owner=? ORDER BY rowid LIMIT 1',owner);
}

export async function acknowledgeTrackingStop(owner:string,sessionId:string,eventId:string) {
 const db=await openTrackingStore();
 await db.runAsync('DELETE FROM tracking_stop_event WHERE owner=? AND session_id=? AND event_id=?',owner,sessionId,eventId);
}

export async function trackingQueueCount(owner:string) {
 const db=await openTrackingStore();
 const row=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) n FROM tracking_fix f JOIN tracking_session s ON s.id=f.session_id WHERE s.owner=?',owner);
 return row?.n??0;
}
export async function expiredTrackingCount(owner:string) {
 const db=await openTrackingStore();
 const row=await db.getFirstAsync<{expired_points:number}>('SELECT expired_points FROM tracking_retention_control WHERE owner=?',owner);
 return row?.expired_points??0;
}

export async function trackingRetentionDue(owner:string) {
 const db=await openTrackingStore(),row=await db.getFirstAsync<{last_server_time:string}>('SELECT last_server_time FROM tracking_retention_control WHERE owner=?',owner);
 return !row||Date.now()-Date.parse(row.last_server_time)>=6*3_600_000;
}

/** Retention uses authenticated server time; a device clock change must not delete data. */
export async function pruneExpiredTracking(owner:string,serverTime:string) {
 const now=Date.parse(serverTime);if(!Number.isFinite(now))throw new Error('TRACKING_SERVER_TIME_INVALID');
 const cutoff=new Date(now-30*86_400_000).toISOString(),db=await openTrackingStore();
 let removed=0;
 await db.withExclusiveTransactionAsync(async tx=>{
  const batches=await tx.getAllAsync<{id:string}>('SELECT DISTINCT b.id FROM tracking_batch b JOIN tracking_fix f ON f.batch_id=b.id WHERE b.owner=? AND f.captured_at<?',owner,cutoff);
  for(const b of batches) {
   await tx.runAsync('UPDATE tracking_fix SET batch_id=NULL WHERE batch_id=? AND captured_at>=?',b.id,cutoff);
   const old=await tx.runAsync('DELETE FROM tracking_fix WHERE batch_id=? AND captured_at<?',b.id,cutoff);removed+=old.changes;
   await tx.runAsync('DELETE FROM tracking_batch WHERE owner=? AND id=?',owner,b.id);
  }
  const unbatched=await tx.runAsync('DELETE FROM tracking_fix WHERE batch_id IS NULL AND captured_at<? AND session_id IN(SELECT id FROM tracking_session WHERE owner=?)',cutoff,owner);removed+=unbatched.changes;
  await tx.runAsync('INSERT INTO tracking_retention_control(owner,last_server_time,expired_points) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET last_server_time=excluded.last_server_time,expired_points=tracking_retention_control.expired_points+excluded.expired_points',owner,serverTime,removed);
 });
 return removed;
}

export async function appendTrackingFixes(points:TrackingFix[]) {
 const db=await openTrackingStore();
 for(const p of points) {
  if (![p.latitude,p.longitude,p.accuracy_m].every(Number.isFinite)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||p.accuracy_m<0||p.accuracy_m>100||!Number.isFinite(Date.parse(p.captured_at))) continue;
  await db.runAsync("INSERT OR IGNORE INTO tracking_fix(session_id,captured_at,latitude,longitude,accuracy_m) SELECT id,?,?,?,? FROM tracking_session WHERE state='active' AND started_at<=?",p.captured_at,p.latitude,p.longitude,p.accuracy_m,p.captured_at);
 }
}

export type LocalTrackingBatch={id:string;session_id:string;payload:string};

/** Seal one immutable batch before networking, so retries always use identical bytes. */
export async function nextTrackingBatch(owner:string):Promise<LocalTrackingBatch|null> {
 const db=await openTrackingStore();
 let result:LocalTrackingBatch|null=null;
 await db.withExclusiveTransactionAsync(async tx=>{
  const existing=await tx.getFirstAsync<LocalTrackingBatch>('SELECT id,session_id,payload FROM tracking_batch WHERE owner=? ORDER BY rowid LIMIT 1',owner);
  if (existing) {result=existing;return}
  const session=await tx.getFirstAsync<{session_id:string}>('SELECT f.session_id FROM tracking_fix f JOIN tracking_session s ON s.id=f.session_id WHERE s.owner=? AND f.batch_id IS NULL ORDER BY f.captured_at LIMIT 1',owner);
  if (!session) return;
  const rows=await tx.getAllAsync<TrackingFix & {id:number}>('SELECT id,latitude,longitude,accuracy_m,captured_at FROM tracking_fix WHERE session_id=? AND batch_id IS NULL ORDER BY captured_at LIMIT 100',session.session_id);
  if (!rows.length) return;
  const id=Crypto.randomUUID(), points=rows.map(({latitude,longitude,accuracy_m,captured_at})=>({latitude,longitude,accuracy_m,captured_at}));
  const payload=JSON.stringify({batch_id:id,points});
  await tx.runAsync('INSERT INTO tracking_batch(id,session_id,owner,payload) VALUES(?,?,?,?)',id,session.session_id,owner,payload);
  for (const row of rows) await tx.runAsync('UPDATE tracking_fix SET batch_id=? WHERE id=? AND batch_id IS NULL',id,row.id);
  result={id,session_id:session.session_id,payload};
 });
 return result;
}

/** Remove locations only after an acknowledged server response for this account. */
export async function acknowledgeTrackingBatch(owner:string,id:string) {
 const db=await openTrackingStore();
 await db.withExclusiveTransactionAsync(async tx=>{
  const row=await tx.getFirstAsync<{id:string}>('SELECT id FROM tracking_batch WHERE owner=? AND id=?',owner,id);
  if (!row) return;
  await tx.runAsync('DELETE FROM tracking_fix WHERE batch_id=?',id);
  await tx.runAsync('DELETE FROM tracking_batch WHERE owner=? AND id=?',owner,id);
 });
}
