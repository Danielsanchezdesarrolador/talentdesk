import {validateHistory,type CommunicationRecord} from './communicationHistory.js';
import type {StoragePort,Vacancy} from './vacancies.js';
import type {Recruitment} from './recruitment.js';
import {incomeHeaders,totalCovered} from './selection.js';
export const OPS_KEY='talentdesk.operations.synthetic.v1';
export const docStates=['Pendiente','Recibido','Revisado','No aplica'] as const;
export const priorities=['Baja','Media','Alta'] as const;
export const taskStates=['Pendiente','En curso','Completada'] as const;
export const fairStates=['Planificada','Realizada','Cancelada'] as const;
export const flows=[
 ['PA-01','Fila de ingreso Excel'],['PA-02','Borrador correo EST'],['PA-03','Agenda Outlook'],['PA-04','Citación'],['PA-05','Detección CV'],['PA-06','Recordatorio documental'],['PA-07','Resumen diario'],['PA-08','Vacantes pendientes'],['PA-09','Resumen semanal']
] as const;
export type Flow=typeof flows[number][0];
type Event={at:string;state:string;note:string};
export type DocumentDraft={applicationId:string;name:string;due:string;status:typeof docStates[number];reference:string;notes:string};
export type Document=DocumentDraft&{id:string;history:Event[]};
export type TaskDraft={title:string;due:string;priority:typeof priorities[number];status:typeof taskStates[number];notes:string;vacancyId:string};
export type Task=TaskDraft&{id:string;history:Event[]};
export type FairDraft={title:string;date:string;place:string;status:typeof fairStates[number];contacts:number;notes:string};
export type Fair=FairDraft&{id:string;history:Event[]};
export type Run={id:string;flow:Flow;sourceId:string;at:string;status:'Preparado local'|'Simulado sin envío';payload:string;history:Event[]};
export type Operations={documents:Document[];tasks:Task[];fairs:Fair[];runs:Run[];communications?:CommunicationRecord[]};
export const emptyOps=():Operations=>({documents:[],tasks:[],fairs:[],runs:[]});
export const emptyDoc:DocumentDraft={applicationId:'',name:'',due:'',status:'Pendiente',reference:'',notes:''};
export const emptyTask:TaskDraft={title:'',due:'',priority:'Media',status:'Pendiente',notes:'',vacancyId:''};
export const emptyFair:FairDraft={title:'',date:'',place:'',status:'Planificada',contacts:0,notes:''};
const norm=(s:string)=>s.trim().normalize('NFKC').toLocaleLowerCase('es-CL').replace(/\s+/g,' ');
function str(x:unknown,max:number,required=false){if(typeof x!=='string'||x.trim().length>max||(required&&!x.trim()))throw Error('Revisa los campos obligatorios y su longitud.');return x.trim();}
function day(s:string){const d=new Date(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;}
function date(x:unknown){const s=str(x,10,true);if(!day(s))throw Error('Fecha inválida.');return s;}
function stamp(s:string){if(typeof s!=='string'||!Number.isFinite(Date.parse(s)))throw Error('Fecha de registro inválida.');}
function pick<T extends string>(x:T,values:readonly T[]){if(!values.includes(x))throw Error('Estado inválido.');return x;}
function history(prior:{history:Event[]}|undefined,at:string,state:string,note:string){stamp(at);return [{at,state,note},...(prior?.history??[])];}
function validID(id:string){str(id,200,true);}
function priorRow<T extends {id:string}>(rows:readonly T[],id:string,editing:boolean){validID(id);const prior=rows.find(r=>r.id===id);if(Boolean(prior)!==editing)throw Error('Identificador inválido.');return prior;}
function replace<T extends {id:string}>(rows:readonly T[],row:T,editing:boolean){return editing?rows.map(r=>r.id===row.id?row:r):[row,...rows];}
function docClean(d:DocumentDraft):DocumentDraft{const x={applicationId:str(d.applicationId,200,true),name:str(d.name,100,true),due:date(d.due),status:pick(d.status,docStates),reference:str(d.reference,250),notes:str(d.notes,1000)};if(['Recibido','Revisado'].includes(x.status)&&!x.reference)throw Error('Indica una referencia ficticia del documento.');return x;}
function taskClean(d:TaskDraft):TaskDraft{return {title:str(d.title,150,true),due:date(d.due),priority:pick(d.priority,priorities),status:pick(d.status,taskStates),notes:str(d.notes,1000),vacancyId:str(d.vacancyId,200)};}
function fairClean(d:FairDraft):FairDraft{if(!Number.isSafeInteger(d.contacts)||d.contacts<0||d.contacts>100000)throw Error('Cantidad de contactos inválida.');return {title:str(d.title,150,true),date:date(d.date),place:str(d.place,200,true),status:pick(d.status,fairStates),contacts:d.contacts,notes:str(d.notes,1000)};}
export function saveDocument(ops:Operations,recruit:Recruitment,draft:DocumentDraft,id:string,editing:boolean,at:string):Operations{const d=docClean(draft),prior=priorRow(ops.documents,id,editing);if(!recruit.applications.some(a=>a.id===d.applicationId)||(prior&&prior.applicationId!==d.applicationId))throw Error('Postulación inválida.');if(ops.documents.some(x=>x.id!==id&&x.applicationId===d.applicationId&&norm(x.name)===norm(d.name)))throw Error('Documento duplicado.');const row={...d,id,history:history(prior,at,d.status,d.notes)};return {...ops,documents:replace(ops.documents,row,editing)};}
export function saveTask(ops:Operations,vacancies:readonly Vacancy[],draft:TaskDraft,id:string,editing:boolean,at:string):Operations{const d=taskClean(draft),prior=priorRow(ops.tasks,id,editing);if(d.vacancyId&&!vacancies.some(v=>v.id===d.vacancyId))throw Error('Vacante inválida.');return {...ops,tasks:replace(ops.tasks,{...d,id,history:history(prior,at,d.status,d.notes)},editing)};}
export function saveFair(ops:Operations,draft:FairDraft,id:string,editing:boolean,at:string):Operations{const d=fairClean(draft),prior=priorRow(ops.fairs,id,editing);return {...ops,fairs:replace(ops.fairs,{...d,id,history:history(prior,at,d.status,d.notes)},editing)};}
export function alerts(ops:Operations,today:string){date(today);return {documents:ops.documents.filter(d=>d.status==='Pendiente'&&d.due<=today),tasks:ops.tasks.filter(t=>t.status!=='Completada'&&t.due<=today),fairs:ops.fairs.filter(f=>f.status==='Planificada'&&f.date>=today).sort((a,b)=>a.date.localeCompare(b.date))};}
export function monthlyReport(recruit:Recruitment,vacancies:readonly Vacancy[],ops:Operations,month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mes inválido.');
 const inMonth=(s:string)=>s.slice(0,7)===month;
 const active=vacancies.filter(v=>v.status==='Activa');
 const units=[...new Set(active.map(v=>v.unit))].sort().map(unit=>{const rows=active.filter(v=>v.unit===unit);const requested=rows.reduce((s,v)=>s+v.slots,0),covered=rows.reduce((s,v)=>s+totalCovered(recruit,v),0);return {unit,requested,covered,pending:Math.max(0,requested-covered)};});
 return {month,vacancies:vacancies.filter(v=>inMonth(v.date)).length,applications:recruit.applications.filter(a=>inMonth(a.createdAt)).length,contacts:recruit.contacts.filter(c=>inMonth(c.at)).length,interviews:recruit.interviews.filter(i=>inMonth(i.date)&&i.attendance==='Realizada').length,confirmed:recruit.hires.filter(h=>h.status==='Confirmado DEMO'&&inMonth(h.confirmedAt)).length,completedTasks:ops.tasks.filter(t=>t.status==='Completada'&&inMonth(t.history[0]?.at??'')).length,fairs:ops.fairs.filter(f=>f.status==='Realizada'&&inMonth(f.date)).length,units};
}
export function reportCSV(r:ReturnType<typeof monthlyReport>){return '\uFEFF'+[['Indicador','Valor'],['Mes',r.month],['Vacantes solicitadas',r.vacancies],['Postulaciones',r.applications],['Contactos',r.contacts],['Entrevistas realizadas',r.interviews],['Ingresos confirmados DEMO',r.confirmed],['Tareas completadas',r.completedTasks],['Ferias realizadas',r.fairs]].map(row=>row.join(';')).join('\r\n');}
export function prepareRun(ops:Operations,recruit:Recruitment,flow:Flow,sourceId:string,id:string,at:string):Operations{
 validID(id);stamp(at);
 if(flow!=='PA-01'&&flow!=='PA-02')throw Error('Flujo pendiente de integración.');
 const h=recruit.hires.find(h=>h.id===sourceId);
 if(!h||h.status!=='Confirmado DEMO')throw Error('Selecciona un ingreso confirmado DEMO.');
 if(ops.runs.some(r=>r.id===id||(r.flow===flow&&r.sourceId===sourceId)))throw Error('Ya existe una preparación para este flujo e ingreso.');
 const payload=JSON.stringify(flow==='PA-01'?{mode:'DEMO',requestId:id,columns:incomeHeaders,row:h.row}:{mode:'DEMO',requestId:id,recipient:h.recipient,subject:h.subject,body:h.body},null,2);
 return {...ops,runs:[{id,flow,sourceId,at,status:'Preparado local',payload,history:history(undefined,at,'Preparado local','Sin envío externo')},...ops.runs]};
}
export function simulateRun(ops:Operations,id:string,at:string):Operations{stamp(at);const r=ops.runs.find(r=>r.id===id);if(!r||r.status!=='Preparado local')throw Error('La simulación ya fue registrada o no existe.');return {...ops,runs:ops.runs.map(x=>x.id===id?{...x,status:'Simulado sin envío',history:history(x,at,'Simulado sin envío','No se invocó proveedor')}:x)};}
export function loadOps(storage:StoragePort):Operations{
 const raw=storage.getItem(OPS_KEY);if(raw===null)return emptyOps();const d=JSON.parse(raw) as Operations;
 if(!d||!Array.isArray(d.documents)||!Array.isArray(d.tasks)||!Array.isArray(d.fairs)||!Array.isArray(d.runs))throw Error('Datos administrativos corruptos.');
 function readRows<T extends {id:string;history:Event[]}>(rows:T[],validate:(r:T)=>unknown,state:(r:T)=>string){const ids=new Set<string>();for(const r of rows){validID(r.id);validate(r);if(ids.has(r.id)||!Array.isArray(r.history)||!r.history.length||r.history[0].state!==state(r))throw Error('Historial inválido.');ids.add(r.id);for(const h of r.history){stamp(h.at);str(h.state,100,true);str(h.note,1000);}}return rows;}
 if(d.communications!==undefined)validateHistory(d.communications);
 readRows(d.documents,docClean,r=>r.status);readRows(d.tasks,taskClean,r=>r.status);readRows(d.fairs,fairClean,r=>r.status);
 readRows(d.runs,r=>{stamp(r.at);validID(r.sourceId);if(!['PA-01','PA-02'].includes(r.flow)||!['Preparado local','Simulado sin envío'].includes(r.status)||JSON.parse(str(r.payload,30000,true)).mode!=='DEMO')throw Error('Preparación inválida.');},r=>r.status);
 if(new Set(d.documents.map(r=>JSON.stringify([r.applicationId,norm(r.name)]))).size!==d.documents.length||new Set(d.runs.map(r=>JSON.stringify([r.flow,r.sourceId]))).size!==d.runs.length)throw Error('Duplicados en almacenamiento.');
 return d;
}
export function persistOps(storage:StoragePort,ops:Operations){storage.setItem(OPS_KEY,JSON.stringify(ops));}
