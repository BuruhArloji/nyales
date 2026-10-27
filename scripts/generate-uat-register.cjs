const fs=require('node:fs');
const prd='docs/specifications/PRD_Sales_Lapangan_dan_Telesales_v1_10.md';
const backlog=JSON.parse(fs.readFileSync('docs/specifications/Backlog_Pembangunan_Web_v1_2.json','utf8'));
const rows=[...fs.readFileSync(prd,'utf8').matchAll(/^\|\s*(\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm)];
const suites={
 'scope.test.ts':[1,18,23,24,28,50,78,79], 'customers.test.ts':[2,18], 'assignments.test.ts':[18,74],
 'm2-workflows.test.ts':[3,4,5,6,8,9,10,11,12,13,14,15,17,21,22,29,30,31,32,33,36,38,39,40],
 'm3-monitoring.test.ts':[19,20,28,82], 'm2-foundation.test.ts':[19,20,43,75,76,77],
 'm3-incentives.test.ts':[41,42,43,44,45,46,47,48,49,50,79,80,81],
 'finance.test.ts':[15,18,31,33,39,46,73,74], 'security-regression.test.ts':[1,3,15,23,24,26,28,50,78,79],
 'overview-uat.test.ts':[82], 'sessions.test.ts':[23,24], 'recovery.test.ts':[26], 'monitoring-capacity.test.ts':[19,20,28,78,82]
};
const browserMap={
 15:['offline order draft survives reload and sync retry keeps one order and original invoice totals'],
 23:['smoke logout revokes current token and second browser session stays active'],
 24:['smoke logout revokes current token and second browser session stays active'],
 28:['smoke Monitoring paginated drilldown export and channel filters'],
 82:['request failure preserves an actionable retry in drilldown and recovers']
};
let results=null;try{results=JSON.parse(fs.readFileSync('test-results/web059/results.json','utf8'))}catch{}
let previous=null;try{previous=JSON.parse(fs.readFileSync('docs/WEB059_UAT_REGISTER.json','utf8'))}catch{}
const browserResults=[];function walk(suites){for(const suite of suites||[]){for(const spec of suite.specs||[])for(const test of spec.tests||[])browserResults.push({title:spec.title,project:test.projectName,outcome:test.status,attempts:(test.results||[]).map(r=>r.status)});walk(suite.suites)}}walk(results?.suites);
const browserSummary={total:browserResults.length,passed:browserResults.filter(t=>t.outcome==='expected').length,failed:browserResults.filter(t=>t.outcome==='unexpected').length,flaky:browserResults.filter(t=>t.outcome==='flaky').length,skipped:browserResults.filter(t=>t.outcome==='skipped').length,start_time:results?.stats?.startTime||null,duration_ms:results?.stats?.duration||null};
const register={format:'nyales-uat-register-1',date:'2026-10-20',source_prd:prd,scope:'WEB-059 web release; 82 original PRD scenarios retained',acceptance_rule:'Supporting unit/route/browser evidence is not business sign-off. Deferred P1/integration/Android scenarios are never counted as passed. Real role/device/provider checks remain pending.',browser_evidence:results?'test-results/web059/results.json':null,scenarios:rows.map(([,n,scenario,expected,requirements])=>{
 const id=Number(n),applicability=backlog.uat_applicability[String(id)],deferred=applicability.startsWith('Deferred'),testFiles=Object.entries(suites).filter(([,ids])=>ids.includes(id)).map(([name])=>'tests/'+name),browserChecks=(browserMap[id]||[]).flatMap(title=>browserResults.filter(r=>r.title===title));
 const old=previous?.scenarios.find(s=>s.number===id&&s.scenario===scenario.trim()&&s.expected===expected.trim()&&s.applicability===applicability);
 return{id:'UAT-'+n,number:id,scenario:scenario.trim(),expected:expected.trim(),requirements:requirements.trim(),applicability,
  execution_steps:['Gunakan akun, scope dan data sintetis/pilot yang disetujui untuk skenario ini.','Jalankan pemicu pada kolom scenario; periksa UI, respons API dan fakta tersimpan.','Bandingkan dengan expected; simpan evidence, defect ID dan reviewer sebelum sign-off.'],
  supporting_regression:testFiles,browser_checks:browserChecks,
  local_evidence_status:deferred?'not_applicable_this_web_release':browserChecks.some(r=>r.outcome==='expected')?'related_browser_check_passed_partial_scenario':testFiles.length?'supporting_route_regression_available':'pending_execution',
  acceptance_status:deferred?'deferred':old?.acceptance_status||(id===26?'blocked_provider_restore':'pending_named_reviewer_role_device_uat'),
  limitation:deferred?'Diuji pada milestone fitur terkait; bukan pass web.':id===26?'Checksum/count drill belum membuktikan actual restore, RPO15m/RTO4h atau complete snapshot.':browserMap[id]?'Browser demo hanya mencakup sebagian skenario; bukan login lintas role Firebase atau perangkat lapangan nyata.':'Route fixtures mendukung aturan bisnis; perlu pelaksanaan skenario pada role/perangkat yang disepakati.',
  reviewer:old?.reviewer||null,reviewed_at:old?.reviewed_at||null,defect_ids:old?.defect_ids||[],signoff_evidence:old?.signoff_evidence||[]};
 })};
register.browser_summary=browserSummary;
register.counts={total:register.scenarios.length,web_release:register.scenarios.filter(s=>s.applicability==='Web release gate').length,deferred_integration_p1:register.scenarios.filter(s=>s.applicability==='Deferred integration/P1').length,deferred_android:register.scenarios.filter(s=>s.applicability==='Deferred Android').length,accepted:register.scenarios.filter(s=>s.acceptance_status==='accepted').length};
if(register.counts.total!==82||register.counts.web_release!==53||register.counts.deferred_integration_p1!==8||register.counts.deferred_android!==21)throw Error('PRD/applicability count drift; reconcile instead of silently dropping scenarios');
if(process.argv.includes('--check')){const saved=JSON.parse(fs.readFileSync('docs/WEB059_UAT_REGISTER.json','utf8'));for(const row of register.scenarios){const old=saved.scenarios.find(s=>s.id===row.id);if(!old||old.scenario!==row.scenario||old.expected!==row.expected||old.applicability!==row.applicability)throw Error('UAT source drift '+row.id)}console.log('82 scenarios reconciled with PRD/backlog; deferred items not passed')}
else{fs.writeFileSync('docs/WEB059_UAT_REGISTER.json',JSON.stringify(register,null,2)+'\n');fs.writeFileSync('docs/WEB059_BROWSER_EVIDENCE.json',JSON.stringify({date:register.date,boundary:'Local synthetic fixture; automated browser evidence, not named business UAT or provider/device acceptance.',source:register.browser_evidence,summary:browserSummary,checks:browserResults},null,2)+'\n');console.log(JSON.stringify({scenarios:register.counts,browser:browserSummary}))}
