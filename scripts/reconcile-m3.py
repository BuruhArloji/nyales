from pathlib import Path
import sqlite3,json,hashlib
cs=[]
for n in ['before','after']:
 c=sqlite3.connect(':memory:');c.executescript(Path('test-results/'+n+'-m3.sql').read_text(encoding='utf-8-sig'));cs.append(c)
a,b=cs;tables=[]
for(name,)in a.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
 cols=[r[1]for r in a.execute('PRAGMA table_info('+name+')')];q='SELECT '+','.join('"'+n+'"'for n in cols)+' FROM "'+name+'"';ar={json.dumps(r,ensure_ascii=True)for r in a.execute(q)};br={json.dumps(r,ensure_ascii=True)for r in b.execute(q)}
 tables.append({'table':name,'before_rows':len(ar),'after_rows':len(br),'original_rows_preserved':ar.issubset(br),'exact':ar==br,'added_rows':len(br-ar),'sha256_before':hashlib.sha256('\n'.join(sorted(ar)).encode()).hexdigest(),'sha256_after':hashlib.sha256('\n'.join(sorted(br)).encode()).hexdigest()})
new=[r[0]for r in b.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")if not a.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?",(r[0],)).fetchone()];fk=list(b.execute('PRAGMA foreign_key_check'));integrity=b.execute('PRAGMA integrity_check').fetchone()[0]
j={'status':'passed'if all(t['original_rows_preserved']for t in tables)and not fk and integrity=='ok'else'failed','tables':tables,'new_m3_tables':new,'foreign_key_violations':fk,'integrity_check':integrity,'scope':'All pre-M3 table columns/rows compared exactly or as append-only set against before/after local D1 export. Schema-added columns ignored in this row comparison; migration DDL tested separately. No raw secrets or records printed.'}
Path('test-results/m3-reconciliation.json').write_text(json.dumps(j,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':j['status'],'original_tables':len(tables),'exact_tables':sum(t['exact']for t in tables),'append_only_tables':sum(not t['exact']for t in tables),'new_tables':len(new),'foreign_key_violations':len(fk),'integrity':integrity}));assert j['status']=='passed'
