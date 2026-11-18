import type {NyalesApi,TrackingFix} from './api';
import {acknowledgeTrackingBatch,acknowledgeTrackingStop,nextTrackingBatch,pendingTrackingStop,pruneExpiredTracking,trackingRetentionDue} from './tracking-store.native';

let flushing=false;

/** Send a bounded number per pass; rejected or unacknowledged batches stay on-device. */
export async function syncTrackingBatches(api:NyalesApi,owner:string):Promise<{sent:number;expired:number;busy:boolean}> {
 if (flushing) return {sent:0,expired:0,busy:true};
 flushing=true;
 let sent=0,expired=0;
 try {
  if(await trackingRetentionDue(owner)) {
   const status=await api.trackingSession(),serverTime=status.meta?.server_time;
   if(typeof serverTime!=='string')throw new Error('TRACKING_SERVER_TIME_UNAVAILABLE');
   expired=await pruneExpiredTracking(owner,serverTime);
  }
  const stop=await pendingTrackingStop(owner);
  if (stop) {
   const result=await api.stopTracking(stop.session_id,stop.stopped_at,stop.event_id);
   if (result.data.id!==stop.session_id||result.data.state!=='stopped') throw new Error('TRACKING_STOP_ACK_INVALID');
   await acknowledgeTrackingStop(owner,stop.session_id,stop.event_id);
  }
  for (let i=0;i<10;i++) {
   const item=await nextTrackingBatch(owner);
   if (!item) break;
   const payload=JSON.parse(item.payload) as {batch_id:string;points:TrackingFix[]};
   if (payload.batch_id!==item.id || !Array.isArray(payload.points) || payload.points.length===0 || payload.points.length>100) throw new Error('TRACKING_QUEUE_CORRUPT');
   const reply=await api.uploadTrackingBatch(item.session_id,item.id,payload.points);
   if (reply.data.batch_id!==item.id || reply.data.accepted!==payload.points.length) throw new Error('TRACKING_ACK_INVALID');
   await acknowledgeTrackingBatch(owner,item.id);
   sent+=payload.points.length;
  }
  return {sent,expired,busy:false};
 } finally {flushing=false}
}
