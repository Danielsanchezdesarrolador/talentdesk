import type {Recruitment} from './recruitment.js';
import type {Vacancy} from './vacancies.js';
import {saveDocument,emptyDoc,alerts,type Operations} from './operations.js';
import {totalCovered} from './selection.js';
import {dailySummary} from './productivity.js';
function date(value:string){const d=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==value)throw Error('Fecha inválida.');return d;}
function shift(day:string,offset:number){const d=date(day);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
function localDay(at:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');}
const norm=(s:string)=>s.trim().normalize('NFKC').toLocaleLowerCase('es-CL').replace(/\s+/g,' ');
export function checklistNames(raw:string){if(raw.length>4000)throw Error('Lista demasiado extensa.');const rows=raw.split(/\r?\n/).map(n=>n.trim()).filter(Boolean);if(!rows.length||rows.length>20||rows.some(n=>n.length>100))throw Error('Indica entre 1 y 20 documentos de hasta 100 caracteres.');if(new Set(rows.map(norm)).size!==rows.length)throw Error('La lista tiene nombres repetidos.');return rows;}
export function checklistPlan(ops:Operations,recruit:Recruitment,applicationIds:readonly string[],raw:string,due:string,makeId:()=>string,at:string){
 const names=checklistNames(raw);date(due);
 if(!applicationIds.length||applicationIds.length>50||new Set(applicationIds).size!==applicationIds.length)throw Error('Selecciona entre 1 y 50 postulaciones distintas.');
 if(applicationIds.some(id=>!recruit.applications.some(a=>a.id===id)))throw Error('Postulación inválida.');
 if(applicationIds.length*names.length>500)throw Error('Máximo 500 requisitos por operación.');
 let next=ops,created=0,skipped=0;
 for(const applicationId of applicationIds)for(const name of names){if(next.documents.some(d=>d.applicationId===applicationId&&norm(d.name)===norm(name))){skipped++;continue;}next=saveDocument(next,recruit,{...emptyDoc,applicationId,name,due},makeId(),false,at);created++;}
 return {ops:next,created,skipped};
}
export function documentReminders(ops:Operations,recruit:Recruitment,today:string){
 const pending=alerts(ops,today).documents;
 return recruit.applications.flatMap(a=>{const docs=pending.filter(d=>d.applicationId===a.id).sort((a,b)=>a.due.localeCompare(b.due)),c=recruit.candidates.find(c=>c.id===a.candidateId);if(!docs.length||!c)return [];return [{applicationId:a.id,title:c.firstName+' '+c.lastName,recipient:c.email,count:docs.length,body:['BORRADOR DEMO — NO ENVIAR','Hola '+c.firstName+', te recordamos revisar los siguientes documentos ficticios:',...docs.map(d=>'- '+d.name+' · fecha límite '+d.due),'Saludos.'].join('\n')}];});
}
export function agingVacancies(rows:readonly Vacancy[],recruit:Recruitment,today:string,minimum:number){const end=date(today);if(!Number.isSafeInteger(minimum)||minimum<0||minimum>3650)throw Error('Umbral inválido.');return rows.filter(v=>v.status==='Activa').map(v=>({id:v.id,title:v.title,unit:v.unit,age:Math.floor((end.valueOf()-date(v.date).valueOf())/86400000),pending:Math.max(0,v.slots-totalCovered(recruit,v))})).filter(v=>v.pending>0&&v.age>=minimum).sort((a,b)=>b.age-a.age||a.title.localeCompare(b.title));}
export function weeklyReport(rows:readonly Vacancy[],recruit:Recruitment,ops:Operations,end:string){
 date(end);const start=shift(end,-6),within=(s:string)=>s>=start&&s<=end,stamp=(s:string)=>within(localDay(s));
 const items=[['Vacantes solicitadas',rows.filter(v=>within(v.date)).length],['Postulaciones registradas',recruit.applications.filter(a=>stamp(a.createdAt)).length],['Contactos registrados',recruit.contacts.filter(c=>stamp(c.at)).length],['Entrevistas realizadas (fecha agenda)',recruit.interviews.filter(i=>i.attendance==='Realizada'&&within(i.date)).length],['Ingresos confirmados DEMO',recruit.hires.filter(h=>h.status==='Confirmado DEMO'&&stamp(h.confirmedAt)).length],['Tareas actualmente completadas en período',ops.tasks.filter(t=>t.status==='Completada'&&t.history[0]&&stamp(t.history[0].at)).length],['Ferias realizadas (fecha feria)',ops.fairs.filter(f=>f.status==='Realizada'&&within(f.date)).length]] as const;
 return {start,end,items,text:['TalentDesk · Resumen semanal DEMO',start+' al '+end+' · Chile continental',...items.map(([k,v])=>k+': '+v),'Sin envío automático.'].join('\n')};
}
export function workflowPreviews(rows:readonly Vacancy[],recruit:Recruitment,ops:Operations,today:string,minimum:number){return {daily:dailySummary(rows,recruit,ops,today),weekly:weeklyReport(rows,recruit,ops,today),reminders:documentReminders(ops,recruit,today),aging:agingVacancies(rows,recruit,today,minimum)};}
