import React,{useEffect,useRef,useState}from'react';
import {multiFactor,TotpMultiFactorGenerator,sendEmailVerification,type User,type MultiFactorResolver,type TotpSecret}from'firebase/auth';
import QRCode from'qrcode';
import {loginProblem,validTotpCode}from'./auth-errors';

export function TotpChallenge({resolver,onComplete,onCancel}:{resolver:MultiFactorResolver;onComplete:()=>void;onCancel:()=>Promise<void>}){
 const factors=resolver.hints.filter(f=>f.factorId===TotpMultiFactorGenerator.FACTOR_ID);
 const [factor,setFactor]=useState(factors[0]?.uid||''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 async function verify(event:React.FormEvent){
  event.preventDefault();if(busy||!validTotpCode(code)||!factors.some(f=>f.uid===factor))return;
  setBusy(true);setError('');
  try{await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor,code));if(alive.current){setCode('');onComplete()}}
  catch(e){if(alive.current){setCode('');setError(loginProblem(e))}}
  finally{if(alive.current)setBusy(false)}
 }
 return <><h1>Verifikasi masuk.</h1><p>Masukkan kode enam digit dari aplikasi Authenticator Anda.</p>{error&&<p role="alert" className="notice danger">{error}</p>}{factors.length?<form onSubmit={verify}>{factors.length>1&&<label className="full-field">Authenticator<select value={factor} onChange={e=>{setFactor(e.target.value);setCode('')}}>{factors.map((f,i)=><option key={f.uid} value={f.uid}>{f.displayName||`Authenticator ${i+1}`}</option>)}</select></label>}<label className="full-field">Kode Authenticator<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button className="button" disabled={busy||!validTotpCode(code)}>{busy?'Memverifikasi…':'Verifikasi dan masuk'}</button></form>:<p role="alert" className="notice">Akun ini memakai metode verifikasi yang belum didukung di NYALES. Hubungi administrator untuk pemulihan akses.</p>}<button type="button" className="button secondary" disabled={busy} onClick={()=>void onCancel()}>Batalkan masuk</button></>;
}

export function TotpEnrollment({user,onEnrolled,onRetry,onSignOut}:{user:User;onEnrolled:()=>Promise<void>;onRetry:()=>Promise<void>;onSignOut:()=>Promise<void>}){
 const [secret,setSecret]=useState<TotpSecret|null>(null),[qr,setQr]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const epoch=useRef(0);useEffect(()=>()=>{epoch.current++},[user.uid]);
 const alreadyEnrolled=multiFactor(user).enrolledFactors.length>0;
 async function begin(){
  if(busy||!user.emailVerified||alreadyEnrolled)return;
  const generation=++epoch.current;setBusy(true);setError('');
  try{const session=await multiFactor(user).getSession(),generated=await TotpMultiFactorGenerator.generateSecret(session);
   const data=await QRCode.toDataURL(generated.generateQrCodeUrl(user.email||user.uid,'NYALES'),{width:240,margin:2,errorCorrectionLevel:'M'});
   if(generation===epoch.current){setSecret(generated);setQr(data);setCode('')}
  }catch(e){if(generation===epoch.current)setError(loginProblem(e))}
  finally{if(generation===epoch.current)setBusy(false)}
 }
 async function enroll(event:React.FormEvent){
  event.preventDefault();if(!secret||busy||!validTotpCode(code))return;
  const generation=epoch.current;setBusy(true);setError('');
  try{await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret,code),'NYALES Authenticator');
   if(generation!==epoch.current)return;setSecret(null);setQr('');setCode('');await onEnrolled();
  }catch(e){if(generation===epoch.current){setCode('');setError(loginProblem(e))}}
  finally{if(generation===epoch.current)setBusy(false)}
 }
 async function verifyEmail(){setBusy(true);setError('');try{await sendEmailVerification(user);setNotice('Email verifikasi dikirim. Buka tautannya, lalu periksa kembali.')}catch(e){setError(loginProblem(e))}finally{setBusy(false)}}
 async function refreshEmail(){setBusy(true);setError('');try{await user.reload();await user.getIdToken(true);await onRetry()}catch(e){setError(loginProblem(e))}finally{setBusy(false)}}
 return <><h1>Amankan akun admin.</h1><p>Akun Management dan Nasional Sales Manager memerlukan Authenticator sebelum dapat membuka data NYALES.</p><p className="muted">{user.email}</p>{error&&<p role="alert" className="notice danger">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
  {!user.emailVerified?<><p className="notice">Email akun belum terverifikasi.</p><button className="button" disabled={busy} onClick={()=>void verifyEmail()}>Kirim email verifikasi</button><button className="button secondary" disabled={busy} onClick={()=>void refreshEmail()}>Periksa verifikasi email</button></>:alreadyEnrolled?<><p className="notice">Authenticator sudah terpasang. Masuk kembali dan verifikasi kode untuk melanjutkan.</p><button className="button" disabled={busy} onClick={()=>void onSignOut()}>Keluar untuk masuk kembali</button></>:secret?<form onSubmit={enroll}><p>Pindai QR ini di Google Authenticator atau aplikasi Authenticator Anda.</p><img className="auth-qr" src={qr} width="240" height="240" alt="QR untuk menambahkan NYALES ke Authenticator"/><details className="auth-secret"><summary>Masukkan kunci secara manual</summary><code>{secret.secretKey}</code></details><label className="full-field">Kode Authenticator<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button className="button" disabled={busy||!validTotpCode(code)}>{busy?'Mengaktifkan…':'Aktifkan Authenticator'}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>{epoch.current++;setSecret(null);setQr('');setCode('')}}>Batal</button></form>:<button className="button" disabled={busy} onClick={()=>void begin()}>{busy?'Menyiapkan…':'Siapkan Authenticator'}</button>}
  {!alreadyEnrolled&&<button className="button secondary" disabled={busy} onClick={()=>void onSignOut()}>Keluar</button>}
 </>;
}
