import {z} from 'zod';
import {visitAgentPublicKey} from './visit-agent-proof';
const id=z.string().min(1).max(128),reason=z.string().trim().min(8).max(500);
export const visitAgentRegistration=z.object({name:z.string().trim().min(1).max(120),environment:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),rep_ids:z.array(id).min(1).max(10).refine(ids=>new Set(ids).size===ids.length),reason}).strict();
export const visitAgentDecision=z.object({reason}).strict();
export const visitAgentPairInput=z.object({contract_version:z.literal('nyales-visit-generator-1'),pairing_code:z.string().regex(/^[A-Za-z0-9_-]{43}$/),machine_name:z.string().trim().min(1).max(120),public_key_jwk:visitAgentPublicKey}).strict();
export const visitPairProofClaims=z.object({v:z.literal(1),purpose:z.literal('pair'),method:z.literal('POST'),origin:z.string().max(500),target:z.literal('/api/visit-agent/pair'),code_sha256:z.string().regex(/^[a-f0-9]{64}$/),body_sha256:z.string().regex(/^[a-f0-9]{64}$/),jti:z.string().uuid(),iat:z.number().int().safe().nonnegative(),exp:z.number().int().safe().nonnegative()}).strict().refine(v=>v.exp>v.iat&&v.exp-v.iat<=120);
export type VisitPairProofClaims=z.infer<typeof visitPairProofClaims>;
