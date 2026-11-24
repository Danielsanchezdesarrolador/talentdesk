import type {Terms} from './catalogs.js';
export type VacancyEvent={at:string;action:'Creada'|'Editada'|'Cerrada'|'Reabierta';slots:number;covered:number};
export type Vacancy = { id: string; title: string; unit: string; slots: number; status: 'Activa' | 'Cerrada'; date: string; terms?: Terms; manager?:string; vacancyType?:string; covered?:number; history?:VacancyEvent[] };
export type Draft = Omit<Vacancy, 'id'>;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export const KEY = 'talentdesk.synthetic.v1';
export const emptyDraft: Draft = {title:'',unit:'',slots:1,status:'Activa',date:''};
const normalize = (s: string) => s.trim().normalize('NFKC').toLocaleLowerCase('es-CL').replace(/\s+/g,' ');
function validDate(date: string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false; const parsed = new Date(date+'T00:00:00Z'); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0,10)===date; }
export function validateDraft(d: Draft): Draft {
 if(typeof d.title!=='string'||typeof d.unit!=='string'||!d.title.trim()||!d.unit.trim()||d.title.trim().length>100||d.unit.trim().length>100) throw new Error('Completa cargo y unidad (máximo 100 caracteres).');
 if(!Number.isSafeInteger(d.slots)||d.slots<1||d.slots>999) throw new Error('Los cupos deben ser entre 1 y 999.');
 if(d.status!=='Activa'&&d.status!=='Cerrada') throw new Error('Estado inválido.');
 if(typeof d.date!=='string'||!validDate(d.date)) throw new Error('Indica una fecha válida.');
 const clean:Draft={title:d.title.trim(),unit:d.unit.trim(),slots:d.slots,status:d.status,date:d.date};
 if(d.terms!==undefined){const t=d.terms;if(!t||typeof t!=='object'||!['rateId','job','unit','schedule','employer','from'].every(k=>typeof t[k as keyof Terms]==='string'&&String(t[k as keyof Terms]).trim())||!Number.isSafeInteger(t.amount)||t.amount<1||t.amount>100000000||!validDate(t.from)||t.from>d.date||normalize(t.job)!==normalize(d.title)||normalize(t.unit)!==normalize(d.unit))throw Error('Condiciones de renta inválidas para la vacante.');clean.terms={rateId:t.rateId,job:t.job,unit:t.unit,schedule:t.schedule,employer:t.employer,amount:t.amount,from:t.from};}
 for(const k of ['manager','vacancyType'] as const){if(d[k]!==undefined){if(typeof d[k]!=='string'||d[k]!.length>100)throw Error('Información de vacante inválida.');clean[k]=d[k]!.trim();}}
 if(d.covered!==undefined){if(!Number.isSafeInteger(d.covered)||d.covered<0||d.covered>d.slots)throw Error('Los cupos cubiertos no pueden superar los solicitados.');clean.covered=d.covered;}
 if(d.history!==undefined){if(!Array.isArray(d.history)||d.history.some(x=>!x||!Number.isFinite(Date.parse(x.at))||!['Creada','Editada','Cerrada','Reabierta'].includes(x.action)||!Number.isSafeInteger(x.slots)||!Number.isSafeInteger(x.covered)||x.covered<0||x.covered>x.slots))throw Error('Historial de vacante inválido.');clean.history=d.history.map(x=>({...x}));}
 return clean;
}
export function saveVacancy(rows: readonly Vacancy[], draft: Draft, id: string, editing = false): Vacancy[] {
 const d=validateDraft(draft); if(!id||rows.some(x=>x.id===id)!==editing) throw new Error('Registro no válido o ya existente.');
 if(rows.some(x=>x.id!==id&&x.status==='Activa'&&d.status==='Activa'&&normalize(x.title)===normalize(d.title)&&normalize(x.unit)===normalize(d.unit)&&x.date===d.date)) throw new Error('Ya existe una vacante activa para ese cargo, unidad y fecha. Edita la existente.');
 const next={...d,id}; return editing?rows.map(x=>x.id===id?next:x):[next,...rows];
}
export function loadRows(storage: StoragePort): Vacancy[] {
 const raw=storage.getItem(KEY); if(raw===null) return [];
 const decoded:unknown=JSON.parse(raw); if(!Array.isArray(decoded)) throw new Error('Formato de almacenamiento inválido.');
 const ids=new Set<string>(); return decoded.map((x:unknown)=>{if(!x||typeof x!=='object') throw new Error('Registro inválido.'); const v=x as Vacancy; if(typeof v.id!=='string'||!v.id||ids.has(v.id)) throw new Error('Identificador inválido.'); ids.add(v.id); return {...validateDraft(v),id:v.id};});
}
export function persistRows(storage: StoragePort, rows: readonly Vacancy[]): void {storage.setItem(KEY,JSON.stringify(rows));}
export function queryRows(rows: readonly Vacancy[], query: string, status: 'Todas'|Vacancy['status']): Vacancy[] {const q=normalize(query);return rows.filter(v=>(status==='Todas'||v.status===status)&&normalize(v.title+' '+v.unit).includes(q));}
export function metrics(rows:readonly Vacancy[]){const active=rows.filter(r=>r.status==='Activa');return {active:active.length,slots:active.reduce((sum,r)=>sum+r.slots,0),closed:rows.length-active.length};}

export function saveVacancyWithHistory(rows:readonly Vacancy[],draft:Draft,id:string,editing:boolean,at:string){if(!Number.isFinite(Date.parse(at)))throw Error('Fecha inválida.');const prior=rows.find(v=>v.id===id);const action:VacancyEvent['action']=!prior?'Creada':prior.status!==draft.status?(draft.status==='Cerrada'?'Cerrada':'Reabierta'):'Editada';return saveVacancy(rows,{...draft,history:[{at,action,slots:draft.slots,covered:draft.covered??0},...(prior?.history??[])]},id,editing);}
