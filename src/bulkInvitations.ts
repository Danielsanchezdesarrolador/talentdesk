import {parseDelimited,normalize} from './imports.js';
import type {Entry} from './catalogs.js';
export type InviteRow={id:string;name:string;email:string;date:string;time:string;job:string;selected:boolean};
export type Common={date:string;job:string;place:string;interviewer:string;instructions:string;templateId:string};
export type DraftMail={id:string;name:string;email:string;date:string;time:string;job:string;place:string;interviewer:string;instructions:string;subject:string;body:string};
export type Mode='header'|'wide'|'compact';
const max=100;
function clean(s:string){return s.trim().replace(/\s+/g,' ');}
function validDay(s:string){const d=new Date(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;}
function day(s:string){const a=s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);const result=a?a[3]+'-'+a[2].padStart(2,'0')+'-'+a[1].padStart(2,'0'):s.trim();return validDay(result)?result:'';}
function time(s:string){const a=s.trim().match(/^(\d{1,2}):([0-5]\d)(?::00)?$/);return a&&Number(a[1])<24?a[1].padStart(2,'0')+':'+a[2]:'';}
function splitDate(s:string){const a=s.trim().match(/^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s*(?:\/\s*)?(\d{1,2}:\d{2}(?::00)?)$/);return a?{date:day(a[1]),time:time(a[2])}:{date:day(s),time:''};}
function email(s:string){return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.invalid$/i.test(s)&&s.length<=180;}
export function parseInvitationRows(raw:string,mode:Mode):InviteRow[]{
 if(!raw.trim()||raw.length>200000)throw Error('Pega una tabla ficticia de hasta 200.000 caracteres.');
 const grid=parseDelimited(raw,'\t');let rows=grid;let name=0,mail=mode==='wide'?3:1,dateCol=mode==='wide'?4:2,timeCol=-1,jobCol=mode==='wide'?-2:3;
 if(mode==='header'){
  const header=grid[0].map(normalize);
  function col(aliases:string[],required=false){const indices=header.flatMap((s,i)=>aliases.includes(s)?[i]:[]);if(indices.length>1||required&&!indices.length)throw Error('Encabezado ausente o ambiguo: '+aliases[0]);return indices[0]??-1;}
  name=col(['nombre completo','nombre','candidato','nombres'],true);mail=col(['correo','email','correo electronico','correo ficticio'],true);dateCol=col(['fecha y hora','fecha / hora','fecha entrevista','fecha de entrevista','fecha']);timeCol=col(['hora','hora entrevista','hora de entrevista']);jobCol=col(['cargo','puesto','vacante']);rows=grid.slice(1);
 }
 if(!rows.length||rows.length>max)throw Error('Se admiten entre 1 y 100 filas de candidatos.');
 return rows.map((r,i)=>{const at=splitDate(r[dateCol]??'');return {id:'fila-'+(i+1),name:clean(r[name]??''),email:(r[mail]??'').trim().toLowerCase(),date:at.date,time:timeCol>=0?time(r[timeCol]??''):at.time,job:clean((jobCol===-2?r.length>=6?r[r.length-1]:'':r[jobCol])??''),selected:true};});
}
export function assignTimes(rows:readonly InviteRow[],date:string,start:string,interval:number){
 if(!validDay(date)||!time(start)||![10,15,20,30,45,60].includes(interval))throw Error('Fecha, hora o intervalo inválidos.');
 const [h,m]=time(start).split(':').map(Number);const selected=rows.filter(r=>r.selected).length;
 if(!selected||h*60+m+(selected-1)*interval>=1440)throw Error('El horario excede el día o no hay filas seleccionadas.');
 let n=0;return rows.map(r=>{if(!r.selected)return r;const total=h*60+m+n++*interval;return {...r,date,time:String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')};});
}
export function buildInvitations(rows:readonly InviteRow[],common:Common,catalog:readonly Entry[]){
 const chosen=rows.filter(r=>r.selected);
 if(!chosen.length||chosen.length>max)throw Error('Selecciona entre 1 y 100 filas.');
 if(!clean(common.place)||common.place.length>200||!clean(common.interviewer)||common.interviewer.length>100||common.instructions.length>2000||common.job.length>150)throw Error('Completa lugar y entrevistador; revisa la longitud de los campos.');
 const template=common.templateId?catalog.find(t=>t.id===common.templateId&&t.kind==='Plantillas'&&t.active):undefined;
 if(common.templateId&&!template)throw Error('Plantilla no disponible.');
 const mails:DraftMail[]=[],issues:{id:string;message:string}[]=[];
 const emails=new Set<string>(),slots=new Set<string>();
 for(const r of chosen){
  const name=clean(r.name),recipient=r.email.trim().toLowerCase(),date=r.date||common.date,job=clean(r.job||common.job),t=time(r.time);
  const problems:string[]=[];
  if(!name||name.length>180)problems.push('nombre requerido');if(!email(recipient))problems.push('solo correo ficticio .invalid');if(!validDay(date))problems.push('fecha inválida');if(!t)problems.push('hora inválida');if(!job||job.length>150)problems.push('cargo requerido');
  if(emails.has(recipient))problems.push('correo repetido en lote');if(slots.has(date+' '+t))problems.push('horario repetido en lote');
  if(recipient)emails.add(recipient);if(date&&t)slots.add(date+' '+t);
  if(problems.length){issues.push({id:r.id,message:problems.join(' · ')});continue;}
  const place=clean(common.place),interviewer=clean(common.interviewer),instructions=common.instructions.trim(),values:Record<string,string>={nombre:name,cargo:job,fecha:date,hora:t,lugar:place,entrevistador:interviewer,instrucciones:instructions};
  const intro=template?.detail?template.detail.replace(/\{\{([a-z]+)\}\}/g,(_,key:string)=>Object.hasOwn(values,key)?values[key]:'{{'+key+'}}'):'Hola '+name+', te invitamos a una entrevista.';
  if(/\{\{[^}]+\}\}/.test(intro)){issues.push({id:r.id,message:'Plantilla contiene variables no reconocidas.'});continue;}
  mails.push({id:r.id,name,email:recipient,date,time:t,job,place,interviewer,instructions,subject:'DEMO | Citación a entrevista · '+job,body:['BORRADOR DEMO — NO ENVIAR',intro,'Cargo: '+job,'Fecha: '+date,'Hora: '+t+' (Chile continental)','Lugar: '+place,'Entrevistador: '+interviewer,instructions,'Por favor confirma tu asistencia.','Saludos.'].filter(Boolean).join('\n')});
 }
 return {mails:issues.length?[]:mails,issues};
}
function csvCell(s:string){const safe=/^[\s]*[=+\-@]/.test(s)?"'"+s:s;return '"'+safe.replace(/"/g,'""')+'"';}
export function invitationCSV(mails:readonly DraftMail[]){if(!mails.length||mails.some(m=>!email(m.email)))throw Error('No hay borradores ficticios válidos.');return '\uFEFF'+[['Nombre','Correo','Fecha','Hora','Cargo','Lugar','Entrevistador','Instrucciones','Asunto','Mensaje'],...mails.map(m=>[m.name,m.email,m.date,m.time,m.job,m.place,m.interviewer,m.instructions,m.subject,m.body])].map(r=>r.map(csvCell).join(';')).join('\r\n');}
