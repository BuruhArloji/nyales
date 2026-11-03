import{Loading}from'./Loading';
import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {initializeApp,getApps} from 'firebase/app';
import {getAuth,onIdTokenChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut,browserSessionPersistence,setPersistence,getMultiFactorResolver,type MultiFactorError,type MultiFactorResolver,type User,type Auth} from 'firebase/auth';
import {AuthApiError,loginProblem,shouldExpireSession}from'./auth-errors';
import {TotpChallenge,TotpEnrollment}from'./auth-mfa';
type Identity={demo_data?:boolean;training_data?:boolean;bekasi_demo_data?:boolean;bekasi_demo_ready?:boolean;directory_data?:boolean;id:string;name:string;organization_id:string;role:string;capabilities:string[];area_ids:string[];scope:string};
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
  if(shouldExpireSession(response.status,problem.code||'',Boolean(currentDeviceSession())))window.dispatchEvent(new Event('nyales-session-expired'));
  throw new AuthApiError(problem.code||'REQUEST_FAILED',response.status,problem.detail||problem.code||(response.status===403?'Aksi ini tidak diizinkan untuk akun Anda.':response.status===401?'Sesi berakhir. Silakan masuk kembali.':'Layanan belum tersedia. Silakan coba lagi.'));
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
 const [config,setConfig]=useState<Config|null>(null),[identity,setIdentity]=useState<Identity|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[loggingOut,setLoggingOut]=useState(false);
 const [account,setAccount]=useState<User|null>(null),[pending,setPending]=useState<'activation'|'mfa'|null>(null),[resolver,setResolver]=useState<MultiFactorResolver|null>(null);
 const alive=useRef(true),attempt=useRef(0);
 function clearPending(){setPending(null);setResolver(null);setAccount(null)}
 async function loadMe(){
  const generation=++attempt.current,owner=subject();
  const current=()=>alive.current&&generation===attempt.current&&owner===subject();
  try{
   try{await ensureDeviceSession()}
   catch(e){
    if(!(e instanceof AuthApiError)||e.code!=='USER_NOT_PROVISIONED_OR_INACTIVE')throw e;
    // A configured, MFA-verified first admin may initialize an empty staging DB.
    try{await apiFetch('/api/auth/first-admin',{method:'POST'})}
    catch(setupError){if(setupError instanceof AuthApiError&&['NOT_FOUND','BOOTSTRAP_IDENTITY_DENIED'].includes(setupError.code))throw e;throw setupError}
    if(!current())return;await ensureDeviceSession();
   }
   const response=await apiFetch('/api/me'),result=await response.json() as {data:Identity};
   if(current()){setIdentity(result.data);setPending(null);setResolver(null);setError('');setNotice('')}
  }catch(e){
   if(!current())return;setIdentity(null);
   if(e instanceof AuthApiError&&['USER_NOT_PROVISIONED_OR_INACTIVE','MFA_REQUIRED'].includes(e.code)){
    clearSession();setAccount(firebaseAuth?.currentUser||null);setPending(e.code==='MFA_REQUIRED'?'mfa':'activation');setError('');
   }else setError(loginProblem(e));
  }finally{if(current())setLoading(false)}
 }
 useEffect(()=>{
  alive.current=true;let active=true;let unsubscribe=()=>{};const abort=new AbortController();
  fetch('/api/auth/config',{signal:abort.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<Config>}).then(async c=>{
   if(!active)return;setConfig(c);
   if(c.mode==='local'){demo=sessionStorage.getItem('nyales-demo')==='1';if(demo)await loadMe();if(active)setLoading(false);return}
   const apiKey=import.meta.env.VITE_FIREBASE_API_KEY,projectId=import.meta.env.VITE_FIREBASE_PROJECT_ID,authDomain=import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
   if(!c.configured||!apiKey||!projectId||!authDomain){setConfig({...c,configured:false});setLoading(false);return}
   const app=getApps().find(a=>a.name==='nyales-web')||initializeApp({apiKey,projectId,authDomain},'nyales-web');
   firebaseAuth=getAuth(app);await setPersistence(firebaseAuth,browserSessionPersistence);if(!active)return;
   unsubscribe=onIdTokenChanged(firebaseAuth,async user=>{
    if(!active)return;setAccount(user);
    if(user)await loadMe();else{attempt.current++;setIdentity(null);setPending(null);clearSession();setLoading(false)}
   });
  }).catch(e=>{if(active&&e.name!=='AbortError'){setIdentity(null);setError('Tidak dapat memuat konfigurasi login. Muat ulang halaman untuk mencoba lagi.');setLoading(false)}});
  const expired=()=>{attempt.current++;setIdentity(null);clearPending();clearSession();demo=false;sessionStorage.removeItem('nyales-demo');setError('Sesi perangkat berakhir atau dicabut. Silakan masuk kembali.');if(firebaseAuth)void signOut(firebaseAuth)};
  window.addEventListener('nyales-session-expired',expired);
  return()=>{active=false;alive.current=false;attempt.current++;abort.abort();unsubscribe();window.removeEventListener('nyales-session-expired',expired)};
 },[]);
 useEffect(()=>{
  if(!identity)return;let active=true;
  const check=async()=>{if(document.visibilityState!=='visible')return;try{const response=await apiFetch('/api/me'),result=await response.json() as {data:Identity};if(active)setIdentity(result.data)}catch{/* Access failures expire the context; temporary network failures preserve the screen. */}};
  const visible=()=>{void check()},timer=window.setInterval(visible,30000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible)};
 },[identity?.id]);
 async function login(kind:'demo'|'email'|'google'){
  setBusy(true);setError('');setNotice('');clearSession();setResolver(null);
  try{
   if(kind==='demo'){demo=true;await loadMe();if(subject()==='local:demo-management')sessionStorage.setItem('nyales-demo','1')}
   else if(firebaseAuth){
    if(kind==='google'){const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(firebaseAuth,provider)}
    else await signInWithEmailAndPassword(firebaseAuth,email,password);
   }
  }catch(e){
   demo=false;clearSession();
   if((e as {code?:string}).code==='auth/multi-factor-auth-required'&&firebaseAuth){setPending(null);setResolver(getMultiFactorResolver(firebaseAuth,e as MultiFactorError));setError('')}
   else setError(loginProblem(e));
  }finally{setPassword('');setBusy(false)}
 }
 async function logout(){
  if(loggingOut)return;setLoggingOut(true);attempt.current++;
  let failed=false;const session=currentDeviceSession();
  try{if(session)await apiFetch('/api/device-sessions/'+session.id+'/revoke',{method:'POST',headers:{'Content-Type':'application/json','If-Match':`"${session.version}"`},body:JSON.stringify({reason:'Logout dari perangkat ini'})})}catch{failed=true}
  finally{clearSession();demo=false;sessionStorage.removeItem('nyales-demo');setIdentity(null);clearPending();setPassword('');try{if(firebaseAuth)await signOut(firebaseAuth)}catch{failed=true}finally{setLoggingOut(false)}}
  if(failed)setError('Sudah keluar dari browser ini. Pencabutan sesi server belum terkonfirmasi.');
 }
 async function retry(){setLoading(true);setError('');await loadMe()}
 async function enrolled(){await logout();setError('');setNotice('Authenticator ditambahkan. Masuk kembali lalu verifikasi kode untuk membuka NYALES.')}
 if(loading)return <main className="login-page"><Loading>Memeriksa sesi NYALES…</Loading></main>;
 if(identity)return <Context.Provider key={identity.organization_id+':'+identity.id+':'+identity.role+':'+identity.area_ids.join(',')+':'+currentDeviceSession()?.id} value={{identity,logout,loggingOut}}>{children}</Context.Provider>;
 return <main className="login-page"><section className="login-card"><div className="brand"><img src="/brand/nyales-mark.svg" alt=""/><span>NYALES</span></div>
  {resolver?<TotpChallenge resolver={resolver} onComplete={()=>setResolver(null)} onCancel={logout}/>:pending==='mfa'&&account?<TotpEnrollment key={account.uid} user={account} onEnrolled={enrolled} onRetry={retry} onSignOut={logout}/>:pending==='activation'&&account?<>
   <h1>Akun menunggu aktivasi.</h1><p>Anda berhasil masuk dengan Google/Firebase. Administrator perlu menghubungkan akun ini ke organisasi dan role NYALES.</p><p className="muted">{account.email}</p><label className="full-field">ID akun<input className="auth-uid" readOnly value={account.uid} onFocus={e=>e.target.select()}/></label><p className="muted">ID ini dapat dibagikan kepada administrator. Jangan membagikan password atau kode Authenticator.</p>
   {error&&<p role="alert" className="notice danger">{error}</p>}<button className="button" disabled={busy} onClick={()=>void retry()}>Periksa akses kembali</button><button className="button secondary" disabled={loggingOut} onClick={()=>void logout()}>Gunakan akun lain</button>
  </>:<><h1>Masuk ke NYALES.</h1><p className="muted">Kelola customer, aktivitas sales, dan pencapaian tim Anda.</p>{error&&<p role="alert" className="notice danger">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}{config?.mode==='local'?<><p className="callout login-local-note"><strong>Kasir lokal · pilot staging</strong><br/>Masuk sebagai Management untuk meninjau workspace dan data pilot. Firebase belum digunakan pada lingkungan ini.</p><button className="button login-primary" disabled={busy} onClick={()=>void login('demo')}>{busy?'Menyiapkan sesi…':'Masuk sebagai Management'}</button></>:config?.configured?<form onSubmit={e=>{e.preventDefault();void login('email')}}><label className="full-field">Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="full-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button" disabled={busy} type="submit">{busy?'Memeriksa akses…':'Masuk'}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>void login('google')}>Masuk dengan Google</button></form>:<p className="notice">Login belum dikonfigurasi. Hubungi administrator NYALES.</p>}</>}
 </section></main>;
}
