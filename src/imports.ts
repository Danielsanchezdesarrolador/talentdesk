import {emptyCandidate,saveCandidate,addApplication,type CandidateDraft,type Recruitment} from './recruitment.js';
import {blank,saveEntry,kinds,type Entry,type Kind} from './catalogs.js';
import type {Vacancy} from './vacancies.js';
export const MAX_ROWS=500, MAX_TEXT=1000000;
export const simpleKinds=kinds.filter(k=>k!=='Rentas');
export type Target='Candidatos'|Kind;
export type Grid=string[][];
export const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').trim().toLowerCase().replace(/\s+/g,' ');
export function parseDelimited(raw:string,delimiter:string):Grid{
 if(![';',',','\t'].includes(delimiter)||raw.length>MAX_TEXT)throw Error('Archivo demasiado grande o separador inválido.');
 const rows:Grid=[];let row:string[]=[],field='',quoted=false,closed=false;
 const push=()=>{if(row.length>=60)throw Error('Máximo 60 columnas.');row.push(field);field='';closed=false;};
 const end=()=>{push();if(row.some(c=>c.trim())){rows.push(row);if(rows.length>MAX_ROWS+1)throw Error('Máximo 500 registros por lote.');}row=[];};
 const s=raw.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(c==='"'){if(s[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
 if(c===delimiter){push();continue;}if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;end();continue;}
 if(closed)throw Error('Comillas CSV inválidas.');if(c==='"'){if(field)throw Error('Comillas CSV inválidas.');quoted=true;}else field+=c;}
 if(quoted)throw Error('Comillas CSV sin cerrar.');if(field||row.length||closed)end();return validateGrid(rows);
}
export function validateGrid(rows:Grid):Grid{if(rows.length>MAX_ROWS+1||rows.some(r=>r.length>60||r.some(c=>typeof c!=='string'||c.length>10000))||rows.reduce((n,r)=>n+r.reduce((s,c)=>s+c.length,0),0)>MAX_TEXT)throw Error('Lote supera los límites de importación.');if(!rows.length)throw Error('No hay filas.');return rows;}
export const fields={firstName:['nombre','nombres'],lastName:['apellido','apellidos'],code:['codigo demo','codigo','identificador'],email:['correo','email','correo electronico'],phone:['telefono','nro telefono','celular'],profession:['profesion','cargo'],experience:['experiencia'],availability:['disponibilidad'],cv:['cv','curriculum'],notes:['observaciones','notas'],name:['nombre','cargo','unidad','horario','empresa','jefatura','plantilla','renta'],detail:['detalle','descripcion'],job:['cargo'],unit:['unidad'],schedule:['horario'],employer:['empresa'],amount:['renta clp','importe','monto','renta'],from:['vigente desde','vigencia','fecha vigencia']} as const;
export type Field=keyof typeof fields;
export const targetFields=(target:Target):Field[]=>target==='Candidatos'?['firstName','lastName','code','email','phone','profession','experience','availability','cv','notes']:target==='Rentas'?['name','detail','job','unit','schedule','employer','amount','from']:['name','detail'];
export type Mapping=Partial<Record<Field,number>>;
export function guessMapping(header:string[],target:Target):Mapping{const out:Mapping={};for(const key of targetFields(target)){const aliases:readonly string[]=target==='Rentas'&&key==='name'?['nombre','nombre de renta','nombre renta']:fields[key];const matches=header.map((h,i)=>({h:normalize(h),i})).filter(x=>aliases.includes(x.h));if(matches.length===1)out[key]=matches[0].i;}return out;}
export type Review={key:string;source:string;values:Partial<Record<Field,string>>;selected:boolean};
export function mappedRows(grid:Grid,map:Mapping,target:Target):Review[]{validateGrid(grid);return grid.slice(1).map((row,i)=>({key:'row-'+i,source:'Fila '+(i+2),selected:true,values:Object.fromEntries(targetFields(target).map(k=>[k,map[k]===undefined?'':row[map[k]!]??'']))}));}
export function extractCv(text:string,source:string,key:string):Review{
 if(text.length>MAX_TEXT)throw Error('Texto del CV demasiado extenso.');
 const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 const get=(labels:string[])=>{const matches=lines.flatMap(l=>{const i=l.indexOf(':');return i>=0&&labels.includes(normalize(l.slice(0,i)))?[l.slice(i+1).trim()]:[]});return matches.length===1?matches[0]:'';};
 const emails=[...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.invalid\b/gi)??[]).map(s=>s.toLowerCase()))];
 const phone=get(['telefono','celular','nro telefono']);const code=get(['codigo demo','codigo','identificador']);
 return {key,source,selected:true,values:{firstName:get(['nombre','nombres']),lastName:get(['apellido','apellidos']),code:/^DEMO-[A-Z0-9-]+$/i.test(code)?code:'',email:emails.length===1?emails[0]:'',phone:/^[0-9 +()-]+$/.test(phone)?phone:'',profession:get(['profesion','cargo']),experience:get(['experiencia']),availability:get(['disponibilidad']),cv:source.slice(0,250)}};
}
export type Preview={key:string;source:string;ok:boolean;message:string};
export function planImport(target:Target,review:Review[],catalog:Entry[],recruit:Recruitment,vacancies:readonly Vacancy[],vacancyId:string,makeId:()=>string,at:string){
 let nextCatalog=catalog,nextRecruit=recruit;const results:Preview[]=[];
 if(review.length>MAX_ROWS)throw Error('Máximo 500 registros.');
 for(const r of review){if(!r.selected)continue;try{
  const get=(k:Field)=>r.values[k]?.trim()??'';
  if(target==='Candidatos'){
   const d:CandidateDraft={...emptyCandidate,firstName:get('firstName'),lastName:get('lastName'),code:get('code'),email:get('email'),phone:get('phone'),profession:get('profession'),experience:get('experience'),availability:get('availability'),cv:get('cv'),notes:get('notes')};
   const id=makeId();let next=saveCandidate(nextRecruit,d,id);if(vacancyId)next=addApplication(next,vacancies,id,vacancyId,makeId(),at);nextRecruit=next;
  }else{
   const d={...blank(target),name:get('name'),detail:get('detail')};
   if(target==='Rentas'){
    const find=(kind:Kind,key:Field)=>{const matches=nextCatalog.filter(x=>x.kind===kind&&x.active&&normalize(x.name)===normalize(get(key)));if(matches.length>1)throw Error('Referencia ambigua: '+get(key)+'. Revisa el catálogo.');return matches[0]?.id??'';};
    Object.assign(d,{jobId:find('Cargos','job'),unitId:find('Unidades','unit'),scheduleId:find('Horarios','schedule'),employerId:find('Empresas','employer'),amount:/^\d+$/.test(get('amount'))?Number(get('amount')):NaN,from:get('from')});
   }
   nextCatalog=saveEntry(nextCatalog,d,makeId());
  }
  results.push({key:r.key,source:r.source,ok:true,message:'Listo para agregar'});
 }catch(e){results.push({key:r.key,source:r.source,ok:false,message:e instanceof Error?e.message:'Registro inválido'});}}
 return {catalog:nextCatalog,recruit:nextRecruit,results};
}

export function importTemplate(target:Target):string{
 const rows=target==='Candidatos'?[['Nombre','Apellido','Código DEMO','Correo','Teléfono','Profesión','Experiencia','Disponibilidad','CV','Observaciones'],['Persona','Ejemplo','DEMO-PLANTILLA','ejemplo@example.invalid','000000001','Cargo DEMO','','','','']]:target==='Rentas'?[['Nombre','Cargo','Unidad','Horario','Empresa','Renta CLP','Vigente desde','Detalle'],['Renta DEMO','Cargo DEMO','Unidad DEMO','Horario DEMO','Empresa DEMO','500000','2026-11-01','Valor ficticio']]:[['Nombre','Detalle'],[target+' DEMO','Ejemplo ficticio']];
 return '\uFEFF'+rows.map(r=>r.join(';')).join('\r\n');
}
