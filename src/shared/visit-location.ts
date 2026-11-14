import {z} from 'zod';
import {distanceKm} from './daily-visit';
export const visitLocationPolicy=z.object({radius_m:z.number().int().min(10).max(1000),max_accuracy_m:z.number().int().min(5).max(500),max_age_seconds:z.number().int().min(30).max(600),allow_unverified_visits:z.boolean(),allow_outside_exception:z.boolean()}).strict();
export const defaultVisitLocationPolicy={radius_m:100,max_accuracy_m:100,max_age_seconds:120,allow_unverified_visits:true,allow_outside_exception:true};
export function assessVisitLocation(customer:any,fix:any,config=defaultVisitLocationPolicy){
 const hasCustomer=Number.isInteger(customer.latitude_e7)&&Number.isInteger(customer.longitude_e7),hasFix=Number.isInteger(fix.latitude_e7)&&Number.isInteger(fix.longitude_e7);
 const accuracy=Number.isFinite(fix.accuracy_cm)?fix.accuracy_cm/100:null;
 const distance=hasFix&&hasCustomer?distanceKm({latitude:customer.latitude_e7/1e7,longitude:customer.longitude_e7/1e7},{latitude:fix.latitude_e7/1e7,longitude:fix.longitude_e7/1e7})*1000:null;
 const age=fix.captured_at?(Date.parse(fix.occurred_at)-Date.parse(fix.captured_at))/1000:null;
 let status='inside';
 if(!hasFix||!['browser_gps','android_gps'].includes(fix.source))status='missing_fix';
 else if(accuracy===null||accuracy>config.max_accuracy_m)status='poor_accuracy';
 else if(age===null||!Number.isFinite(age)||age< -30||age>config.max_age_seconds)status='stale_fix';
 else if(!hasCustomer)status='missing_customer';
 else if(customer.coordinate_status!=='verified')status='unverified_customer';
 else if(distance!+accuracy!<=config.radius_m)status='inside';
 else if(distance!-accuracy!>config.radius_m)status='outside';
 else status='uncertain';
 const unverified=['missing_customer','unverified_customer'].includes(status),valid=status==='inside';
 const customerAllowed=hasCustomer&&customer.coordinate_status==='verified'||config.allow_unverified_visits;
 return {status,distance_m:distance===null?null:Math.round(distance),radius_m:config.radius_m,accuracy_m:accuracy,customer_coordinate_status:customer.coordinate_status||'missing',customer_latitude_e7:customer.latitude_e7,customer_longitude_e7:customer.longitude_e7,can_check_in:customerAllowed&&(valid||unverified&&config.allow_unverified_visits||!unverified&&config.allow_outside_exception),requires_reason:!valid&&!unverified,location_verified:valid,validation_version:'nyales-visit-location-1'};
}
