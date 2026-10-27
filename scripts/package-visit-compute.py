"""Explicit source allowlist only; never packages credentials, local databases or customer files."""
import sys,json,hashlib,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
entries=[
 'src/agent/daily-files.ts','src/agent/daily-planner.ts','src/agent/daily-solver.ts',
 'src/agent/graph-installation.ts','src/agent/osrm-client.ts','src/server/visit-generator-protocol.ts',
 'src/shared/visit-generator.ts','src/shared/boundaries.ts','src/shared/visit-agent-proof.ts',
 'src/solver/daily.py','src/solver/requirements.txt','src/solver/requirements.lock.txt','scripts/visit-daily.ts','scripts/visit-solver-setup.py']
files={name:(root/name).read_bytes() for name in entries}
for name in ('package.json','package-lock.json','README.md','START-HERE.md','check-installation.py','start-osrm.sh'):
    files[name]=(root/'tools/visit-compute-kit'/name).read_bytes()
manifest={'format':'nyales-visit-compute-kit-1','revision':2,'date':'2026-10-26','classification':'source-only-unprovisioned',
          'credentials_included':False,'customer_data_included':False,'graphs_included':False,'files':[
          {'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in sorted(files.items())]}
files['MANIFEST.json']=(json.dumps(manifest,indent=2)+'\n').encode()
if len(sys.argv)!=2:raise SystemExit('Usage: python scripts/package-visit-compute.py NEW_ZIP_PATH')
output=Path(sys.argv[1]).resolve();output.parent.mkdir(parents=True,exist_ok=True)
with output.open('xb') as destination:
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        for name,data in sorted(files.items()):archive.writestr(name,data)
print(json.dumps({'output':str(output),'files':len(files),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
 'credentials_included':False,'customer_data_included':False,'graphs_included':False}))
