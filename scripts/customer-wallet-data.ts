import {createHash} from 'node:crypto';
import {customerHierarchy1,walletCategoryPreset,type CustomerHierarchy1} from '../src/shared/customer-wallet';
type Customer={id:string;organization_id:string;outlet_type?:string|null};
export function inferWalletCategory(customer:Customer):CustomerHierarchy1{
 const type=(customer.outlet_type??'').trim().toLowerCase();
 if(/agen|grosir/.test(type))return 'agen_grosir';if(/wholesale|distributor/.test(type))return 'wholesale';if(/retail|warung|eceran/.test(type))return 'retail';
 const bucket=createHash('sha256').update(customer.id).digest()[0]%100;return bucket<80?'retail':bucket<95?'wholesale':'agen_grosir';
}
export function buildWalletDataStatements(customers:Customer[],organizationId:string,actor:string,at:string){
 if(!organizationId||!actor||!Number.isFinite(Date.parse(at)))throw Error('WALLET_PACKAGE_CONTEXT_REQUIRED');
 const q=(v:string)=>"'"+v.replaceAll("'","''")+"'",seen=new Set<string>();
 return customers.map(customer=>{if(customer.organization_id!==organizationId||!customer.id||seen.has(customer.id))throw Error('WALLET_CUSTOMER_TENANT_OR_DUPLICATE');seen.add(customer.id);const category=inferWalletCategory(customer);if(!customerHierarchy1.includes(category))throw Error('INVALID_CATEGORY');return `INSERT INTO customer_wallet_profile(organization_id,customer_id,hierarchy1,wallet_size_minor,source,updated_by,updated_at) SELECT ${q(organizationId)},${q(customer.id)},${q(category)},${walletCategoryPreset[category]},'synthetic_category_preset',${q(actor)},${q(at)} WHERE EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=${q(organizationId)} AND id=${q(customer.id)} AND record_status='active' AND merged_into_id IS NULL) AND NOT EXISTS(SELECT 1 FROM customer_wallet_profile WHERE organization_id=${q(organizationId)} AND customer_id=${q(customer.id)});`;});
}
