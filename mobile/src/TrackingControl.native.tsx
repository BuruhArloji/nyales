import React,{useCallback,useEffect,useState} from 'react';
import {Alert,AppState,Pressable,StyleSheet,Text,View} from 'react-native';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {NyalesApiError,type Identity,type NyalesApi} from './api';
import {activeLocalTracking,activateLocalTracking,anyActiveLocalTracking,expiredTrackingCount,initializeTrackingStore,stopLocalTracking,trackingQueueCount} from './tracking-store.native';
import {startLocationCollection,stopLocationCollection,TRACKING_TASK} from './tracking-task.native';
import {syncTrackingBatches} from './tracking-sync.native';

const ownerFor=(identity:Identity)=>`${identity.organization_id}:${identity.id}`;
async function journalKey(owner:string){return 'tracking_start_'+await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,owner)}

export async function stopTrackingForAccountChange(identity:Identity) {
 try {
  const prior=await anyActiveLocalTracking();
  if(prior&&prior.owner!==ownerFor(identity)) {await stopLocalTracking(prior.owner,prior.id,new Date().toISOString());await stopLocationCollection()}
 } catch(error) {if(error instanceof Error&&error.message==='TRACKING_KEY_UNAVAILABLE')return;throw error}
}

export async function stopTrackingForLogout(identity:Identity,api:NyalesApi) {
 if (identity.role!=='SALES_REP') return;
 try {
  const owner=ownerFor(identity),active=await activeLocalTracking(owner);
  if (active) await stopLocalTracking(owner,active.id,new Date().toISOString());
  await stopLocationCollection();
  try {await syncTrackingBatches(api,owner)} catch { /* Encrypted queue stays for the same account. */ }
 } catch(error) {
  if (error instanceof Error&&error.message==='TRACKING_KEY_UNAVAILABLE') {await stopLocationCollection();return}
  throw error;
 }
}

