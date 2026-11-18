import type {Identity,NyalesApi} from './api';
export async function stopTrackingForLogout(_identity:Identity,_api:NyalesApi):Promise<void> {}
export async function stopTrackingForAccountChange(_identity:Identity):Promise<void> {}
export default function TrackingControl(_props:{api:NyalesApi;identity:Identity}) { return null; }
