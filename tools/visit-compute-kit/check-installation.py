"""Read-only, offline package/runtime checks. Does not install or start services."""
import hashlib,json,os,platform,re,shutil,struct,subprocess,sys
from pathlib import Path

def verify_manifest(root):
    root=Path(root).resolve()
    try:
        path=root/'MANIFEST.json'
        if path.is_symlink() or path.stat().st_size>262144:raise ValueError('MANIFEST_INVALID')
        manifest=json.loads(path.read_text(encoding='utf-8'))
        entries=manifest['files']
        if not isinstance(entries,list)or not 1<=len(entries)<=100:raise ValueError('MANIFEST_INVALID')
        failures=[];seen=set()
        for entry in entries:
            if not isinstance(entry,dict):raise ValueError('MANIFEST_ENTRY_INVALID')
            name=entry.get('path')
            if not isinstance(name,str)or not re.fullmatch(r'[A-Za-z0-9_./-]{1,300}',name)or name.startswith('/')or any(x in ('','..','.')for x in name.split('/'))or name.lower()in seen:
                raise ValueError('MANIFEST_PATH_INVALID')
            seen.add(name.lower());target=root
            for component in name.split('/'):
                target=target/component
                if target.is_symlink():raise ValueError('MANIFEST_LINK_DENIED')
            if not target.resolve().is_relative_to(root):raise ValueError('MANIFEST_PATH_INVALID')
            size=entry.get('bytes');digest=entry.get('sha256')
            if type(size)is not int or not 0<=size<=8*1024*1024 or not isinstance(digest,str)or not re.fullmatch('[a-f0-9]{64}',digest):raise ValueError('MANIFEST_ENTRY_INVALID')
            if not target.is_file():failures.append({'path':name,'code':'FILE_MISSING'});continue
            if target.stat().st_size!=size:failures.append({'path':name,'code':'FILE_SIZE_MISMATCH'});continue
            h=hashlib.sha256()
            with target.open('rb')as source:
                count=0
                while True:
                    block=source.read(65536)
                    if not block:break
                    count+=len(block)
                    if count>size:raise ValueError('FILE_CHANGED_DURING_CHECK')
                    h.update(block)
            if count!=size or h.hexdigest()!=digest:failures.append({'path':name,'code':'FILE_HASH_MISMATCH'})
        return {'status':'passed'if not failures else'failed','files_checked':len(entries),'failures':failures,'authenticity_verified':False}
    except (OSError,ValueError,KeyError,TypeError):
        return {'status':'failed','files_checked':0,'failures':[{'code':'PACKAGE_MANIFEST_INVALID_OR_UNREADABLE'}],'authenticity_verified':False}

def probe(command,args):
    try:
        result=subprocess.run([str(command),*args],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10,check=False,encoding='utf-8',env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
        return result.stdout.strip()[:1000] if result.returncode==0 else None
    except (OSError,subprocess.TimeoutExpired):return None

def check(root):
    root=Path(root).resolve();node=shutil.which('node');node_version=probe(node,['--version'])if node else None
    node_match=re.fullmatch(r'v(\d+)\.\d+\.\d+',node_version or'')
    executable=root/'.nyales-agent/solver-python'/('Scripts/python.exe'if os.name=='nt'else'bin/python')
    solver=probe(executable,['-c',"import ortools;print(ortools.__version__)"])if executable.is_file()else None
    integrity=verify_manifest(root)
    prepared=integrity['status']=='passed'and bool(node_match and int(node_match[1])>=24)and solver=='9.15.6755'
    return {'format':'nyales-compute-kit-check-1','package':integrity,'platform':platform.system(),'python_series':str(sys.version_info.major)+'.'+str(sys.version_info.minor),
      'python_64_bit':struct.calcsize('P')==8,'tested_python_series':'3.13','python_matches_tested_configuration':sys.version_info[:2]==(3,13)and struct.calcsize('P')==8,
      'node_version':node_version,'node_24_or_newer':bool(node_match and int(node_match[1])>=24),'npm_command_found':bool(shutil.which('npm')),
      'solver_version':solver,'solver_version_matches':solver=='9.15.6755','solver_executable_present':executable.is_file(),
      'docker_cli_found':bool(shutil.which('docker')),'docker_daemon_verified':False,'workspace_free_disk_bytes':shutil.disk_usage(root).free,
      'status':'local_solver_dependencies_detected'if prepared else'package_or_dependencies_need_setup','routing_graph_verified':False,'routing_process_verified':False,
      'web_integration_verified':False,'ready_for_real_planning':False,'network_requests':False,'installed_by_check':False,'services_started':False}

if __name__=='__main__':
    root=Path(__file__).resolve().parent
    report=check(root);print(json.dumps(report,indent=2))
    sys.exit(0 if report['package']['status']=='passed'else 1)
