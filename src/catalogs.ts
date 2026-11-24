import type {StoragePort} from './vacancies.js';
export const kinds=['Cargos','Unidades','Jefaturas','Horarios','Empresas','Rentas','Plantillas'] as const;
export type Kind=typeof kinds[number];
export type Entry={id:string;kind:Kind;name:string;detail:string;active:boolean;jobId:string;unitId:string;scheduleId:string;employerId:string;amount:number;from:string};
export type CatalogDraft=Omit<Entry,'id'>;
export type Terms={rateId:string;job:string;unit:string;schedule:string;employer:string;amount:number;from:string};
export const CATALOG_KEY='talentdesk.catalogs.synthetic.v1';
export const blank=(kind:Kind):CatalogDraft=>({kind,name:'',detail:'',active:true,jobId:'',unitId:'',scheduleId:'',employerId:'',amount:0,from:''});
const norm=(s:string)=>s.trim().normalize('NFKC').toLocaleLowerCase('es-CL').replace(/\s+/g,' ');
export const activeEntries=(rows:readonly Entry[],kind:Kind)=>rows.filter(r=>r.kind===kind&&r.active);
const refs=[['jobId','Cargos'],['unitId','Unidades'],['scheduleId','Horarios'],['employerId','Empresas']] as const;
function dateOK(s:string){const d=new Date(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;}
function clean(d:CatalogDraft):CatalogDraft{
 if(!kinds.includes(d.kind)||typeof d.name!=='string'||!d.name.trim()||d.name.trim().length>100||typeof d.detail!=='string'||d.detail.length>3000||typeof d.active!=='boolean')throw Error('Datos de catálogo inválidos.');
 const next={...blank(d.kind),name:d.name.trim(),detail:d.detail.trim(),active:d.active};
 if(d.kind==='Rentas'){
  if(!Number.isSafeInteger(d.amount)||d.amount<1||d.amount>100000000||typeof d.from!=='string'||!dateOK(d.from))throw Error('Indica renta CLP y vigencia válidas.');
  for(const [key] of refs){if(typeof d[key]!=='string'||!d[key])throw Error('Completa las cuatro referencias de la renta.');next[key]=d[key];}
  next.amount=d.amount;next.from=d.from;
 }
 return next;
}
function checkRefs(rows:readonly Entry[],d:CatalogDraft,activeOnly:boolean){
 if(d.kind!=='Rentas')return;
 for(const [key,kind] of refs)if(!rows.some(r=>r.id===d[key]&&r.kind===kind&&(!activeOnly||r.active)))throw Error('La renta requiere referencias '+(activeOnly?'activas':'existentes')+'.');
}
export function saveEntry(rows:readonly Entry[],draft:CatalogDraft,id:string,editing=false):Entry[]{
 const d=clean(draft), prior=rows.find(r=>r.id===id);
 if(!id||Boolean(prior)!==editing||(prior&&prior.kind!==d.kind))throw Error('Identificador inválido.');
 checkRefs(rows,d,d.active);
 if(rows.some(r=>r.id!==id&&r.kind===d.kind&&norm(r.name)===norm(d.name)))throw Error('Ya existe ese nombre en el catálogo.');
 if(d.kind==='Rentas'&&d.active&&rows.some(r=>r.id!==id&&r.kind==='Rentas'&&r.active&&r.from===d.from&&refs.every(([k])=>r[k]===d[k])))throw Error('Ya existe una renta activa para esas condiciones y vigencia.');
 if(!d.active&&d.kind!=='Rentas'&&rows.some(r=>r.kind==='Rentas'&&r.active&&refs.some(([k])=>r[k]===id)))throw Error('Desactiva primero las rentas activas que utilizan este registro.');
 const entry={...d,id};return editing?rows.map(r=>r.id===id?entry:r):[entry,...rows];
}
export function loadCatalogs(storage:StoragePort):Entry[]{
 const raw=storage.getItem(CATALOG_KEY);if(raw===null)return [];
 const data:unknown=JSON.parse(raw);if(!Array.isArray(data))throw Error('Catálogo corrupto.');
 const ids=new Set<string>();const rows=data.map((v:unknown)=>{if(!v||typeof v!=='object')throw Error('Registro inválido.');const r=v as Entry;if(typeof r.id!=='string'||!r.id||ids.has(r.id))throw Error('Identificador inválido.');ids.add(r.id);return {...clean(r),id:r.id};});
 for(const row of rows)checkRefs(rows,row,row.active);
 return rows;
}
export function persistCatalogs(storage:StoragePort,rows:readonly Entry[]){storage.setItem(CATALOG_KEY,JSON.stringify(rows));}
export function snapshotTerms(rows:readonly Entry[],rateId:string,date:string):Terms{
 const r=rows.find(x=>x.id===rateId&&x.kind==='Rentas'&&x.active);if(!r||!dateOK(date)||r.from>date)throw Error('Renta no disponible para la fecha.');
 checkRefs(rows,r,true);const name=(id:string)=>rows.find(x=>x.id===id)!.name;
 return {rateId:r.id,job:name(r.jobId),unit:name(r.unitId),schedule:name(r.scheduleId),employer:name(r.employerId),amount:r.amount,from:r.from};
}
export function matchRates(rows:readonly Entry[],job:string,unit:string,date:string):Entry[]{
 if(!dateOK(date))return [];
 const eligible=activeEntries(rows,'Rentas').filter(r=>r.from<=date&&rows.some(x=>x.id===r.jobId&&x.active&&norm(x.name)===norm(job))&&rows.some(x=>x.id===r.unitId&&x.active&&norm(x.name)===norm(unit)));
 return eligible.filter(r=>!eligible.some(s=>s.from>r.from&&refs.every(([k])=>s[k]===r[k]))).sort((a,b)=>b.from.localeCompare(a.from));
}
