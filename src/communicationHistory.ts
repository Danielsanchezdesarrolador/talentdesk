import {reviewMessages,type Message,type Context,type CommunicationKind,communicationKinds} from './communications.js';
import type {Operations} from './operations.js';
export type CommunicationRecord={id:string;at:string;message:Message;status:'Revisado local — no enviado'};
const MAX_RECORDS=300;
function validText(v:unknown,max:number){return typeof v==='string'&&v.trim().length>0&&v.length<=max;}
function fingerprint(m:Message){return JSON.stringify([m.kind,m.sourceId,m.recipient,m.subject,m.body]);}
export function validateHistory(raw:unknown):CommunicationRecord[]{
 if(!Array.isArray(raw)||raw.length>MAX_RECORDS)throw Error('Historial de comunicaciones inválido.');
 const ids=new Set<string>(),keys=new Set<string>();
 for(const r of raw){if(!r||!validText(r.id,200)||typeof r.at!=='string'||!Number.isFinite(Date.parse(r.at))||r.status!=='Revisado local — no enviado'||!r.message)throw Error('Registro de comunicación inválido.');
 const m=r.message as Message;
 if(!communicationKinds.includes(m.kind)||!validText(m.sourceId,200)||m.key!==m.kind+':'+m.sourceId||!validText(m.name,200)||!validText(m.subject,500)||!validText(m.body,20000)||!validText(m.detail,500))throw Error('Borrador histórico inválido.');
 reviewMessages([m],[m.key]);const key=fingerprint(m);if(ids.has(r.id)||keys.has(key))throw Error('Historial de comunicaciones duplicado.');ids.add(r.id);keys.add(key);
 }return raw as CommunicationRecord[];
}
export function saveReviewed(ops:Operations,reviewed:readonly Message[],current:readonly Message[],makeId:()=>string,at:string){
 const fresh=reviewMessages(current,reviewed.map(m=>m.key));
 if(JSON.stringify(fresh)!==JSON.stringify(reviewed))throw Error('La información cambió. Revisa nuevamente.');
 if(!Number.isFinite(Date.parse(at)))throw Error('Fecha de registro inválida.');
 const previous=validateHistory(ops.communications??[]),known=new Set(previous.map(r=>fingerprint(r.message))),added:CommunicationRecord[]=[];
 for(const m of fresh){const key=fingerprint(m);if(known.has(key))continue;known.add(key);added.push({id:makeId(),at,message:{...m},status:'Revisado local — no enviado'});}
 if(previous.length+added.length>MAX_RECORDS)throw Error('Límite de 300 borradores históricos DEMO. No se sobrescribió nada.');
 const next=validateHistory([...added,...previous]);return {ops:added.length?{...ops,communications:next}:ops,added:added.length,skipped:fresh.length-added.length};
}
export function sourceExists(m:Message,ctx:Pick<Context,'recruit'>){const r=ctx.recruit;return m.kind==='Ingreso EST'?r.hires.some(h=>h.id===m.sourceId&&h.status==='Confirmado DEMO'):m.kind==='Documentos pendientes'?r.applications.some(a=>a.id===m.sourceId):r.interviews.some(i=>i.id===m.sourceId);}
export function historyFilter(rows:readonly CommunicationRecord[],kind:CommunicationKind|'Todas',query:string){const q=query.trim().toLocaleLowerCase('es-CL');return rows.filter(r=>(kind==='Todas'||r.message.kind===kind)&&(!q||[r.message.name,r.message.recipient,r.message.subject].some(s=>s.toLocaleLowerCase('es-CL').includes(q))));}
