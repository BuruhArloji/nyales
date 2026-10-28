export class AuthApiError extends Error{
 constructor(readonly code:string,readonly status:number,message:string){super(message);this.name='AuthApiError'}
}
export function shouldExpireSession(status:number,code:string,hasDeviceSession:boolean){
 return status===401&&code!=='REAUTH_REQUIRED'||hasDeviceSession&&['USER_NOT_PROVISIONED_OR_INACTIVE','MFA_REQUIRED'].includes(code);
}
export function loginProblem(error:unknown){
 const code=(error as {code?:string})?.code;
 const messages:Record<string,string>={
  'auth/invalid-credential':'Email atau password tidak sesuai.',
  'auth/invalid-login-credentials':'Email atau password tidak sesuai.',
  'auth/wrong-password':'Email atau password tidak sesuai.',
  'auth/user-not-found':'Email atau password tidak sesuai.',
  'auth/invalid-verification-code':'Kode Authenticator tidak sesuai. Periksa kode terbaru dan coba lagi.',
  'auth/code-expired':'Kode sudah kedaluwarsa. Gunakan kode terbaru dari Authenticator.',
  'auth/session-expired':'Sesi verifikasi berakhir. Silakan masuk kembali.',
  'auth/requires-recent-login':'Untuk melanjutkan, keluar lalu masuk kembali.',
  'auth/unverified-email':'Verifikasi email terlebih dahulu sebelum mengaktifkan Authenticator.',
  'auth/operation-not-allowed':'Metode login atau Authenticator belum diaktifkan pada proyek Firebase. Hubungi administrator.',
  'auth/unsupported-first-factor':'Metode login ini belum mendukung Authenticator. Gunakan akun Google yang terdaftar.',
  'auth/admin-restricted-operation':'Aktivasi Authenticator masih dibatasi oleh pengaturan proyek. Hubungi administrator.',
  'auth/too-many-requests':'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
  'auth/network-request-failed':'Koneksi terputus. Periksa internet lalu coba lagi.',
  'auth/popup-blocked':'Browser memblokir jendela login. Izinkan popup untuk NYALES lalu coba lagi.',
  'auth/popup-closed-by-user':'Jendela login ditutup. Silakan coba lagi.',
  'auth/cancelled-popup-request':'Proses login sebelumnya dibatalkan. Silakan coba lagi.',
 };
 if(error instanceof AuthApiError)return error.message;
 return code&&messages[code]||'Proses masuk belum berhasil. Silakan coba lagi atau hubungi administrator.';
}
export const validTotpCode=(value:string)=>/^\d{6}$/.test(value);
