// Local browser fixture only. It is never imported into the application build.
const state={enrolled:false,mfa:false,disabled:false,unsupported:false};
(globalThis as any).__authFixture=state;
const listeners=new Set<(user:any)=>unknown>();
const auth:{currentUser:any}={currentUser:null};
const notify=()=>{for(const fn of listeners)void fn(auth.currentUser)};
const user={uid:'fixture-owner',email:'owner@example.test',emailVerified:true,getIdToken:async()=>state.mfa?'fixture-mfa':'fixture-primary',reload:async()=>{}};
export const initializeApp=(config:any,name:string)=>({name,options:config});
const apps:any[]=[];export const getApps=()=>apps;
export const getAuth=()=>auth;
export const browserSessionPersistence={};export const setPersistence=async()=>{};
export const onIdTokenChanged=(_auth:any,fn:(u:any)=>unknown)=>{listeners.add(fn);queueMicrotask(()=>{if(listeners.has(fn))void fn(auth.currentUser)});return()=>listeners.delete(fn)};
export class GoogleAuthProvider{setCustomParameters(){}}
async function signIn(){if(state.enrolled)throw{code:'auth/multi-factor-auth-required'};auth.currentUser=user;notify();return{user}}
export const signInWithPopup=signIn,signInWithEmailAndPassword=signIn;
export const signOut=async()=>{auth.currentUser=null;state.mfa=false;notify()};
export const multiFactor=(_user:any)=>({enrolledFactors:state.enrolled?[{uid:'fixture-factor',factorId:'totp'}]:[],getSession:async()=>({}),enroll:async(assertion:any)=>{if(assertion.code!=='111111')throw{code:'auth/invalid-verification-code'};state.enrolled=true}});
export const TotpMultiFactorGenerator={FACTOR_ID:'totp',generateSecret:async()=>{if(state.disabled)throw{code:'auth/operation-not-allowed'};return{secretKey:'JBSWY3DPEHPK3PXP',generateQrCodeUrl:()=> 'otpauth://totp/NYALES%20fixture?secret=JBSWY3DPEHPK3PXP&issuer=NYALES'}},assertionForEnrollment:(_secret:any,code:string)=>({code}),assertionForSignIn:(_uid:string,code:string)=>({code})};
export const getMultiFactorResolver=()=>({session:{},hints:[{uid:'fixture-factor',factorId:state.unsupported?'phone':'totp',displayName:'NYALES Authenticator'}],resolveSignIn:async(assertion:any)=>{if(assertion.code!=='111111')throw{code:'auth/invalid-verification-code'};state.mfa=true;auth.currentUser=user;notify();return{user}}});
export const sendEmailVerification=async()=>{};
