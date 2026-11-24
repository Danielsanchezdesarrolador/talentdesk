import type {Recruitment} from './recruitment.js';
import type {Vacancy} from './vacancies.js';
import type {Entry} from './catalogs.js';
import type {Operations} from './operations.js';
import {invitation} from './adminAutomation.js';
import {documentReminders} from './localWorkflows.js';
export const communicationKinds=['Citación','Reprogramación','Recordatorio de entrevista','Documentos pendientes','Ingreso EST'] as const;
export type CommunicationKind=typeof communicationKinds[number];
export type Message={key:string;kind:CommunicationKind;sourceId:string;name:string;recipient:string;subject:string;body:string;detail:string};
export type Context={recruit:Recruitment;vacancies:readonly Vacancy[];ops:Operations;catalog:readonly Entry[]};
const address=(s:string)=>/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.invalid$/i.test(s)&&s.length<=180;
export function messages(ctx:Context,kind:CommunicationKind,date:string,templateId=''):Message[]{
 const {recruit:r,vacancies:v,ops,catalog}=ctx;
 const d=new Date(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==date)throw Error('Fecha inválida.');
 if(kind==='Ingreso EST')return r.hires.filter(h=>h.status==='Confirmado DEMO').map(h=>({key:kind+':'+h.id,kind,sourceId:h.id,name:h.row[1]+' '+h.row[2],recipient:h.recipient,subject:h.subject,body:h.body,detail:h.employer+' · '+h.row[5]}));
 if(kind==='Documentos pendientes')return documentReminders(ops,r,date).filter(m=>{const a=r.applications.find(a=>a.id===m.applicationId);return v.some(x=>x.id===a?.vacancyId&&x.status==='Activa');}).map(m=>({key:kind+':'+m.applicationId,kind,sourceId:m.applicationId,name:m.title,recipient:m.recipient,subject:'DEMO | Documentación pendiente',body:m.body,detail:m.count+' requisitos pendientes'}));
 return r.interviews.filter(i=>i.attendance==='Programada'&&i.date===date&&v.some(x=>x.id===r.applications.find(a=>a.id===i.applicationId)?.vacancyId&&x.status==='Activa')).flatMap(i=>{
 const a=r.applications.find(a=>a.id===i.applicationId),c=r.candidates.find(c=>c.id===a?.candidateId);if(!c)return [];
 const previous=i.history.slice(1).find(h=>h.draft.attendance==='Programada'&&['date','time','place','interviewer'].some(k=>h.draft[k as 'date'|'time'|'place'|'interviewer']!==i[k as 'date'|'time'|'place'|'interviewer']));
 if(kind==='Reprogramación'&&!previous)return [];
 const inv=invitation(r,v,catalog,i.id,templateId),subject='DEMO | '+kind+' · '+(v.find(x=>x.id===a?.vacancyId)?.title??'Entrevista');
 const prefix=kind==='Reprogramación'?'Actualización de la entrevista anterior: '+previous!.draft.date+' '+previous!.draft.time+'.\n':kind==='Recordatorio de entrevista'?'Recordatorio de tu próxima entrevista.\n':'';
 return [{key:kind+':'+i.id,kind,sourceId:i.id,name:c.firstName+' '+c.lastName,recipient:inv.recipient,subject,body:prefix?inv.body.replace('BORRADOR DEMO — NO ENVIAR\n','BORRADOR DEMO — NO ENVIAR\n'+prefix):inv.body,detail:i.date+' '+i.time+' · '+i.place}];
 });
}
export function reviewMessages(current:readonly Message[],selected:readonly string[]){
 if(!selected.length||selected.length>100||new Set(selected).size!==selected.length)throw Error('Selecciona entre 1 y 100 mensajes distintos.');
 const result=selected.map(k=>current.find(m=>m.key===k));if(result.some(m=>!m))throw Error('La fuente cambió. Recupera los mensajes de nuevo.');
 const rows=result as Message[];if(rows.some(m=>!address(m.recipient)||!m.body.includes('NO ENVIAR')||!m.subject.startsWith('DEMO |')))throw Error('Hay mensajes sin destinatario ficticio válido o sin marca DEMO.');
 return rows.map(m=>({...m}));
}
export function assertCurrent(reviewed:readonly Message[],current:readonly Message[]){const now=reviewMessages(current,reviewed.map(m=>m.key));if(JSON.stringify(now)!==JSON.stringify(reviewed))throw Error('La información cambió. Revisa nuevamente antes de exportar.');return now;}
function cell(s:string){return '"'+(/^[\s]*[=+\-@]/.test(s)?"'"+s:s).replace(/"/g,'""')+'"';}
export function communicationsCSV(rows:readonly Message[]){const valid=reviewMessages(rows,rows.map(m=>m.key));return '\uFEFF'+[['Tipo','Referencia','Nombre','Correo','Asunto','Mensaje','Estado'],...valid.map(m=>[m.kind,m.sourceId,m.name,m.recipient,m.subject,m.body,'Preparado local — no enviado'])].map(r=>r.map(cell).join(';')).join('\r\n');}
