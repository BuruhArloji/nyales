import type {Context} from 'hono';
import {hashSession} from './sessions';

type VerifiedVisitor={email:string;displayName?:string|null;authTime:number};
/** Count distinct Google sign-ins; throttle presence updates to at most once per five minutes. */
export async function recordPortfolioVisit(db:D1Database,project:string,organization:string,claims:VerifiedVisitor,kind:'owner'|'visitor',now=Date.now()){
 const hash=await hashSession(project+':'+claims.email.trim().toLowerCase()),stamp=new Date(now).toISOString();
 await db.prepare(`INSERT INTO portfolio_visitor_history(organization_id,subject_hash,email,display_name,account_kind,first_seen_at,last_seen_at,last_auth_time,visit_count)
 VALUES(?,?,?,?,?,?,?,?,1) ON CONFLICT(organization_id,subject_hash) DO UPDATE SET
 email=excluded.email,display_name=excluded.display_name,account_kind=excluded.account_kind,
 last_seen_at=MAX(portfolio_visitor_history.last_seen_at,excluded.last_seen_at),
 visit_count=portfolio_visitor_history.visit_count+CASE WHEN excluded.last_auth_time>portfolio_visitor_history.last_auth_time THEN 1 ELSE 0 END,
 last_auth_time=MAX(portfolio_visitor_history.last_auth_time,excluded.last_auth_time)
 WHERE excluded.last_auth_time>portfolio_visitor_history.last_auth_time OR portfolio_visitor_history.last_seen_at<?`)
 .bind(organization,hash,claims.email.trim().toLowerCase(),(claims.displayName||'').slice(0,200),kind,stamp,stamp,claims.authTime,new Date(now-300000).toISOString()).run();
}

export async function listPortfolioVisitors(c:Context<any>){
 if(c.get('portfolioOwner')!==true||c.get('identity').organization_id!==c.env.PORTFOLIO_ORGANIZATION_ID)return c.json({code:'SCOPE_DENIED'},403);
 const limit=Number(c.req.query('limit')||50);if(![50,100].includes(limit))return c.json({code:'INVALID_PAGINATION'},422);
 let cursor:[string,string]|null=null;
 if(c.req.query('cursor')){
  try{const text=c.req.query('cursor')!;if(text.length>256)throw Error();const value=JSON.parse(atob(text.replace(/-/g,'+').replace(/_/g,'/')));if(!Array.isArray(value)||value.length!==2||typeof value[0]!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value[0])||!Number.isFinite(Date.parse(value[0]))||! /^[a-f0-9]{64}$/.test(value[1]))throw Error();cursor=value as [string,string];}catch{return c.json({code:'INVALID_PAGINATION'},422);}
 }
 const rows=await c.env.DB.prepare(`SELECT subject_hash,email,display_name,account_kind,first_seen_at,last_seen_at,visit_count FROM portfolio_visitor_history
 WHERE organization_id=?${cursor?' AND (last_seen_at<? OR (last_seen_at=? AND subject_hash<?))':''}
 ORDER BY last_seen_at DESC,subject_hash DESC LIMIT ?`).bind(c.get('identity').organization_id,...(cursor?[cursor[0],cursor[0],cursor[1]]:[]),limit+1).all();
 const selected=rows.results.slice(0,limit),last=selected.at(-1),hasMore=rows.results.length>limit;
 c.header('Cache-Control','private, no-store');
 return c.json({data:selected.map(({subject_hash,...row}:any)=>row),meta:{limit,has_more:hasMore,next_cursor:hasMore&&last?btoa(JSON.stringify([last.last_seen_at,last.subject_hash])).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''):null}});
}
