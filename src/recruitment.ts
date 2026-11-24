import type {StoragePort,Vacancy} from './vacancies.js';
export const RECRUITMENT_KEY='talentdesk.recruitment.synthetic.v1';
export type Candidate={id:string;firstName:string;lastName:string;code:string;email:string;phone:string;profession:string;experience:string;availability:string;cv:string;notes:string};
export type CandidateDraft=Omit<Candidate,'id'>;
export const emptyCandidate:CandidateDraft={firstName:'',lastName:'',code:'',email:'',phone:'',profession:'',experience:'',availability:'',cv:'',notes:''};
export const outcomes=['Interesado','No interesado','No contesta','Volver a llamar','Pendiente de entrevista','En espera'] as const;
export type Outcome=typeof outcomes[number];
export type Application={id:string;candidateId:string;vacancyId:string;createdAt:string;status:'Pendiente de llamado'|Outcome};
export type Contact={id:string;applicationId:string;at:string;outcome:Outcome;notes:string;nextDate:string};
export type Recruitment={candidates:Candidate[];applications:Application[];contacts:Contact[]};
export const emptyRecruitment=():Recruitment=>({candidates:[],applications:[],contacts:[]});
const norm=(s:string)=>s.trim().normalize('NFKC').toLocaleLowerCase('es-CL').replace(/\s+/g,' ');
const text=(v:unknown,max:number,required=false)=>{if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw Error('Completa los campos obligatorios y revisa su longitud.');return v.trim();};
function dayOK(s:string){const d=new Date(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;}
function timestamp(s:string){if(typeof s!=='string'||!Number.isFinite(Date.parse(s)))throw Error('Fecha de registro inválida.');return s;}
function idOK(id:string){if(typeof id!=='string'||!id.trim())throw Error('Identificador inválido.');}
export function cleanCandidate(d:CandidateDraft):CandidateDraft {
 const clean={firstName:text(d.firstName,100,true),lastName:text(d.lastName,100,true),code:text(d.code,40,true).toUpperCase(),email:text(d.email,180).toLowerCase(),phone:text(d.phone,30),profession:text(d.profession,100),experience:text(d.experience,500),availability:text(d.availability,100),cv:text(d.cv,250),notes:text(d.notes,1000)};
 if(!/^DEMO-[A-Z0-9-]+$/.test(clean.code))throw Error('Utiliza un identificador ficticio DEMO-...; no ingreses RUT reales.');
 if(clean.email&&!/^[^\s@]+@[^\s@]+\.invalid$/.test(clean.email))throw Error('Utiliza un correo ficticio con dominio .invalid.');
 if(clean.phone&&!/^[0-9 +()-]+$/.test(clean.phone))throw Error('Teléfono ficticio inválido.');
 return clean;
}
const phoneKey=(s:string)=>s.replace(/\D/g,'');
export function saveCandidate(state:Recruitment,draft:CandidateDraft,id:string,editing=false):Recruitment{
 idOK(id);const d=cleanCandidate(draft);if(state.candidates.some(c=>c.id===id)!==editing)throw Error('Identificador de candidato inválido.');
 if(state.candidates.some(c=>c.id!==id&&(norm(c.code)===norm(d.code)||(d.email&&norm(c.email)===norm(d.email))||(phoneKey(d.phone)&&phoneKey(c.phone)===phoneKey(d.phone)))))throw Error('Ya existe un candidato con ese código, correo o teléfono. Revisa su ficha.');
 const row={...d,id};return {...state,candidates:editing?state.candidates.map(c=>c.id===id?row:c):[row,...state.candidates]};
}
export function addApplication(state:Recruitment,vacancies:readonly Vacancy[],candidateId:string,vacancyId:string,id:string,at:string):Recruitment{
 idOK(id);timestamp(at);
 if(!state.candidates.some(c=>c.id===candidateId)||!vacancies.some(v=>v.id===vacancyId&&v.status==='Activa'))throw Error('Selecciona un candidato y una vacante activa.');
 if(state.applications.some(a=>a.id===id||(a.candidateId===candidateId&&a.vacancyId===vacancyId)))throw Error('Ya existe esa postulación.');
 return {...state,applications:[{id,candidateId,vacancyId,createdAt:at,status:'Pendiente de llamado'},...state.applications]};
}
export function recordContact(state:Recruitment,vacancies:readonly Vacancy[],applicationId:string,id:string,outcome:Outcome,notes:string,nextDate:string,at:string):Recruitment{
 idOK(id);timestamp(at);const app=state.applications.find(a=>a.id===applicationId);
 if(!app||!vacancies.some(v=>v.id===app.vacancyId&&v.status==='Activa'))throw Error('La postulación no corresponde a una vacante activa.');
 if(!outcomes.includes(outcome)||state.contacts.some(c=>c.id===id))throw Error('Resultado o identificador inválido.');
 notes=text(notes,1000);nextDate=text(nextDate,10);
 if((nextDate&&!dayOK(nextDate))||(outcome==='Volver a llamar'&&!nextDate))throw Error('Indica una fecha válida de próximo contacto.');
 return {...state,applications:state.applications.map(a=>a.id===applicationId?{...a,status:outcome}:a),contacts:[{id,applicationId,at,outcome,notes,nextDate},...state.contacts]};
}
export function pendingCalls(state:Recruitment,vacancies:readonly Vacancy[],today:string){
 return state.applications.filter(a=>{
 if(!vacancies.some(v=>v.id===a.vacancyId&&v.status==='Activa'))return false;
 if(a.status==='Pendiente de llamado')return true;
 if(!['No contesta','Volver a llamar','En espera'].includes(a.status))return false;
 const last=state.contacts.find(c=>c.applicationId===a.id);
 return !last?.nextDate||last.nextDate<=today;
 });
}
export function searchCandidates(state:Recruitment,query:string){const q=norm(query);return state.candidates.filter(c=>norm([c.firstName,c.lastName,c.code,c.profession,c.email,c.phone].join(' ')).includes(q));}
export function loadRecruitment(storage:StoragePort):Recruitment{
 const raw=storage.getItem(RECRUITMENT_KEY);if(raw===null)return emptyRecruitment();
 const d=JSON.parse(raw) as Recruitment;
 if(!d||!Array.isArray(d.candidates)||!Array.isArray(d.applications)||!Array.isArray(d.contacts))throw Error('Datos de reclutamiento corruptos.');
 let state=emptyRecruitment();
 for(const c of [...d.candidates].reverse())state=saveCandidate(state,c,c.id);
 const pairs=new Set<string>(),ids=new Set<string>();
 const applications=d.applications.map(a=>{
 idOK(a.id);timestamp(a.createdAt);idOK(a.vacancyId);
 const pair=JSON.stringify([a.candidateId,a.vacancyId]);
 if(ids.has(a.id)||pairs.has(pair)||!state.candidates.some(c=>c.id===a.candidateId)||!(a.status==='Pendiente de llamado'||outcomes.includes(a.status)))throw Error('Postulación inválida.');
 ids.add(a.id);pairs.add(pair);return {...a};
 });
 const contactIds=new Set<string>();
 const contacts=d.contacts.map(c=>{idOK(c.id);timestamp(c.at);if(contactIds.has(c.id)||!ids.has(c.applicationId)||!outcomes.includes(c.outcome))throw Error('Contacto inválido.');contactIds.add(c.id);const notes=text(c.notes,1000),nextDate=text(c.nextDate,10);if((nextDate&&!dayOK(nextDate))||(c.outcome==='Volver a llamar'&&!nextDate))throw Error('Seguimiento inválido.');return {...c,notes,nextDate};});
 for(const a of applications){const last=contacts.find(c=>c.applicationId===a.id);if(a.status!==(last?.outcome??'Pendiente de llamado'))throw Error('Historial de postulación inconsistente.');}
 return {...state,applications,contacts};
}
export function persistRecruitment(storage:StoragePort,state:Recruitment){storage.setItem(RECRUITMENT_KEY,JSON.stringify(state));}
export function todayLocal(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
