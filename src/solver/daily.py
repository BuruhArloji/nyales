"""Bounded one-rep/day OR-Tools CP-SAT kernel. No network or database access.
Travel is supplied by the validated road-matrix adapter; null edges are forbidden.
"""
import json,sys,time
from ortools.sat.python import cp_model
import ortools

def peak_memory_bytes():
    """This Python process's measured peak resident set, including native solver allocations."""
    if sys.platform == 'win32':
        import ctypes
        from ctypes import wintypes
        class Counters(ctypes.Structure):
            _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD)] + [
                (name, ctypes.c_size_t) for name in ('PeakWorkingSetSize', 'WorkingSetSize',
                'QuotaPeakPagedPoolUsage', 'QuotaPagedPoolUsage', 'QuotaPeakNonPagedPoolUsage',
                'QuotaNonPagedPoolUsage', 'PagefileUsage', 'PeakPagefileUsage')]
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        psapi = ctypes.WinDLL('psapi', use_last_error=True)
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
        counters = Counters(); counters.cb = ctypes.sizeof(counters)
        if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            raise OSError('MEMORY_MEASUREMENT_FAILED')
        return int(counters.PeakWorkingSetSize)
    import resource
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(peak if sys.platform == 'darwin' else peak * 1024)

def solve(data):
    assert data['format']=='nyales-daily-solver-1'
    jobs=data['visits'];n=len(jobs)+2;end=n-1;h=data['horizon_seconds'];matrix=data['durations_seconds']
    assert 2<=n<=100 and 1<=h<=86400 and 1<=data['solver_seconds']<=120
    assert len(matrix)==n and all(len(row)==n for row in matrix)
    assert all(v is None or type(v)is int and 0<=v<=604800 for row in matrix for v in row)
    assert all(matrix[i][i]==0 for i in range(n))
    assert len({j['id'] for j in jobs})==len(jobs)
    capacity=data['capacity_service_seconds'];travel_weight=data['travel_weight_basis_points']
    assert type(capacity)is int and 0<=capacity<=h and type(travel_weight)is int and 0<=travel_weight<=10000
    model=cp_model.CpModel();present={};starts={0:model.new_constant(0)};ends={0:model.new_constant(0)};intervals=[];arcs=[];travel={};departs={}
    fixed=sorted(data['breaks']);assert all(0<=a<b<=h and (i==0 or a>=fixed[i-1][1]) for i,(a,b)in enumerate(fixed))
    for i,(a,b)in enumerate(fixed):intervals.append(model.new_fixed_size_interval_var(a,b-a,'break_'+str(i)))
    for i,j in enumerate(jobs,1):
        duration=j['service_seconds'];assert type(duration)is int and 60<=duration<=86400
        assert type(j['required'])is bool and type(j['priority'])is int and 0<=j['priority']<=10000
        p=model.new_bool_var('present_'+str(i));present[i]=p
        if j['required']:model.add(p==1)
        starts[i]=model.new_int_var(0,h,'start_'+str(i));ends[i]=model.new_int_var(0,h,'end_'+str(i))
        intervals.append(model.new_optional_interval_var(starts[i],duration,ends[i],p,'service_'+str(i)))
        choices=[]
        for k,(a,b)in enumerate(j['windows']):
            assert 0<=a<b<=h
            if b-a<duration:continue
            choice=model.new_bool_var('window_'+str(i)+'_'+str(k));model.add(starts[i]>=a).only_enforce_if(choice);model.add(ends[i]<=b).only_enforce_if(choice);choices.append(choice)
        model.add(sum(choices)==p);arcs.append((i,i,p.Not()))
    starts[end]=model.new_int_var(0,h,'return_at');ends[end]=starts[end]
    arcs.append((end,0,model.new_constant(1)))
    for i in range(end):
        for j in range(1,n):
            if i==j or matrix[i][j] is None:continue
            seconds=matrix[i][j];a=model.new_bool_var('arc_'+str(i)+'_'+str(j));arcs.append((i,j,a));travel[i,j]=a
            depart=model.new_int_var(0,h,'depart_'+str(i)+'_'+str(j));departs[i,j]=depart
            model.add(depart>=ends[i]).only_enforce_if(a);model.add(depart+seconds<=starts[j]).only_enforce_if(a)
            arrival=model.new_int_var(0,h,'arrival_'+str(i)+'_'+str(j));model.add(arrival==depart+seconds).only_enforce_if(a)
            if j==end:model.add(arrival==starts[end]).only_enforce_if(a)
            intervals.append(model.new_optional_interval_var(depart,seconds,arrival,a,'travel_'+str(i)+'_'+str(j)))
    model.add_circuit(arcs);model.add_no_overlap(intervals)
    model.add(sum(j['service_seconds']*present[i] for i,j in enumerate(jobs,1))<=capacity)
    # Prepared priority is already weighted by the frozen policy/source builder.
    # Travel cost is normalized to the shift length; required visits remain hard.
    model.maximize(sum(j['priority']*h*present[i] for i,j in enumerate(jobs,1))-
                   travel_weight*sum(matrix[i][j]*a for(i,j),a in travel.items()))
    solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=data['solver_seconds'];solver.parameters.num_search_workers=1;solver.parameters.random_seed=0
    before=time.perf_counter();status=solver.solve(model);wall=round((time.perf_counter()-before)*1000)
    output={'format':'nyales-daily-solution-1','engine':'ortools-cp-sat','engine_version':ortools.__version__,'optimality':'not_claimed','wall_ms':wall,'outcome':'infeasible' if status==cp_model.INFEASIBLE else 'timeout_without_candidate','visits':[],'unscheduled':[],'return_departure_seconds':None,'return_at_seconds':None,'return_travel_seconds':None}
    if status==cp_model.MODEL_INVALID:raise ValueError('SOLVER_MODEL_INVALID')
    if status not in(cp_model.OPTIMAL,cp_model.FEASIBLE):
        output['unscheduled']=[{'id':j['id'],'code':'hard_constraints_infeasible' if status==cp_model.INFEASIBLE else 'solver_timeout'}for j in jobs];return output
    output['outcome']='feasible' if status==cp_model.OPTIMAL else 'timeout_with_candidate';current=0;seen=set()
    while current!=end:
        selected=[j for(i,j),a in travel.items()if i==current and solver.value(a)];assert len(selected)==1
        nxt=selected[0];depart=solver.value(departs[current,nxt]);duration=matrix[current][nxt]
        if nxt==end:
            output.update(return_departure_seconds=depart,return_at_seconds=depart+duration,return_travel_seconds=duration);break
        assert nxt not in seen;seen.add(nxt);job=jobs[nxt-1]
        output['visits'].append({'id':job['id'],'travel_departure_seconds':depart,'arrival_seconds':depart+duration,'service_start_seconds':solver.value(starts[nxt]),'departure_seconds':solver.value(ends[nxt]),'travel_seconds':duration,'matrix_from':current,'matrix_to':nxt});current=nxt
    output['unscheduled']=[{'id':j['id'],'code':'unreachable' if not any(matrix[k][i] is not None for k in range(n)if k!=i)or not any(matrix[i][k] is not None for k in range(n)if k!=i) else 'hard_constraints_infeasible'}for i,j in enumerate(jobs,1)if not solver.value(present[i])]
    return output

if __name__=='__main__':
    try:
        raw=sys.stdin.buffer.read(8388609)
        if len(raw)>8388608:raise ValueError('INPUT_TOO_LARGE')
        result=solve(json.loads(raw));result['peak_memory_bytes']=peak_memory_bytes()
        print(json.dumps(result,separators=(',',':')))
    except Exception:
        print('DAILY_SOLVER_INPUT_OR_RUNTIME_FAILED',file=sys.stderr);sys.exit(1)
