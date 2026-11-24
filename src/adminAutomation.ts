import {eligibleHires,emptyHire,prepareHire,incomeHeaders,incomeTSV,type Interview,type Hire,type HireDraft} from './selection.js';
import {matchRates,type Entry} from './catalogs.js';
import type {Recruitment} from './recruitment.js';
import type {Vacancy} from './vacancies.js';
export function defaultHire(state:Recruitment,vacancies:readonly Vacancy[],catalog:readonly Entry[],applicationId:string,startDate:string):HireDraft{
 const a=state.applications.find(a=>a.id===applicationId),v=vacancies.find(v=>v.id===a?.vacancyId);
 const rates=v?matchRates(catalog,v.title,v.unit,startDate):[];
 return {...emptyHire,applicationId,startDate,manager:v?.manager??'',rateId:rates.find(r=>r.id===v?.terms?.rateId)?.id??(rates.length===1?rates[0].id:'')};
}
export function batchDrafts(state:Recruitment,vacancies:readonly Vacancy[],catalog:readonly Entry[],date:string,vacancyId:string){
 return eligibleHires(state,vacancies).filter(a=>!vacancyId||a.vacancyId===vacancyId).map(a=>defaultHire(state,vacancies,catalog,a.id,date));
}
export function prepareBatch(state:Recruitment,vacancies:readonly Vacancy[],catalog:readonly Entry[],drafts:readonly HireDraft[],makeId:()=>string,at:string){
 if(!drafts.length||drafts.length>100)throw Error('Selecciona entre 1 y 100 ingresos.');
 if(new Set(drafts.map(d=>d.applicationId)).size!==drafts.length)throw Error('Postulaciones duplicadas.');
 let next=state;const results:{applicationId:string;ok:boolean;message:string}[]=[];
 for(const d of drafts){try{next=prepareHire(next,vacancies,catalog,d,makeId(),false,at);results.push({applicationId:d.applicationId,ok:true,message:'Listo para preparar'});}catch(e){results.push({applicationId:d.applicationId,ok:false,message:e instanceof Error?e.message:'Ingreso inválido'});}}
 return {state:results.every(r=>r.ok)?next:state,results};
}
function safeCell(v:string|number){if(typeof v==='number')return String(v);const s=v.replace(/[\t\r\n]+/g,' ');return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;}
export function batchCSV(hires:readonly Hire[]){if(!hires.length)throw Error('Selecciona ingresos.');return '\uFEFF'+[incomeHeaders,...hires.map(h=>h.row)].map(row=>row.map(c=>'"'+safeCell(c).replace(/"/g,'""')+'"').join(';')).join('\r\n');}
export function batchTSV(hires:readonly Hire[]){if(!hires.length)throw Error('Selecciona ingresos.');return hires.map(incomeTSV).join('\n');}
export function invitation(state:Recruitment,vacancies:readonly Vacancy[],catalog:readonly Entry[],id:string,templateId=''){
 const i=state.interviews.find(i=>i.id===id&&i.attendance==='Programada'),a=state.applications.find(a=>a.id===i?.applicationId),c=state.candidates.find(c=>c.id===a?.candidateId),v=vacancies.find(v=>v.id===a?.vacancyId);
 if(!i||!a||!c||!v||v.status!=='Activa')throw Error('Se requiere una entrevista programada de una vacante activa.');
 const template=templateId?catalog.find(r=>r.id===templateId&&r.kind==='Plantillas'&&r.active):undefined;if(templateId&&!template)throw Error('Plantilla no disponible.');
 const values:Record<string,string>={nombre:c.firstName,apellido:c.lastName,cargo:v.title,unidad:v.unit,fecha:i.date,hora:i.time,lugar:i.place,entrevistador:i.interviewer};
 const intro=template?.detail?template.detail.replace(/\{\{([a-z]+)\}\}/g,(_,k:string)=>values[k]??'{{'+k+'}}'):'Hola '+c.firstName+', te invitamos a participar en una entrevista.';
 return {interview:i,recipient:c.email,subject:'DEMO | Citación a entrevista · '+v.title,body:['BORRADOR DEMO — NO ENVIAR',intro,'Cargo: '+v.title,'Unidad: '+v.unit,'Fecha: '+i.date,'Hora: '+i.time+' (Chile continental)','Lugar: '+i.place,'Entrevistador: '+i.interviewer,'Por favor confirma tu disponibilidad.','Saludos.'].join('\n')};
}
function icsText(s:string){return s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function fold(line:string){const enc=new TextEncoder();let out='',part='';for(const ch of line){if(enc.encode(part+ch).length>75){out+=part+'\r\n';part=' '+ch;}else part+=ch;}return out+part;}
export function calendarFile(i:Interview,at:string,duration:number){
 if(i.attendance!=='Programada'||!Number.isFinite(Date.parse(at))||![15,30,45,60,90].includes(duration))throw Error('Evento o duración inválidos.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(i.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.time))throw Error('Fecha de entrevista inválida.');
 const start=i.date.replace(/-/g,'')+'T'+i.time.replace(':','')+'00';
 const stamp=new Date(at).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 // Floating local time: no timezone inference; user verifies calendar zone on import.
 const uid=Array.from(new TextEncoder().encode(i.id),b=>b.toString(16).padStart(2,'0')).join('');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TalentDesk//DEMO//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+uid+'@talentdesk.invalid','DTSTAMP:'+stamp,'DTSTART:'+start,'DURATION:PT'+duration+'M','SUMMARY:Entrevista DEMO - NO ENVIAR','LOCATION:'+icsText(i.place),'DESCRIPTION:'+icsText('Evento ficticio. Verifica zona horaria de Chile continental al importar. No incluye asistentes.'),'STATUS:TENTATIVE','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
