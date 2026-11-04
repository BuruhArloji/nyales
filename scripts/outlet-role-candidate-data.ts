import {digest,sqlValue} from './bekasi-real-point-mapping';

export type CandidateCohort='external_directory'|'synthetic_demo'|'training';
export type CandidateStatus='pending_sales_confirmation'|'excluded_synthetic'|'training_unclassified';
export type CandidateRole='retail'|'wholesale'|'agent_distributor'|'mixed_unknown';
export type CustomerCandidateRow=Record<string,unknown>&{
 id:string;
 organization_id:string;
 version:number;
 outlet_type:string;
 directory_dataset_id:string|null;
};
export type CandidateInput={
 customer:CustomerCandidateRow;
 candidate_role:CandidateRole|null;
 cohort:CandidateCohort;
 confidence:'low'|'very_low'|'not_applicable';
 confidence_basis:string;
 status:CandidateStatus;
 evidence_reason:string;
};
export type CandidatePayload={
 verified:false;
 candidate_role:CandidateRole|null;
 cohort:CandidateCohort;
 confidence:CandidateInput['confidence'];
 confidence_basis:string;
 status:CandidateStatus;
 evidence_reason:string;
 needs_sales_confirmation:boolean;
 source_customer_id:string;
 source_organization_id:string;
 source_snapshot_sha256:string;
 source_outlet_type:string;
 source_customer_version:number;
 source_dataset_id:string|null;
 rule_version:string;
 run_id:string;
};

function stableRow(row:Record<string,unknown>){return Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))}
export function sourceSnapshotDigest(row:CustomerCandidateRow){return digest(stableRow(row))}

function assertInput(input:CandidateInput){
 const c=input.customer;
 if(!c.id||!c.organization_id||!Number.isInteger(c.version)||c.version<1)throw Error('INVALID_CUSTOMER_PROVENANCE');
 if(typeof c.outlet_type!=='string'||(c.directory_dataset_id!==null&&typeof c.directory_dataset_id!=='string'))throw Error('INVALID_CUSTOMER_SOURCE_FIELDS');
 if(input.cohort==='external_directory'&&c.directory_dataset_id===null)throw Error('EXTERNAL_COHORT_REQUIRES_DIRECTORY_DATASET');
 if(input.cohort==='synthetic_demo'&&(c.directory_dataset_id!==null||c.outlet_type!=='retail_demo'))throw Error('SYNTHETIC_COHORT_SOURCE_MISMATCH');
 if(input.cohort==='training'&&(c.directory_dataset_id!==null||c.outlet_type.trim()!==''))throw Error('TRAINING_COHORT_SOURCE_MISMATCH');
 for(const [key,value] of Object.entries(c)){
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))throw Error('INVALID_SOURCE_COLUMN_NAME');
  if(value!==null&&typeof value!=='string'&&typeof value!=='number')throw Error('INVALID_SOURCE_COLUMN_VALUE');
  if(typeof value==='number'&&!Number.isFinite(value))throw Error('INVALID_SOURCE_COLUMN_VALUE');
 }
 if(input.cohort==='external_directory'&&(input.status!=='pending_sales_confirmation'||!input.candidate_role))throw Error('INVALID_EXTERNAL_CANDIDATE_STATUS');
 if(input.cohort!=='external_directory'&&input.candidate_role!==null)throw Error('NON_EXTERNAL_ROLE_CLAIM_FORBIDDEN');
 if(input.cohort==='synthetic_demo'&&input.status!=='excluded_synthetic')throw Error('INVALID_SYNTHETIC_STATUS');
 if(input.cohort==='training'&&input.status!=='training_unclassified')throw Error('INVALID_TRAINING_STATUS');
 if(!['low','very_low','not_applicable'].includes(input.confidence))throw Error('INVALID_QUALITATIVE_CONFIDENCE');
 if(typeof input.confidence_basis!=='string'||typeof input.evidence_reason!=='string')throw Error('INVALID_CANDIDATE_EVIDENCE');
}

/** Builds an immutable, unverified receipt with no copied customer PII; only a full-row hash and minimal provenance are retained. */
export function buildCandidatePayload(input:CandidateInput,ruleVersion:string,runId:string):CandidatePayload{
 assertInput(input);
 if(!/^[A-Za-z0-9._-]{1,80}$/.test(ruleVersion)||!runId)throw Error('RULE_VERSION_AND_RUN_ID_REQUIRED');
 const c=input.customer;
 return {
  verified:false,
  candidate_role:input.candidate_role,
  cohort:input.cohort,
  confidence:input.confidence,
  confidence_basis:input.confidence_basis,
  status:input.status,
  evidence_reason:input.evidence_reason,
  needs_sales_confirmation:input.cohort==='external_directory',
  source_customer_id:c.id,
  source_organization_id:c.organization_id,
  source_snapshot_sha256:sourceSnapshotDigest(c),
  source_outlet_type:c.outlet_type,
  source_customer_version:c.version,
  source_dataset_id:c.directory_dataset_id,
  rule_version:ruleVersion,
  run_id:runId
 };
}

function sourceGuard(c:CustomerCandidateRow){
 const q=sqlValue;
 return Object.entries(c).sort(([a],[b])=>a.localeCompare(b)).map(([column,value])=>`${column}${value===null?' IS NULL':`=${q(value)}`}`).join(' AND ');
}

/**
 * Produces an append-only master_audit insert. The ID is stable per rule version and customer,
 * making replays idempotent. The source guard compares every customer_outlet column and writes no
 * customer or business table.
 */
export function candidateSql(input:CandidateInput,ruleVersion:string,runId:string,actorId='outlet-role-candidate',occurredAt='1970-01-01T00:00:00.000Z'){
 const p=buildCandidatePayload(input,ruleVersion,runId),c=input.customer,q=sqlValue;
 const id=`outlet-role-candidate:${ruleVersion}:${c.id}`;
 const guard=sourceGuard(c);
 return `INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) SELECT ${[id,c.organization_id,actorId,'outlet_role_candidate',c.id,'candidate_proposed',occurredAt,null,JSON.stringify(p)].map(q).join(',')} WHERE NOT EXISTS(SELECT 1 FROM master_audit WHERE id=${q(id)}) AND EXISTS(SELECT 1 FROM customer_outlet WHERE ${guard});`;
}

export {digest,sqlValue};
