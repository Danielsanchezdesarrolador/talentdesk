import type {Recruitment} from './recruitment.js';
import type {Vacancy} from './vacancies.js';
import {eligibleInterviews,emptyInterview,saveInterview,type InterviewDraft} from './selection.js';
import {assignTimes,type InviteRow,type DraftMail} from './bulkInvitations.js';
export type AgendaMode='new'|'reschedule';
export type AgendaRow={applicationId:string;interviewId:string;baseline:string;name:string;job:string;email:string;date:string;time:string;selected:boolean};
export type Appointment={date:string;time:string;place:string;interviewer:string;candidateId:string;email:string};
const norm=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es-CL');
export function sameStart(a:Appointment,b:Appointment){return a.date===b.date&&a.time===b.time&&((!!norm(a.place)&&norm(a.place)===norm(b.place))||(!!norm(a.interviewer)&&norm(a.interviewer)===norm(b.interviewer))||(!!a.candidateId&&a.candidateId===b.candidateId)||(!!norm(a.email)&&norm(a.email)===norm(b.email)));}
function candidate(state:Recruitment,id:string){const a=state.applications.find(a=>a.id===id);return state.candidates.find(c=>c.id===a?.candidateId);}
function booked(state:Recruitment,excluding:ReadonlySet<string>){return state.interviews.filter(i=>i.attendance==='Programada'&&!excluding.has(i.id)).map(i=>{const c=candidate(state,i.applicationId);return {...i,candidateId:c?.id??'',email:c?.email??''};});}
export function invitationConflicts(mails:readonly DraftMail[],state:Recruitment){const slots=booked(state,new Set());return mails.flatMap(m=>slots.some(s=>sameStart({...m,candidateId:''},s))?[{id:m.id,message:'Coincide con una entrevista programada: misma hora y lugar, entrevistador o correo.'}]:[]);}
export function agendaRows(state:Recruitment,vacancies:readonly Vacancy[],mode:AgendaMode,vacancyId:string){
 const apps=mode==='new'?eligibleInterviews(state,vacancies):state.applications.filter(a=>vacancies.some(v=>v.id===a.vacancyId&&v.status==='Activa')&&state.interviews.some(i=>i.applicationId===a.id&&i.attendance==='Programada')&&!state.hires.some(h=>h.applicationId===a.id));
 return apps.filter(a=>!vacancyId||a.vacancyId===vacancyId).map(a=>{const c=candidate(state,a.id),v=vacancies.find(v=>v.id===a.vacancyId),i=state.interviews.find(i=>i.applicationId===a.id);return {applicationId:a.id,interviewId:i?.id??'',baseline:JSON.stringify([a,i??null,c??null,v??null]),name:c?c.firstName+' '+c.lastName:'Candidato no disponible',job:v?.title??'',email:c?.email??'',date:i?.date??'',time:i?.time??'',selected:true};});
}
export function scheduleRows(rows:readonly AgendaRow[],date:string,start:string,interval:number){
 const mapped:InviteRow[]=rows.map(r=>({id:r.applicationId,name:r.name,email:r.email,job:r.job,date:r.date,time:r.time,selected:r.selected}));
 const assigned=assignTimes(mapped,date,start,interval);return rows.map((r,i)=>({...r,date:assigned[i].date,time:assigned[i].time}));
}
export function planAgenda(state:Recruitment,vacancies:readonly Vacancy[],mode:AgendaMode,rows:readonly AgendaRow[],place:string,interviewer:string,makeId:()=>string,at:string){
 const selected=rows.filter(r=>r.selected);
 if(!selected.length||selected.length>100||new Set(selected.map(r=>r.applicationId)).size!==selected.length)throw Error('Selecciona entre 1 y 100 postulaciones distintas.');
 if(!place.trim()||!interviewer.trim())throw Error('Completa lugar y entrevistador.');
 const current=agendaRows(state,vacancies,mode,''),exclude=new Set(selected.map(r=>r.interviewId).filter(Boolean)),slots=booked(state,exclude),results:{id:string;ok:boolean;message:string}[]=[];
 let next=state;
 for(const r of selected){try{
  const latest=current.find(x=>x.applicationId===r.applicationId);
  if(!latest||latest.baseline!==r.baseline||latest.interviewId!==r.interviewId)throw Error('La postulación cambió; recupera el lote de nuevo.');
  const c=candidate(state,r.applicationId);if(!c)throw Error('Candidato no disponible.');
  const slot={date:r.date,time:r.time,place,interviewer,candidateId:c.id,email:c.email};
  if(slots.some(s=>sameStart(slot,s)))throw Error('Coincidencia de horario con una entrevista: lugar, entrevistador o candidato.');
  const prior=state.interviews.find(i=>i.id===r.interviewId);
  const d:InterviewDraft={...(prior??emptyInterview),applicationId:r.applicationId,date:r.date,time:r.time,place,interviewer};
  next=saveInterview(next,vacancies,d,prior?.id??makeId(),!!prior,at);slots.push(slot);
  results.push({id:r.applicationId,ok:true,message:prior?'Lista para reprogramar':'Lista para agendar'});
 }catch(e){results.push({id:r.applicationId,ok:false,message:e instanceof Error?e.message:'No se pudo agendar'});}}
 return {state:results.every(r=>r.ok)?next:state,results};
}
