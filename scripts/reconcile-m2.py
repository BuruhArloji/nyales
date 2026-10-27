from pathlib import Path
import sqlite3,json,hashlib
cons=[]
for n in ['before','after']:
 c=sqlite3.connect(':memory:');c.executescript(Path('test-results/'+n+'-m2.sql').read_text(encoding='utf-8-sig'));cons.append(c)
a,b=cons;results=[];allowed={'d1_migrations','target_plan','target_item','master_audit','master_idempotency','device_session','product','product_group','finance_epoch'}
for(name,)in a.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
 if name in allowed:continue
 cols=[r[1]for r in a.execute('PRAGMA table_info('+name+')')];q='SELECT '+','.join('"'+n+'"'for n in cols)+' FROM "'+name+'"';before=sorted(json.dumps(r)for r in a.execute(q));after=sorted(json.dumps(r)for r in b.execute(q));results.append({'table':name,'before_rows':len(before),'after_rows':len(after),'identical':before==after,'sha256_before':hashlib.sha256('\n'.join(before).encode()).hexdigest(),'sha256_after':hashlib.sha256('\n'.join(after).encode()).hexdigest()})
additions=[]
for name in allowed-{'device_session','finance_epoch'}:
 cols=[r[1]for r in a.execute('PRAGMA table_info('+name+')')];q='SELECT '+','.join('"'+n+'"'for n in cols)+' FROM "'+name+'"';before=set(a.execute(q));after=set(b.execute(q));additions.append({'table':name,'original_rows_unchanged':before.issubset(after),'added_rows':len(after-before)})
fk=list(b.execute('PRAGMA foreign_key_check'));integrity=b.execute('PRAGMA integrity_check').fetchone()[0]
j={'status':'passed'if all(r['identical']for r in results)and all(r['original_rows_unchanged']for r in additions)and not fk and integrity=='ok'else'failed','protected_original_tables':results,'append_only_changes':additions,'expected_mutable_tables':['device_session last seen/revoke','finance_epoch invalidation counter'],'foreign_key_violations':fk,'integrity_check':integrity,'scope':'Local D1 exports before 0018 vs after 0030. New M2 tables expected. Original rows compared exactly; no raw records exposed in report.'}
Path('test-results/m2-reconciliation.json').write_text(json.dumps(j,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':j['status'],'exact_tables':len(results),'append_only_tables':len(additions),'foreign_key_violations':len(fk)}));assert j['status']=='passed'
