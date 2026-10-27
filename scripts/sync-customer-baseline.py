from pathlib import Path
import json,re
source=Path(r'C:\Users\didik.priyo.id\.codex\visualizations\2026\10\16\01a144ba-c37d-7eb0-a007-2298109365e1')
out=Path('docs/specifications')
def load(name):return json.loads((source/name).read_text(encoding='utf-8-sig'))
def save(name,obj):
 text=json.dumps(obj,ensure_ascii=False,indent=2)+'\n' if not isinstance(obj,str) else obj
 (out/name).write_text(text,encoding='utf-8');(source/name).write_text(text,encoding='utf-8')
def versions(s):
 for a,b in [('v1_9','v1_10'),('v1_1','v1_2'),('v1.9','v1.10'),('Versi 1.9','Versi 1.10'),('versi 1.9','versi 1.10')]:s=s.replace(a,b)
 return re.sub(r'v1\.1(?![0-9])','v1.2',s)
note='Keputusan 18 Oktober 2026: pelanggan/toko adalah entitas utama, satu pelanggan = satu lokasi. Lapisan Account bisnis/legal dihapus dari schema aktif, UI, API dan import. Kontak, assignment kanal, transaksi, target dan histori mengacu langsung ke pelanggan. Kode ERP opsional pada input manual, wajib dan unik dalam organisasi untuk import pelanggan. Pengaturan tetap hanya Management/NSM. Istilah account untuk identitas login, kuota provider atau Android developer tidak berarti entitas pelanggan.\n\nMigrasi lokal 0017 menyimpan master dan relasi Account lama sebagai snapshot audit, menghapus tabel account/kolom account_id, dan mewajibkan validasi ulang batch import pelanggan lama. Dokumen ini menggantikan baseline sebelumnya untuk arsitektur pelanggan; status produksi tetap terpisah.\n'
prd=(source/'PRD_Sales_Lapangan_dan_Telesales_v1_9.md').read_text(encoding='utf-8-sig')
replacements={
'Pelanggan berupa account atau outlet; satu badan usaha dapat mempunyai beberapa outlet dan beberapa contact person.':'Pelanggan/toko adalah entitas utama; satu record mewakili satu lokasi dan dapat mempunyai beberapa contact person. Tidak ada entitas induk Account bisnis/legal.',
'100.000 account atau outlet':'100.000 pelanggan',
'Account, outlet, kontak, owner, territory, deduplikasi':'Pelanggan/toko, kontak, owner, territory, deduplikasi',
'Hierarki account dan enrichment':'Enrichment pelanggan',
'Import/input account, outlet dan kontak':'Import/input pelanggan/toko dan kontak',
'Owner account':'Owner pelanggan',
'Pisahkan legal account, outlet, dan contact person. Field inti outlet:':'Gunakan pelanggan/toko sebagai entitas utama satu lokasi dan pisahkan contact person. Tidak ada tabel atau relasi induk Account bisnis/legal. Field inti pelanggan:',
'tidak otomatis berarti account sama':'tidak otomatis berarti pelanggan sama',
'account/customer owner':'customer owner',
'target account':'target pelanggan',
'Satu account dapat memiliki beberapa kontak, tetapi batas frekuensi tetap diperiksa pada level kontak dan account.':'Satu pelanggan dapat memiliki beberapa kontak, tetapi batas frekuensi tetap diperiksa pada level kontak dan pelanggan.',
'nama account atau kontak':'nama pelanggan atau kontak',
'untuk account dan outlet yang sama':'untuk pelanggan/lokasi yang sama',
'Account unik dengan keluhan kontak / account unik yang dikontak':'Pelanggan unik dengan keluhan kontak / pelanggan unik yang dikontak',
'Account outlet contact':'Pelanggan dan kontak',
'account/outlet/contact':'customer_outlet/contact',
'Account pindah owner':'Pelanggan pindah owner',
'jumlah account/outlet':'jumlah pelanggan',
'Nama kerja produk: **Sales Operations Hub**. Nama ini dapat diganti tanpa mengubah ruang lingkup.':'Nama produk: **NYALES**.',
'16 Oktober 2026 | Bahasa Indonesia':'18 Oktober 2026 | Bahasa Indonesia'
}
for a,b in replacements.items():prd=prd.replace(a,b)
prd=versions(prd);prd=prd.replace('## 1 Keputusan produk','## Perubahan arsitektur pelanggan\n\n'+note+'\n## 1 Keputusan produk',1)
save('PRD_Sales_Lapangan_dan_Telesales_v1_10.md',prd)
erd=load('ERD_Sales_Operations_Hub_v1_1.json');erd['version']='1.2';erd['baseline']='PRD v1.10';erd['architecture_decision']=note;erd['tables'].pop('account',None)
erd['tables']['customer_outlet']['fields']=erd['tables']['customer_outlet']['fields'].replace('text:account_id:FK ','');erd['tables']['customer_outlet']['notes']='Satu pelanggan/toko = satu lokasi. Tidak ada parent Account bisnis/legal. Area saat ini dan histori assignment dipisahkan; invoice dan fakta historis mempertahankan atribusi asal.'
erd['relations']=[r for r in erd['relations'] if r.get('parent')!='account' and r.get('child')!='account' and r.get('fk')!='account_id']
save('ERD_Sales_Operations_Hub_v1_2.json',erd)
md=['# ERD NYALES v1.2','','Acuan PRD v1.10. Rancangan produk lengkap; schema implementasi lokal ditentukan migrations dan erd-m1-delta.json. Tidak semua tabel rancangan sudah dibangun.','',note]
for group in dict.fromkeys(t['group'] for t in erd['tables'].values()):
 names=[name for name,t in erd['tables'].items() if t['group']==group];md+=['## '+group,'','```mermaid','erDiagram','    direction TB']
 for name in names:
  md+=['    '+name+' {']
  for f in erd['tables'][name]['fields'].split():
   parts=f.split(':');md+=['        '+' '.join(parts)]
  md+=['    }']
 for r in erd['relations']:
  if r['child'] in names:md+=['    '+r['parent']+(' |o--o{ ' if r.get('optional') else ' ||--o{ ')+r['child']+' : '+r.get('label',r['fk'])]
 md+=['```','','| Tabel | Catatan |','|---|---|']+['| '+name+' | '+erd['tables'][name]['notes'].replace('|','/')+' |' for name in names]+['']
