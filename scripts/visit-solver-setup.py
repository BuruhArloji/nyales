"""User-local solver installation. Does not install WSL, Docker, services or OS packages."""
import sys,subprocess,venv,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
venv_path=root/'.nyales-agent'/'solver-python'
python=venv_path/('Scripts/python.exe' if sys.platform=='win32' else 'bin/python')
if not python.exists():
    if venv_path.exists():raise SystemExit('PARTIAL_SOLVER_ENVIRONMENT_REQUIRES_OPERATOR_REVIEW')
    venv_path.parent.mkdir(parents=True,exist_ok=True)
    venv.EnvBuilder(with_pip=True).create(venv_path)
subprocess.run([str(python),'-m','pip','install','--only-binary=:all:','-r',str(root/'src/solver/requirements.lock.txt')],check=True)
subprocess.run([str(python),'-c',"import ortools,json;print(json.dumps({'solver':'ortools','version':ortools.__version__,'global_python_modified':False}))"],check=True)
print(json.dumps({'python':str(python),'os_features_installed':False,'graphs_downloaded':False}))