export default function TrackingControl({api,identity}:{api:NyalesApi;identity:Identity}) {
 const owner=ownerFor(identity),[active,setActive]=useState<{id:string;started_at:string}|null>(null),[collecting,setCollecting]=useState(false),[queued,setQueued]=useState(0),[expired,setExpired]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=useCallback(async()=>{await initializeTrackingStore();const current=await activeLocalTracking(owner);setActive(current);if(current)await SecureStore.deleteItemAsync(await journalKey(owner));let running=await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK);if(!current&&running){await stopLocationCollection();running=false}setCollecting(running);setQueued(await trackingQueueCount(owner));setExpired(await expiredTrackingCount(owner))},[owner]);
 const sync=useCallback(async()=>{try {const result=await syncTrackingBatches(api,owner);await refresh();if(result.expired)setMessage(`${result.expired} titik yang belum terkirim dihapus karena melewati 30 hari.`)} catch (error) {setMessage(error instanceof NyalesApiError&&error.code==='TRACKING_BATCH_EXPIRED'?'Sebagian lokasi melewati batas 30 hari dan perlu ditinjau.':'Lokasi tersimpan di perangkat. Sinkronisasi akan dicoba kembali saat aplikasi aktif.')}},[api,owner,refresh]);
 useEffect(()=>{void refresh().then(sync).catch(()=>setMessage('Penyimpanan tracking belum tersedia.'));const timer=setInterval(()=>{if(AppState.currentState==='active')void sync()},300_000);const listener=AppState.addEventListener('change',state=>{if(state==='active')void sync()});return()=>{clearInterval(timer);listener.remove()}},[refresh,sync]);
 const start=async()=>{
  setBusy(true);setMessage('');
  try {
   const fg=await Location.requestForegroundPermissionsAsync();if(fg.status!=='granted')throw Error('Izin lokasi diperlukan untuk mulai tracking.');
   const bg=await Location.requestBackgroundPermissionsAsync();if(bg.status!=='granted')throw Error('Izin lokasi di latar belakang diperlukan agar tracking tetap berjalan.');
   await initializeTrackingStore();
   const key=await journalKey(owner);let eventId=await SecureStore.getItemAsync(key);
   if(!eventId){eventId=Crypto.randomUUID();await SecureStore.setItemAsync(key,eventId)}
   const result=await api.startTracking(eventId);
   const existing=await activeLocalTracking(owner);
   if(!existing)await activateLocalTracking(owner,result.data);
   else if(existing.id!==result.data.id)throw Error('Sesi lain masih aktif di perangkat.');
   await SecureStore.deleteItemAsync(key);
   await startLocationCollection();await refresh();
  } catch(error){setMessage(error instanceof NyalesApiError?(error.code==='TRACKING_SESSION_ALREADY_ACTIVE'?'Sesi tracking masih aktif. Periksa sesi di perangkat sebelumnya.':error.code==='TRACKING_STORAGE_UNAVAILABLE'?'Layanan tracking belum tersedia. Coba lagi nanti.':'Tracking belum dapat dimulai. Periksa koneksi dan coba lagi.'):error instanceof Error?error.message:'Tracking belum dapat dimulai.');await refresh().catch(()=>{})} finally{setBusy(false)}
 };
 const stop=async()=>{
  if(!active)return;setBusy(true);setMessage('');
  try {await stopLocalTracking(owner,active.id,new Date().toISOString());await stopLocationCollection();await refresh();await sync()} catch {setMessage('Tracking belum berhenti dengan sempurna. Coba lagi.')} finally{setBusy(false)}
 };
 const resume=async()=>{setBusy(true);try{await startLocationCollection();await refresh()}catch{setMessage('Lokasi belum dapat diaktifkan kembali.')}finally{setBusy(false)}};
 return <View style={s.card}><Text style={s.title}>Tracking perjalanan</Text><Text style={s.note}>{active?(collecting?'Tracking aktif':'Sesi aktif, lokasi belum berjalan'):'Tracking tidak aktif'}</Text>{active&&<Text style={s.note}>Mulai: {new Date(active.started_at).toLocaleString('id-ID')}</Text>}{queued>0&&<Text style={s.note}>{queued} titik menunggu sinkronisasi</Text>}{expired>0&&<Text style={s.note}>{expired} titik belum terkirim dihapus setelah melewati 30 hari</Text>}{!!message&&<Text accessibilityRole="alert" style={s.note}>{message}</Text>}{active?<View style={s.row}>{!collecting&&<Pressable disabled={busy} onPress={()=>void resume()} style={s.button}><Text style={s.buttonText}>Lanjutkan tracking</Text></Pressable>}<Pressable disabled={busy} onPress={()=>void stop()} style={s.button}><Text style={s.buttonText}>Selesai tracking</Text></Pressable></View>:<Pressable disabled={busy} onPress={()=>Alert.alert('Lokasi selama bekerja','NYALES merekam lokasi selama sesi kerja, termasuk saat aplikasi berada di latar belakang atau layar terkunci. Posisi dan jejak dapat dilihat atasan sesuai cakupan. Tracking berhenti saat kamu menekan Selesai tracking.',[{text:'Batal',style:'cancel'},{text:'Mulai',onPress:()=>void start()}])} style={s.button}><Text style={s.buttonText}>Mulai tracking</Text></Pressable>}<Pressable disabled={busy} onPress={()=>void sync()}><Text style={s.link}>Sinkronkan lokasi</Text></Pressable></View>;
}
const s=StyleSheet.create({card:{padding:16,borderRadius:20,backgroundColor:'#f8faf9',gap:10,marginVertical:8},title:{fontSize:17,color:'#242625',fontFamily:'Inter_600SemiBold'},note:{fontSize:13,color:'#526b60',lineHeight:19},row:{flexDirection:'row',gap:8,flexWrap:'wrap'},button:{backgroundColor:'#242625',padding:13,borderRadius:24},buttonText:{color:'#fff',textAlign:'center',fontFamily:'Inter_600SemiBold'},link:{color:'#315e54',padding:8}});
