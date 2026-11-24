import type {Recruitment,Application} from './recruitment.js';
import type {Vacancy} from './vacancies.js';
import {matchRates,snapshotTerms,type Entry} from './catalogs.js';
export const attendance=['Programada','Realizada','No asiste','Cancelada'] as const;
export const decisions=['Pendiente','Seleccionado','No seleccionado','En espera'] as const;
export const evaluations=['Pendiente','Completada','No aplica'] as const;
export type Attendance=typeof attendance[number];
export type Decision=typeof decisions[number];
export type Evaluation=typeof evaluations[number];
export type InterviewDraft={applicationId:string;date:string;time:string;place:string;interviewer:string;attendance:Attendance;evaluation:Evaluation;feedback:string;decision:Decision};
export type InterviewEvent={at:string;draft:InterviewDraft};
export type Interview=InterviewDraft&{id:string;history:InterviewEvent[]};
export const emptyInterview:InterviewDraft={applicationId:'',date:'',time:'',place:'',interviewer:'',attendance:'Programada',evaluation:'Pendiente',feedback:'',decision:'Pendiente'};
export const incomeHeaders=['RUT','Nombre','Apellido','Nro teléfono','Correo','Fecha ingreso','Jefatura','Cargo','Unidad','Horario','Renta'] as const;
export type IncomeRow=[string,string,string,string,string,string,string,string,string,string,number];
export type HireDraft={applicationId:string;startDate:string;manager:string;rateId:string;recipient:string;templateId:string};
export type Hire={id:string;applicationId:string;createdAt:string;status:'Preparado'|'Confirmado DEMO';confirmedAt:string;row:IncomeRow;employer:string;rateId:string;rateFrom:string;recipient:string;subject:string;body:string};
export const emptyHire:HireDraft={applicationId:'',startDate:'',manager:'',rateId:'',recipient:'',templateId:''};
function txt(v:unknown,max:number,required=false){if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw Error('Completa los campos obligatorios.');return v.trim();}
function day(s:string){const d=new Date(s+'T00:00:00Z');return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;}
function stamp(s:string){if(typeof s!=='string'||!Number.isFinite(Date.parse(s)))throw Error('Fecha de registro inválida.');}
function identifier(s:string){txt(s,200,true);}
function recipientOK(s:string){if(s&&!/^[^\s@]+@[^\s@]+\.invalid$/.test(s))throw Error('Solo correos ficticios con dominio .invalid.');}
function validateInterview(d:InterviewDraft):InterviewDraft{
 const x={applicationId:txt(d.applicationId,200,true),date:txt(d.date,10,true),time:txt(d.time,5,true),place:txt(d.place,200,true),interviewer:txt(d.interviewer,100,true),attendance:d.attendance,evaluation:d.evaluation,feedback:txt(d.feedback,2000),decision:d.decision};
 if(!day(x.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time)||!attendance.includes(x.attendance)||!evaluations.includes(x.evaluation)||!decisions.includes(x.decision))throw Error('Datos de entrevista inválidos.');
 if(x.attendance!=='Realizada'&&x.decision!=='Pendiente')throw Error('Registra una entrevista realizada antes de decidir.');
 if(x.decision==='Seleccionado'&&!x.feedback)throw Error('Registra feedback antes de seleccionar.');
 return x;
}
export function eligibleInterviews(state:Recruitment,vacancies:readonly Vacancy[]){return state.applications.filter(a=>vacancies.some(v=>v.id===a.vacancyId&&v.status==='Activa')&&['Interesado','Pendiente de entrevista','En espera'].includes(a.status)&&!state.interviews.some(i=>i.applicationId===a.id));}
export function saveInterview(state:Recruitment,vacancies:readonly Vacancy[],draft:InterviewDraft,id:string,editing:boolean,at:string):Recruitment{
 identifier(id);stamp(at);const d=validateInterview(draft),prior=state.interviews.find(i=>i.id===id);
 if(Boolean(prior)!==editing||(prior&&prior.applicationId!==d.applicationId)||(!prior&&!eligibleInterviews(state,vacancies).some(a=>a.id===d.applicationId)))throw Error('Postulación no disponible para entrevista.');
 const app=state.applications.find(a=>a.id===d.applicationId);
 if(!app||!vacancies.some(v=>v.id===app.vacancyId&&v.status==='Activa')||state.hires.some(h=>h.applicationId===d.applicationId))throw Error('La entrevista ya no admite cambios.');
 if(state.interviews.some(i=>i.id!==id&&i.applicationId===d.applicationId))throw Error('Ya existe una entrevista para esta postulación.');
 const row:Interview={...d,id,history:[{at,draft:d},...(prior?.history??[])]};
 return {...state,interviews:editing?state.interviews.map(i=>i.id===id?row:i):[row,...state.interviews]};
}
export function effectiveStatus(state:Recruitment,a:Application):string{
 const h=state.hires.find(x=>x.applicationId===a.id);if(h)return h.status==='Confirmado DEMO'?'Ingreso confirmado DEMO':'Ingreso preparado';
 const i=state.interviews.find(x=>x.applicationId===a.id);if(!i)return a.status;
 if(i.decision!=='Pendiente')return i.decision;
 return i.attendance==='Programada'?'Citado':i.attendance==='Realizada'?'Entrevistado':i.attendance;
}
export function confirmedCount(state:Recruitment,vacancyId:string){return state.hires.filter(h=>h.status==='Confirmado DEMO'&&state.applications.some(a=>a.id===h.applicationId&&a.vacancyId===vacancyId)).length;}
export function totalCovered(state:Recruitment,v:Vacancy){return (v.covered??0)+confirmedCount(state,v.id);}
export function eligibleHires(state:Recruitment,vacancies:readonly Vacancy[]){return state.applications.filter(a=>state.interviews.some(i=>i.applicationId===a.id&&i.decision==='Seleccionado')&&!state.hires.some(h=>h.applicationId===a.id)&&vacancies.some(v=>v.id===a.vacancyId&&v.status==='Activa'));}
export function prepareHire(state:Recruitment,vacancies:readonly Vacancy[],catalog:readonly Entry[],draft:HireDraft,id:string,editing:boolean,at:string):Recruitment{
 identifier(id);stamp(at);const prior=state.hires.find(h=>h.id===id);
 if(Boolean(prior)!==editing||(prior&&(prior.status!=='Preparado'||prior.applicationId!==draft.applicationId))||(!prior&&!eligibleHires(state,vacancies).some(a=>a.id===draft.applicationId)))throw Error('Postulación no disponible para ingreso.');
 const a=state.applications.find(a=>a.id===draft.applicationId),c=state.candidates.find(c=>c.id===a?.candidateId),v=vacancies.find(v=>v.id===a?.vacancyId);
 if(!a||!c||!v||v.status!=='Activa'||!state.interviews.some(i=>i.applicationId===a.id&&i.decision==='Seleccionado')||state.hires.some(h=>h.id!==id&&h.applicationId===a.id))throw Error('Se requiere una selección humana y vacante activa.');
 if(!day(draft.startDate)||draft.startDate<v.date)throw Error('Fecha de ingreso inválida.');
 if(!c.email||!c.phone||!/[0-9]/.test(c.phone))throw Error('Completa teléfono y correo ficticios en la ficha del candidato.');
 const manager=txt(draft.manager,100,true),recipient=txt(draft.recipient,180);recipientOK(recipient);
 if(!matchRates(catalog,v.title,v.unit,draft.startDate).some(r=>r.id===draft.rateId))throw Error('Selecciona una renta vigente para el cargo y unidad.');
 const t=snapshotTerms(catalog,draft.rateId,draft.startDate);
 const row:IncomeRow=[c.code,c.firstName,c.lastName,c.phone,c.email,draft.startDate,manager,v.title,v.unit,t.schedule,t.amount];
 const subject='DEMO | Solicitud de ingreso · '+c.firstName+' '+c.lastName;
 const template=draft.templateId?catalog.find(r=>r.id===draft.templateId&&r.kind==='Plantillas'&&r.active):undefined;
 if(draft.templateId&&!template)throw Error('Plantilla no disponible.');
 const body=['BORRADOR DEMO — NO ENVIAR',template?.detail||'Hola, solicito revisar el siguiente ingreso ficticio.', 'Empresa: '+t.employer,...incomeHeaders.map((h,i)=>h+': '+row[i]),'Saludos.'].join('\n');
 const h:Hire={id,applicationId:a.id,createdAt:prior?.createdAt??at,status:'Preparado',confirmedAt:'',row,employer:t.employer,rateId:t.rateId,rateFrom:t.from,recipient,subject,body};
 return {...state,hires:editing?state.hires.map(x=>x.id===id?h:x):[h,...state.hires]};
}
export function confirmHire(state:Recruitment,vacancies:readonly Vacancy[],id:string,at:string):Recruitment{
 stamp(at);const h=state.hires.find(x=>x.id===id),a=state.applications.find(x=>x.id===h?.applicationId),v=vacancies.find(x=>x.id===a?.vacancyId);
 if(!h||h.status!=='Preparado'||!v||v.status!=='Activa'||!state.interviews.some(i=>i.applicationId===a?.id&&i.decision==='Seleccionado'))throw Error('No se puede confirmar este ingreso.');
 if(totalCovered(state,v)>=v.slots)throw Error('No hay cupos disponibles.');
 return {...state,hires:state.hires.map(x=>x.id===id?{...x,status:'Confirmado DEMO',confirmedAt:at}:x)};
}
export function discardPrepared(state:Recruitment,id:string):Recruitment{if(!state.hires.some(h=>h.id===id&&h.status==='Preparado'))throw Error('Solo se puede descartar un borrador preparado.');return {...state,hires:state.hires.filter(h=>h.id!==id)};}
function safeCell(v:string|number){if(typeof v==='number')return String(v);const s=v.replace(/[\t\r\n]+/g,' ');return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;}
export const incomeTSV=(h:Hire)=>h.row.map(safeCell).join('\t');
export const incomeCSV=(h:Hire)=>'\uFEFF'+[incomeHeaders,h.row].map(r=>r.map(x=>'"'+safeCell(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');
export function restoreSelection(state:Recruitment,raw:{interviews?:unknown;hires?:unknown}):Pick<Recruitment,'interviews'|'hires'>{
 const interviewsRaw=raw.interviews===undefined?[]:raw.interviews,hiresRaw=raw.hires===undefined?[]:raw.hires;
 if(!Array.isArray(interviewsRaw)||!Array.isArray(hiresRaw))throw Error('Historial de selección inválido.');
 const interviews:Interview[]=[],hires:Hire[]=[];
 for(const i of interviewsRaw as Interview[]){identifier(i.id);validateInterview(i);if(!state.applications.some(a=>a.id===i.applicationId)||interviews.some(x=>x.id===i.id||x.applicationId===i.applicationId)||!Array.isArray(i.history)||!i.history.length)throw Error('Entrevista inválida.');
 for(const ev of i.history){stamp(ev.at);validateInterview(ev.draft);if(ev.draft.applicationId!==i.applicationId)throw Error('Historial inválido.');}
 if(JSON.stringify(validateInterview(i))!==JSON.stringify(validateInterview(i.history[0].draft)))throw Error('Historial de entrevista inconsistente.');
 interviews.push(i);}
 for(const h of hiresRaw as Hire[]){identifier(h.id);stamp(h.createdAt);if(!interviews.some(i=>i.applicationId===h.applicationId&&i.decision==='Seleccionado')||hires.some(x=>x.id===h.id||x.applicationId===h.applicationId)||!['Preparado','Confirmado DEMO'].includes(h.status)||!Array.isArray(h.row)||h.row.length!==11||h.row.slice(0,10).some(x=>typeof x!=='string'||!x.trim())||!Number.isSafeInteger(h.row[10])||h.row[10]<1||!day(h.row[5])||!day(h.rateFrom)||h.rateFrom>h.row[5]||!/^DEMO-[A-Z0-9-]+$/.test(h.row[0])||!h.row[4].endsWith('.invalid'))throw Error('Ingreso inválido.');
 for(const s of [h.employer,h.rateId,h.subject,h.body])txt(s,12000,true);recipientOK(txt(h.recipient,180));if(h.status==='Confirmado DEMO')stamp(h.confirmedAt);else if(h.confirmedAt!=='')throw Error('Confirmación inválida.');hires.push(h);}
 return {interviews,hires};
}
