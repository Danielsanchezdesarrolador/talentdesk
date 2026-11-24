import {emptyDraft,type Draft,type Vacancy} from './vacancies.js';
import {activeEntries,matchRates,snapshotTerms,type Entry} from './catalogs.js';
const norm=(s:string)=>s.normalize('NFKC').trim().toLocaleLowerCase('es-CL').replace(/\s+/g,' ');
export function freshVacancy(today:string):Draft{return {...emptyDraft,date:today,covered:0};}
export function uniqueTerms(catalog:readonly Entry[],draft:Draft){const rates=matchRates(catalog,draft.title,draft.unit,draft.date);return rates.length===1?snapshotTerms(catalog,rates[0].id,draft.date):undefined;}
export function changeContext(catalog:readonly Entry[],draft:Draft,patch:Partial<Pick<Draft,'title'|'unit'|'date'>>,auto:boolean):Draft{
 const next={...draft,...patch,terms:undefined};
 if('unit' in patch&&norm(patch.unit??'')!==norm(draft.unit))next.manager='';
 return {...next,terms:auto?uniqueTerms(catalog,next):undefined};
}
export function duplicateVacancy(source:Vacancy,catalog:readonly Entry[],today:string):Draft{
 const next:Draft={...freshVacancy(today),title:source.title,unit:source.unit,slots:source.slots,manager:source.manager,vacancyType:source.vacancyType};
 return {...next,terms:uniqueTerms(catalog,next)};
}
export type RequestHints={patch:Partial<Pick<Draft,'title'|'unit'|'slots'|'manager'|'vacancyType'>>;warnings:string[]};
function contains(text:string,name:string){const escaped=norm(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^\\p{L}\\p{N}])'+escaped+'($|[^\\p{L}\\p{N}])','u').test(text);}
export function readRequest(raw:string,catalog:readonly Entry[]):RequestHints{
 if(typeof raw!=='string'||!raw.trim()||raw.length>10000)throw Error('Pega una solicitud ficticia de hasta 10.000 caracteres.');
 const input=norm(raw),patch:RequestHints['patch']={},warnings:string[]=[];
 for(const [kind,key] of [['Cargos','title'],['Unidades','unit'],['Jefaturas','manager']] as const){
  const matches=activeEntries(catalog,kind).filter(r=>contains(input,r.name));
  if(matches.length===1)patch[key]=matches[0].name;
  else if(matches.length>1)warnings.push(kind+': hay varias coincidencias; elige manualmente.');
  else if(key!=='manager')warnings.push(kind+': sin coincidencia de catálogo.');
 }
 const numbers=[...raw.matchAll(/(?:cupos?\s*[:=]\s*(\d{1,3})\b|\b(\d{1,3})\s+cupos?\b)/gi)].map(m=>Number(m[1]??m[2]));
 const distinct=[...new Set(numbers)];
 if(distinct.length===1&&distinct[0]>0)patch.slots=distinct[0];else warnings.push('Cupos: confirma la cantidad; solo se reconocen expresiones explícitas como «Cupos: 2».');
 warnings.push('Revisa todas las sugerencias. Las fechas de ingreso, horarios y rentas no se infieren del texto.');
 return {patch,warnings};
}
export function applyRequest(catalog:readonly Entry[],draft:Draft,hints:RequestHints):Draft{
 const {title,unit,slots,manager,vacancyType}=hints.patch;
 const changed=changeContext(catalog,draft,{...(title!==undefined?{title}:{}),...(unit!==undefined?{unit}:{})},true);
 return {...changed,...(slots!==undefined?{slots}:{}),...(manager!==undefined?{manager}:{}),...(vacancyType!==undefined?{vacancyType}:{})};
}
