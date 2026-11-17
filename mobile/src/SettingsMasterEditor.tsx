import React from 'react';
import type {NyalesApi,Identity} from './api';
export default function SettingsMasterEditor(_props:{api:NyalesApi;identity:Identity;kind:'organization'|'branches';item:{id:string;name:string;version:number;timezone?:string};onClose:()=>void;onSaved:()=>void}){return null}
