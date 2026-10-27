import {z} from 'zod';

// No business defaults: a Management/NSM policy must specify each enabled rule.
const disabled=z.object({enabled:z.literal(false)}).strict();
export const riskPolicyConfig=z.object({
 schema_version:z.literal(1),
 basis:z.literal('authorized_invoice_scope'),
 near_churn:z.discriminatedUnion('enabled',[disabled,z.object({enabled:z.literal(true),after_days:z.number().int().min(1).max(90)}).strict()]),
 repeat_order:z.discriminatedUnion('enabled',[disabled,z.object({enabled:z.literal(true),lookback_days:z.number().int().min(90).max(730),minimum_order_dates:z.number().int().min(3).max(60),overdue_multiplier_milli:z.number().int().min(1000).max(10000)}).strict()]),
 sales_decline:z.discriminatedUnion('enabled',[disabled,z.object({enabled:z.literal(true),comparison:z.enum(['completed_months','comparable_mtd']),drop_basis_points:z.number().int().min(1).max(10000),minimum_baseline_minor:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),minimum_baseline_order_dates:z.number().int().min(1).max(31)}).strict()]),
}).strict().refine(c=>c.near_churn.enabled||c.repeat_order.enabled||c.sales_decline.enabled,'Aktifkan setidaknya satu indikator.');

export type RiskPolicyConfig=z.infer<typeof riskPolicyConfig>;
export type RiskMetric={state:'disabled'|'insufficient_data'|'not_applicable'|'flag'|'no_flag';code:string;evidence:Record<string,unknown>};
export type RiskResult={customer_id:string;customer_status:string;definition_version:'nyales-risk-1';cutoff:string;state:'attention'|'attention_with_gaps'|'insufficient_data'|'no_flag_observed';flag_count:number;unknown_count:number;metrics:{near_churn:RiskMetric;repeat_order:RiskMetric;sales_decline:RiskMetric}};