md+=['## Constraints','','```json',json.dumps(erd['constraints'],ensure_ascii=False,indent=2),'```',''];save('ERD_Sales_Operations_Hub_v1_2.md','\n'.join(md))
def strip_accounts(o):
 if isinstance(o,dict):
  return {k:strip_accounts(v) for k,v in o.items() if k not in ['account_id','account_code','Account','AccountWrite'] and not k.startswith('/accounts') and not k.startswith('/api/accounts')}
 if isinstance(o,list):return [strip_accounts(v) for v in o if v not in ['account_id','account_code'] ] if all(not isinstance(v,(dict,list)) for v in o) else [strip_accounts(v) for v in o]
 if isinstance(o,str):return o.replace('same area/account','same area')
 return o
api=strip_accounts(load('Sales_Operations_API_v1_1.openapi.json'));api['info']['version']='1.2';api['info']['title']='NYALES Sales Operations API';api['info']['description']=api['info'].get('description','')+'\n'+note+'Full product planning contract. Local implemented /api slices are specified separately; this contract is not a deployment claim.'
save('Sales_Operations_API_v1_2.openapi.json',api)
api_md=versions((source/'Kontrak_API_Sales_Operations_v1_1.md').read_text(encoding='utf-8-sig'));api_md='\n'.join(l for l in api_md.splitlines() if '`/accounts' not in l);api_md=api_md.replace('## 1. Konvensi','## Perubahan pelanggan\n\n'+note+'\nKontrak produk penuh memakai base path rancangan /api/v1; implementasi lokal aktif memakai /api dan slice kontrak di repository.\n\n## 1. Konvensi',1);save('Kontrak_API_Sales_Operations_v1_2.md',api_md)
backlog=load('Backlog_Pembangunan_Web_v1_1.json');backlog['version']='1.2';backlog['date']='2026-10-18';backlog['baseline']='PRD v1.10 / ERD v1.2 / API v1.2';backlog['architecture_decision']=note
status=json.loads(Path('docs/M1_STATUS.json').read_text(encoding='utf-8-sig'));by_id={x['id']:x for x in status['items']}
for item in backlog['items']:
 item['api_operations']=[op for op in item['api_operations'] if ' /accounts' not in op];item['data_entities']=[t for t in item['data_entities'] if t!='account'];item['acceptance']=item['acceptance'].replace('PRD v1.9','PRD v1.10').replace('account switch','pergantian akun login')
 if item['id']=='WEB-012':item['title']='Master pelanggan/toko dan kontak';item['acceptance']='Satu pelanggan/toko satu lokasi; tidak ada lapisan Account bisnis/legal. Input manual langsung nama, alamat dan area; kode ERP opsional. Kontak/nomor dinormalisasi. Koordinat hilang ditandai tanpa mengurangi total pelanggan. Hanya Management/NSM mengubah pengaturan. Histori invoice, assignment dan alias tetap utuh.'
 if item['id']=='WEB-013':item['acceptance']+=' Import pelanggan hanya membutuhkan kode ERP unik, nama, alamat dan area aktif; batch schema lama wajib divalidasi ulang.'
 if item['id'] in by_id:
  live=by_id[item['id']];item['status']='Implemented locally';item['acceptance_status']=live['acceptance_status'];item['gates']=live['gates'];item['evidence']=['docs/M1_STATUS.md','docs/BUILD_STATUS.md'];item['specification_status']='Reviewed; local implementation, production acceptance separate'
