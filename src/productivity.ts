import {pendingCalls,type Recruitment,type Outcome,type Candidate} from './recruitment.js';
import {eligibleInterviews,eligibleHires,totalCovered} from './selection.js';
import {alerts,type Operations} from './operations.js';
import type {Vacancy} from './vacancies.js';
export const modules=['Inicio','Vacantes','Candidatos','Centro de llamados','Entrevistas','Ingresos','Documentos','Reportes y tareas','Configuración'] as const;
export type Module=typeof modules[number];
const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es-CL').trim().replace(/\s+/g,' ');
export type SearchResult={id:string;module:'Vacantes'|'Candidatos';title:string;subtitle:string};
export function globalSearch(rows:readonly Vacancy[],recruit:Recruitment,query:string):SearchResult[]{
 const terms=normalize(query).split(' ').filter(Boolean);if(!terms.length)return [];
 const result:SearchResult[]=[];
 const matches=(s:string)=>terms.every(t=>normalize(s).includes(t));
 for(const c of recruit.candidates)if(matches([c.firstName,c.lastName,c.code,c.email,c.phone,c.profession].join(' ')))result.push({id:c.id,module:'Candidatos',title:c.firstName+' '+c.lastName,subtitle:c.code+' · '+(c.profession||'Sin profesión')});
 for(const v of rows)if(matches([v.title,v.unit,v.manager??'',v.status].join(' ')))result.push({id:v.id,module:'Vacantes',title:v.title,subtitle:v.unit+' · '+v.status+' · '+v.date});
 return result.slice(0,12);
}
export type Action={key:string;module:Module;title:string;count:number;detail:string};
export function dailyWorkspace(rows:readonly Vacancy[],recruit:Recruitment,ops:Operations,today:string){
 const active=rows.filter(v=>v.status==='Activa'),due=alerts(ops,today);
 const interviews=recruit.interviews.filter(i=>i.attendance==='Programada');
 const agenda=interviews.filter(i=>i.date>=today).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const actions:Action[]=[
 {key:'calls',module:'Centro de llamados',title:'Llamados pendientes',count:pendingCalls(recruit,rows,today).length,detail:'Contactar o retomar candidatos'},
 {key:'schedule',module:'Entrevistas',title:'Por agendar',count:eligibleInterviews(recruit,rows).length,detail:'Revisar postulaciones disponibles'},
 {key:'past',module:'Entrevistas',title:'Entrevistas por actualizar',count:interviews.filter(i=>i.date<today).length,detail:'Registrar asistencia y evaluación'},
 {key:'today',module:'Entrevistas',title:'Entrevistas de hoy',count:interviews.filter(i=>i.date===today).length,detail:'Consultar agenda'},
 {key:'hire',module:'Ingresos',title:'Ingresos por preparar',count:eligibleHires(recruit,rows).length,detail:'Completar condiciones del ingreso'},
 {key:'prepared',module:'Ingresos',title:'Ingresos preparados',count:recruit.hires.filter(h=>h.status==='Preparado').length,detail:'Revisar antes de confirmar DEMO'},
 {key:'docs',module:'Documentos',title:'Documentos pendientes',count:due.documents.length,detail:'Con vencimiento hasta hoy'},
 {key:'tasks',module:'Reportes y tareas',title:'Tareas pendientes',count:due.tasks.length,detail:'Con vencimiento hasta hoy'}];
 const slots=active.reduce((s,v)=>s+v.slots,0),covered=active.reduce((s,v)=>s+Math.min(v.slots,totalCovered(recruit,v)),0);
 const contactsToday=recruit.contacts.filter(c=>{const d=new Date(c.at);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')===today;}).length;
 return {actions,agenda,active,slots,covered,pending:slots-covered,contactsToday,due,workCount:actions.reduce((s,a)=>s+a.count,0)};
}
export function dailySummary(rows:readonly Vacancy[],recruit:Recruitment,ops:Operations,today:string){
 const d=dailyWorkspace(rows,recruit,ops,today);return ['TalentDesk · Resumen DEMO · '+today,'Vacantes activas: '+d.active.length,'Cobertura: '+d.covered+'/'+d.slots,'Contactos registrados hoy: '+d.contactsToday,...d.actions.map(a=>a.title+': '+a.count),'Solo datos ficticios. Sin envío automático.'].join('\n');
}
export function followupDate(today:string,days:number){const d=new Date(today+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(today)||!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==today||!Number.isSafeInteger(days)||days<1||days>30)throw Error('Fecha de seguimiento inválida.');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function contactDraft(c:Candidate,v:Vacancy){return 'DEMO · NO ENVIAR\nHola '+c.firstName+', te contacto por el proceso de '+v.title+' en '+v.unit+'. ¿Tienes disponibilidad para conversar? Saludos.';}
export function suggestedFollowup(outcome:Outcome,today:string){return outcome==='No contesta'||outcome==='Volver a llamar'?followupDate(today,1):'';}
