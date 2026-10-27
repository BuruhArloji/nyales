import{Loading}from'./Loading';
import React,{createContext,useContext,useEffect,useState} from 'react';
import {initializeApp} from 'firebase/app';
import {getAuth,onIdTokenChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut,browserSessionPersistence,setPersistence,type Auth} from 'firebase/auth';
type Identity={demo_data?:boolean;id:string;name:string;organization_id:string;role:string;capabilities:string[];area_ids:string[];scope:string};
type Config={mode:'local'|'firebase';configured:boolean};
let firebaseAuth:Auth|undefined;
let demo=false;
type BoundSession={id:string;session_token:string;subject:string;version:number};
const sessionKey='nyales-device-session';
function subject(){return demo?'local:demo-management':firebaseAuth?.currentUser?.uid||null}
export function currentDeviceSession(){try{const value=JSON.parse(sessionStorage.getItem(sessionKey)||'null') as BoundSession|null;return value?.subject===subject()?value:null}catch{return null}}
function clearSession(){sessionStorage.removeItem(sessionKey)}
export async function apiFetch(url:string,init:RequestInit={}){
 if(new URL(url,location.origin).origin!==location.origin)throw new Error('API harus berasal dari NYALES.');
 const headers=new Headers(init.headers),before=subject();
 if(demo)headers.set('Authorization','Bearer nyales-local-demo');
 else if(firebaseAuth?.currentUser)headers.set('Authorization',`Bearer ${await firebaseAuth.currentUser.getIdToken()}`);
 const session=currentDeviceSession();if(session)headers.set('X-Device-Session',session.session_token);
 const response=await fetch(url,{...init,headers,cache:'no-store'});
 if(before!==subject())throw new Error('Akun telah berubah. Muat ulang data untuk akun aktif.');
 if(!response.ok){const problem=await response.clone().json().catch(()=>({})) as {detail?:string;code?:string};
  if((response.status===401&&problem.code!=='REAUTH_REQUIRED')||['USER_NOT_PROVISIONED_OR_INACTIVE','MFA_REQUIRED'].includes(problem.code||''))window.dispatchEvent(new Event('nyales-session-expired'));
  throw new Error(problem.detail||problem.code||(response.status===403?'Aksi ini tidak diizinkan untuk akun Anda.':response.status===401?'Sesi berakhir. Silakan masuk kembali.':'Layanan belum tersedia. Silakan coba lagi.'));
 }
 return response;
}
async function ensureDeviceSession(){
 if(currentDeviceSession())return;const owner=subject();
 let deviceId=localStorage.getItem('nyales-device-id');if(!deviceId){deviceId=crypto.randomUUID();localStorage.setItem('nyales-device-id',deviceId)}
 const response=await apiFetch('/api/device-sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:deviceId})});
 const {data}=await response.json() as {data:{id:string;session_token:string;version:number}};
 if(owner!==subject())throw new Error('Akun telah berubah selama pendaftaran sesi.');
 sessionStorage.setItem(sessionKey,JSON.stringify({...data,subject:owner}));
}
const Context=createContext<{identity:Identity;logout:()=>Promise<void>;loggingOut:boolean}|null>(null);
export function useIdentity(){const value=useContext(Context);if(!value)throw new Error('Missing auth context');return value}
export function AuthGate({children}:{children:React.ReactNode}){
 const [config,setConfig]=useState<Config|null>(null),[identity,setIdentity]=useState<Identity|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[loggingOut,setLoggingOut]=useState(false);
 async function loadMe(){const owner=subject();await ensureDeviceSession();const response=await apiFetch('/api/me');const result=await response.json() as {data:Identity};if(owner===subject())setIdentity(result.data)}
 useEffect(()=>{let active=true;let unsubscribe=()=>{};
 fetch('/api/auth/config').then(r=>{if(!r.ok)throw new Error();return r.json() as Promise<Config>}).then(async c=>{
  if(!active)return;setConfig(c);
  if(c.mode==='local'){demo=sessionStorage.getItem('nyales-demo')==='1';if(demo)await loadMe();setLoading(false);return}
  const apiKey=import.meta.env.VITE_FIREBASE_API_KEY,projectId=import.meta.env.VITE_FIREBASE_PROJECT_ID,authDomain=import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  if(!c.configured||!apiKey||!projectId||!authDomain){setConfig({...c,configured:false});setLoading(false);return}
  firebaseAuth=getAuth(initializeApp({apiKey,projectId,authDomain}));await setPersistence(firebaseAuth,browserSessionPersistence);
  unsubscribe=onIdTokenChanged(firebaseAuth,async user=>{try{if(user)await loadMe();else setIdentity(null)}catch(e){setIdentity(null);setError((e as Error).message)}finally{if(active)setLoading(false)}});
 }).catch(e=>{if(active){setIdentity(null);setError((e as Error).message||'Tidak dapat memuat konfigurasi login. Muat ulang halaman untuk mencoba lagi.');setLoading(false)}});
 const expired=()=>{setIdentity(null);clearSession();demo=false;sessionStorage.removeItem('nyales-demo');setError('Sesi perangkat berakhir atau dicabut. Silakan masuk kembali.');if(firebaseAuth)void signOut(firebaseAuth)};window.addEventListener('nyales-session-expired',expired);
 return()=>{active=false;unsubscribe();window.removeEventListener('nyales-session-expired',expired)};
 },[]);
 useEffect(()=>{
  if(!identity)return;
  let active=true;
  const check=async()=>{if(document.visibilityState!=='visible')return;try{const response=await apiFetch('/api/me');const {data}=await response.json() as {data:Identity};if(active)setIdentity(data)}catch{/* API dispatches the expiry event; network failure preserves the current screen. */}};
  const visible=()=>{void check()};const timer=window.setInterval(visible,30000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible)};
 },[identity?.id]);
 async function login(kind:'demo'|'email'|'google'){
  setBusy(true);setError('');clearSession();try{
   if(kind==='demo'){demo=true;await loadMe();sessionStorage.setItem('nyales-demo','1')}
   else if(firebaseAuth){if(kind==='google')await signInWithPopup(firebaseAuth,new GoogleAuthProvider());else await signInWithEmailAndPassword(firebaseAuth,email,password);setPassword('')}
  }catch(e){demo=false;clearSession();setError((e as Error).message||'Tidak dapat masuk. Periksa akun dan koneksi Anda.')}finally{setBusy(false)}
 }
 async function logout(){
  if(loggingOut)return;setLoggingOut(true);
  let failed=false;const session=currentDeviceSession();
  try{if(session)await apiFetch('/api/device-sessions/'+session.id+'/revoke',{method:'POST',headers:{'Content-Type':'application/json','If-Match':`"${session.version}"`},body:JSON.stringify({reason:'Logout dari perangkat ini'})})}catch{failed=true}
  finally{clearSession();demo=false;sessionStorage.removeItem('nyales-demo');setIdentity(null);setPassword('');try{if(firebaseAuth)await signOut(firebaseAuth)}catch{failed=true}finally{setLoggingOut(false)}}
  if(failed)setError('Sudah keluar dari browser ini. Pencabutan sesi di server belum terkonfirmasi karena koneksi atau status sesi.');
 }

 if(loading)return <main className="login-page"><Loading>Memeriksa sesi NYALES…</Loading></main>;
 if(identity)return <Context.Provider key={identity.organization_id+':'+identity.id+':'+identity.role+':'+identity.area_ids.join(',')+':'+currentDeviceSession()?.id} value={{identity,logout,loggingOut}}>{children}</Context.Provider>;
 return <main className="login-page"><section className="login-card"><div className="brand"><img src="/brand/nyales-mark.svg" alt=""/><span>NYALES</span></div><h1>Selamat datang kembali.</h1><p className="muted">Kelola customer, aktivitas sales, dan pencapaian tim Anda.</p>{error&&<p role="alert" className="notice danger">{error}</p>}{config?.mode==='local'?<><p className="callout">Lingkungan pengembangan lokal · data contoh.</p><button className="button" disabled={busy} onClick={()=>login('demo')}>{busy?'Memeriksa akses…':'Masuk demo lokal'}</button></>:config?.configured?<form onSubmit={e=>{e.preventDefault();void login('email')}}><label className="full-field">Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="full-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button" disabled={busy} type="submit">{busy?'Memeriksa akses…':'Masuk'}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>login('google')}>Masuk dengan Google</button></form>:<p className="notice">Login belum dikonfigurasi. Hubungi administrator NYALES.</p>}</section></main>;
}