save('Backlog_Pembangunan_Web_v1_2.json',backlog)
md=['# Backlog Pembangunan Web NYALES v1.2','','18 Oktober 2026. Acuan PRD v1.10, ERD/API v1.2. Implementasi lokal dan acceptance produksi dibedakan. Item di luar M1 belum otomatis selesai.','',note]
for item in backlog['items']:
 md+=['## '+item['id']+' - '+item['title'],'',f"Milestone: {item['milestone']} | Prioritas: {item['priority']} | Status: {item['status']}",'','**Dependensi:** '+', '.join(item['dependencies']),'','**Deliverable:** '+item['deliverable'],'','**Acceptance:** '+item['acceptance'],'','**Requirements:** '+', '.join(item['requirements']),'','**API:** '+', '.join('`'+x+'`' for x in item['api_operations']),'','**Data:** '+', '.join('`'+x+'`' for x in item['data_entities']),'']
 if 'gates' in item:md+=['**Gate produksi:** '+'; '.join(item['gates']) if item['gates'] else '**Verifikasi lokal:** lulus; UAT produksi terpisah.','']
save('Backlog_Pembangunan_Web_v1_2.md','\n'.join(md))
# Implemented API slices have precedence for local routes.
for path in out.glob('*.openapi.json'):
 if 'v1_2' in path.name:continue
 d=strip_accounts(json.loads(path.read_text(encoding='utf-8-sig')))
 if path.name.startswith('customer-api'):d['info']['version']='0.12.1';d['info']['description']+=' Customer is the primary entity (one site); account business layer removed in migration 0017. Legacy snapshot audits remain historical only.'
 path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
delta=json.loads((out/'erd-m1-delta.json').read_text(encoding='utf-8-sig'));delta['baseline']='ERD v1.2';delta['migrations']=list(dict.fromkeys(delta['migrations']+['0017_remove_customer_accounts.sql']));delta['customer_architecture']={'primary_entity':'customer_outlet','cardinality':'one customer = one physical location','removed_table':'account','removed_column':'customer_outlet.account_id','preservation':'master_audit immutable before_json snapshots; raw physical fact IDs unchanged','import_schema_version':2};(out/'erd-m1-delta.json').write_text(json.dumps(delta,indent=2)+'\n',encoding='utf-8')
status['automated_tests']=48;status['baseline']=backlog['baseline'];status['architecture']='Customer primary, no Account business layer; migration0017 applied locally'
for item in status['items']:
 if item['id']=='WEB-012':item['title']='Master pelanggan/toko dan kontak';item['baseline_acceptance']=next(x['acceptance'] for x in backlog['items'] if x['id']=='WEB-012');item['evidence'].append('test-results/account-removal-reconciliation.json')
