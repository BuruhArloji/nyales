import {z} from 'zod';
export const AGENT_QUEUE_CONTRACT='nyales-agent-queue-1' as const;
const id=z.string().min(1).max(128),sha=z.string().regex(/^[a-f0-9]{64}$/),reason=z.string().trim().min(8).max(500);
export const queueDecision=z.object({reason}).strict();
export const queueClaim=z.object({contract_version:z.literal(AGENT_QUEUE_CONTRACT)}).strict();
export const queueLease=z.object({contract_version:z.literal(AGENT_QUEUE_CONTRACT),expected_version:z.number().int().positive(),attempt_no:z.number().int().min(1).max(3),fence:z.number().int().positive(),payload_sha256:sha}).strict();
export const queueCheckpoint=queueLease.extend({checkpoint:z.enum(['probe_received','probe_verified'])});
export const queueComplete=queueLease.extend({probe_nonce:z.string().uuid(),agent_version:id});
export const queueFailure=queueLease.extend({code:z.enum(['machine_interrupted','input_invalid','probe_failed']),retryable:z.boolean()});
export const probePayload=z.object({contract_version:z.literal(AGENT_QUEUE_CONTRACT),kind:z.literal('connection_probe'),job_id:id,organization_id:id,environment:id,agent_id:id,generation:z.number().int().positive(),rep_ids:z.array(id).min(1).max(10),probe_nonce:z.string().uuid(),created_at:z.iso.datetime()}).strict();
export type QueueJob={id:string;organization_id:string;environment:string;target_agent_id:string;target_generation:number;kind:'connection_probe';requested_by:string;rep_ids_json:string;payload_json:string;payload_sha256:string;state:'queued'|'running'|'cancel_requested'|'completed'|'failed'|'cancelled'|'expired';version:number;attempt_no:number;fence:number;lease_credential_id:string|null;lease_until:string|null;checkpoint_code:'waiting'|'claimed'|'probe_received'|'probe_verified';failure_code:string|null;result_sha256:string|null;created_at:string;expires_at:string;ended_at:string|null};
export function queueSummary(j:QueueJob){return{id:j.id,agent_id:j.target_agent_id,generation:j.target_generation,kind:j.kind,state:j.state,version:j.version,attempt_no:j.attempt_no,fence:j.fence,checkpoint:j.checkpoint_code,lease_until:j.lease_until,failure_code:j.failure_code,result_sha256:j.result_sha256,created_at:j.created_at,expires_at:j.expires_at,ended_at:j.ended_at}}
export type QueueSummary=ReturnType<typeof queueSummary>;
export const queueSummarySchema=z.object({id,agent_id:id,generation:z.number().int().positive(),kind:z.literal('connection_probe'),state:z.enum(['queued','running','cancel_requested','completed','failed','cancelled','expired']),version:z.number().int().positive(),attempt_no:z.number().int().min(0).max(3),fence:z.number().int().nonnegative(),checkpoint:z.enum(['waiting','claimed','probe_received','probe_verified']),lease_until:z.iso.datetime().nullable(),failure_code:id.nullable(),result_sha256:sha.nullable(),created_at:z.iso.datetime(),expires_at:z.iso.datetime(),ended_at:z.iso.datetime().nullable()}).strict();
export const queueAgentJobSchema=queueSummarySchema.extend({payload_sha256:sha,payload:probePayload.nullable()});
export const queueClaimResponse=z.object({data:z.object({job:queueAgentJobSchema.nullable(),retry_after_seconds:z.literal(60)}).strict()}).strict();
export const queueJobResponse=z.object({data:z.object({job:queueAgentJobSchema}).strict()}).strict();
