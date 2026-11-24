import type {Recruitment} from './recruitment.js';
import type {Vacancy} from './vacancies.js';
import type {Hire} from './selection.js';
export const payrollHeaders=['Empresa contratante','Fecha de solicitud','RUT (código DEMO)','Nombres','Apellidos','Teléfono','Correo','Nacionalidad','Fecha de ingreso','Cargo','Motivo de vacante','Detalle de vacante','Carnet','1ª dosis','2ª dosis','3ª dosis','SIS','Jefatura'] as const;
export const extraFields=['employer','nationality','reason','detail','identity','dose1','dose2','dose3','sis','job'] as const;
export type ExtraField=typeof extraFields[number];
export type Extra=Record<ExtraField,string>;
export const emptyExtra:Extra={employer:'',nationality:'',reason:'',detail:'',identity:'',dose1:'',dose2:'',dose3:'',sis:'',job:''};
export type PayrollReview={hireId:string;baseline:string;extra:Extra;selected:boolean};
type Source={hire:Hire;vacancy:Vacancy};
function source(state:Recruitment,vacancies:readonly Vacancy[],id:string,scope?:string):Source|undefined{const hire=state.hires.find(h=>h.id===id),app=state.applications.find(a=>a.id===hire?.applicationId),vacancy=vacancies.find(v=>v.id===app?.vacancyId);return hire&&vacancy&&(!scope||scope===vacancy.id)?{hire,vacancy}:undefined;}
const fingerprint=(s:Source)=>JSON.stringify([s.hire,s.vacancy.id,s.vacancy.date,s.vacancy.title]);
export function payrollSources(state:Recruitment,vacancies:readonly Vacancy[],status:Hire['status'],scope?:string){return state.hires.filter(h=>h.status===status).flatMap(h=>{const s=source(state,vacancies,h.id,scope);return s?[s]:[];});}
export function makePayrollReview(s:Source):PayrollReview{return {hireId:s.hire.id,baseline:fingerprint(s),selected:true,extra:{...emptyExtra,employer:s.hire.employer,job:s.hire.row[7]}};}
function date(s:string){const d=new Date(s+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==s)throw Error('Fecha de origen inválida.');return s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4);}
function clean(s:string){if(typeof s!=='string'||s.length>250||/[\u0000-\u001F\u007F]/.test(s))throw Error('Campo adicional inválido; máximo 250 caracteres, sin saltos de línea.');return s.trim();}
function safe(s:string){const v=s.replace(/[\t\r\n]+/g,' ');return /^\s*[=+\-@]/.test(v)?"'"+v:v;}
export function payrollPlan(state:Recruitment,vacancies:readonly Vacancy[],review:readonly PayrollReview[],status:Hire['status'],scope?:string){
 const selected=review.filter(r=>r.selected);if(!selected.length||selected.length>100||new Set(selected.map(r=>r.hireId)).size!==selected.length)throw Error('Selecciona entre 1 y 100 ingresos distintos.');
 const people=new Set<string>();
 return selected.map(r=>{const s=source(state,vacancies,r.hireId,scope);if(!s||s.hire.status!==status||fingerprint(s)!==r.baseline)throw Error('El ingreso o la fecha de solicitud cambió. Recupera el lote de nuevo.');
 const h=s.hire,x=h.row;if(!/^DEMO-[A-Z0-9-]+$/i.test(x[0])||!/^\S+@\S+\.invalid$/i.test(x[4]))throw Error('Solo códigos DEMO y correos ficticios.');
 const key=x[0].toUpperCase()+'|'+x[5];if(people.has(key))throw Error('Candidato y fecha de ingreso repetidos en el lote. Revisa el proceso.');people.add(key);
 const e=Object.fromEntries(extraFields.map(k=>[k,clean(r.extra[k])])) as Extra;if(!e.employer||!e.job)throw Error('Empresa/tipo de proceso y cargo son obligatorios.');
 const values=[e.employer,date(s.vacancy.date),x[0],x[1],x[2],x[3],x[4],e.nationality,date(x[5]),e.job,e.reason,e.detail,e.identity,e.dose1,e.dose2,e.dose3,e.sis,x[6]];
 return {hireId:h.id,values,missing:payrollHeaders.filter((_,i)=>!values[i])};
 });
}
export type PayrollRow=ReturnType<typeof payrollPlan>[number];
export function payrollTSV(rows:readonly PayrollRow[]){return rows.map(r=>r.values.map(safe).join('\t')).join('\n');}
export function payrollCSV(rows:readonly PayrollRow[]){return '\uFEFF'+[payrollHeaders,...rows.map(r=>r.values)].map(r=>r.map(x=>'"'+safe(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');}