Path('docs/M1_STATUS.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=Path('docs/M1_STATUS.md');s=p.read_text(encoding='utf-8').replace('Master account, outlet dan contact','Master pelanggan/toko dan kontak');s+='\n## Arsitektur pelanggan saat ini\n\n'+note+'\n48 tes otomatis lulus. Rekonsiliasi migrasi: 13 pelanggan, 6 kontak, 6 invoice tetap sama; 11 Account lama tersimpan pada audit. Bukti: test-results/account-removal-reconciliation.json.\n';p.write_text(s,encoding='utf-8')
p=Path('README.md');s=p.read_text(encoding='utf-8');s=s.replace('PRD v1.9, ERD v1.1, API v1.1, backlog web v1.1','PRD v1.10, ERD v1.2, API v1.2, backlog web v1.2');s=s.replace('Customer menyediakan master Account, Outlet dan Kontak dengan form popup.','Menu Pelanggan menyediakan master pelanggan/toko dan kontak dengan form popup, tanpa lapisan Account bisnis/legal.');s=s.replace('Migrasi menandai legal account/kode lama yang perlu review.','Migrasi 0017 menyimpan Account lama sebagai audit dan menghapus dependensi aktifnya.');s=s.replace('Customer perlu kode ERP unik, account legal dan area yang sudah terdaftar; import tidak membuat account/owner otomatis.','Import pelanggan memerlukan kode ERP unik, nama, alamat dan area aktif; owner ditetapkan melalui alur distribusi.');s=s.replace('Seluruh migrations (sampai0011)','Seluruh migrations (sampai0017)').replace('seluruh migrations (sampai0011)','seluruh migrations (sampai0017)').replace('migrations sampai0016','migrations sampai0017');s=s.replace('Import transaksi nyata, target/insentif server, dan Android belum dibangun.','Pipeline import invoice lokal tersedia; integrasi ERP nyata, target/insentif server, dan Android belum selesai.');s+='\n## Baseline aktif\n\nLihat [daftar spesifikasi](docs/specifications/README.md). Versi lama tetap menjadi arsip; aturan pelanggan yang berlaku mengikuti PRD v1.10 dan migrasi 0017.\n';p.write_text(s,encoding='utf-8')
(out/'README.md').write_text('''# Baseline spesifikasi NYALES aktif

18 Oktober 2026. Menggantikan PRD v1.9, ERD/API/backlog v1.1 pada keputusan pelanggan.

- [PRD v1.10](PRD_Sales_Lapangan_dan_Telesales_v1_10.md)
- [ERD v1.2](ERD_Sales_Operations_Hub_v1_2.md), [JSON](ERD_Sales_Operations_Hub_v1_2.json)
- [Kontrak API v1.2](Kontrak_API_Sales_Operations_v1_2.md), [OpenAPI](Sales_Operations_API_v1_2.openapi.json)
- [Backlog v1.2](Backlog_Pembangunan_Web_v1_2.md), [JSON](Backlog_Pembangunan_Web_v1_2.json)

Dokumen lengkap adalah rancangan produk. Slice `*.web*.openapi.json` dan `finance-map-api.m1.openapi.json` menjelaskan implementasi `/api` saat ini. Full product `/api/v1` adalah kontrak rancangan, belum klaim deployment. Migrations adalah DDL implementasi lokal. Status/gate terbaru ada di `../M1_STATUS.md`.

Satu pelanggan/toko = satu lokasi. Tidak ada Account bisnis/legal aktif. Data autentikasi akun pengguna tetap terpisah. Original import dan audit historis dapat memuat field Account lama untuk provenance, tidak dapat menghidupkan kembali relasi tersebut. Batch pelanggan schema1 harus divalidasi ulang menjadi schema2 sebelum commit.
''',encoding='utf-8')
print('Created full baseline PRD1.10 / ERD1.2 / API1.2 / backlog1.2 and updated local slices/status/README.')
