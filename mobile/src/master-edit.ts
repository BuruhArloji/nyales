export type MasterNamePayload={name:string;timezone:string};
export function masterNamePayload(name:string,timezone:string):MasterNamePayload {
 const n=name.trim(),tz=timezone.trim();if(!n||n.length>120)throw Error('Nama wajib diisi, maksimal 120 karakter.');
 if(!tz||tz.length>100)throw Error('Zona waktu wajib diisi.');
 try{new Intl.DateTimeFormat('id-ID',{timeZone:tz}).format(new Date())}catch{throw Error('Zona waktu tidak dikenali. Contoh: Asia/Jakarta.');}
 return {name:n,timezone:tz};
}
