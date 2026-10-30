import React from 'react';
export const useIdentity=()=>({identity:{id:'fixture-owner',name:'Navigation Fixture',role:'MANAGEMENT',scope:'organization',organization_id:'fixture-org',area_ids:[],capabilities:['dashboard:read','customers:read','map:read','telesales:read','settings:manage']},logout:async()=>{},loggingOut:false});
export const AuthGate=({children}:{children:React.ReactNode})=><>{children}</>;
export async function apiFetch(input?:string){const w=window as any;(w.__navigationFetches??=[]).push(input);if(input&&w.__navigationResponses?.[input])return new Response(JSON.stringify({data:w.__navigationResponses[input]}),{headers:{'Content-Type':'application/json'}});throw Error('Fixture: data panels are unavailable');}
