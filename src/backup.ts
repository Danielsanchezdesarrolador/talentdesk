import {KEY,loadRows,type StoragePort} from './vacancies.js';
import {CATALOG_KEY,loadCatalogs} from './catalogs.js';
import {RECRUITMENT_KEY,loadRecruitment} from './recruitment.js';
import {OPS_KEY,loadOps} from './operations.js';
import {sourceExists} from './communicationHistory.js';
import {totalCovered,incomeHeaders} from './selection.js';
export const RESTORE_MARKER='talentdesk.restore.pending.v1';
export const BACKUP_KEYS=[KEY,CATALOG_KEY,RECRUITMENT_KEY,OPS_KEY] as const;
type Key=typeof BACKUP_KEYS[number];
export type RestorePort=StoragePort&Pick<Storage,'removeItem'>;
export const MAX_BACKUP_CHARS=1500000;
type Backup={format:'talentdesk-demo-backup';version:1;exportedAt:string;data:Record<Key,string>};
function validBundle(data:Record<Key,string>){
 const port={getItem:(k:string)=>data[k as Key]??null,setItem:()=>{throw Error('Solo lectura')}};
 const vacancies=loadRows(port),catalog=loadCatalogs(port),recruit=loadRecruitment(port),ops=loadOps(port);
 if(recruit.applications.some(a=>!vacancies.some(v=>v.id===a.vacancyId))||ops.documents.some(d=>!recruit.applications.some(a=>a.id===d.applicationId))||ops.tasks.some(t=>t.vacancyId&&!vacancies.some(v=>v.id===t.vacancyId))||vacancies.some(v=>totalCovered(recruit,v)>v.slots))throw Error('El respaldo contiene referencias o coberturas inconsistentes.');
 if((ops.communications??[]).some(r=>!sourceExists(r.message,{recruit})))throw Error('Borrador histórico sin referencia de origen.');
 for(const r of ops.runs){const h=recruit.hires.find(h=>h.id===r.sourceId&&h.status==='Confirmado DEMO');if(!h)throw Error('Ejecución sin ingreso confirmado.');const expected=r.flow==='PA-01'?{mode:'DEMO',requestId:r.id,columns:incomeHeaders,row:h.row}:{mode:'DEMO',requestId:r.id,recipient:h.recipient,subject:h.subject,body:h.body};if(JSON.stringify(JSON.parse(r.payload))!==JSON.stringify(expected))throw Error('Payload de automatización inconsistente.');}
 return {data:{[KEY]:JSON.stringify(vacancies),[CATALOG_KEY]:JSON.stringify(catalog),[RECRUITMENT_KEY]:JSON.stringify(recruit),[OPS_KEY]:JSON.stringify(ops)},counts:{vacancies:vacancies.length,candidates:recruit.candidates.length,applications:recruit.applications.length,hires:recruit.hires.length,documents:ops.documents.length,tasks:ops.tasks.length,fairs:ops.fairs.length}};
}
export function makeBackup(storage:StoragePort,at:string){
 if(storage.getItem(RESTORE_MARKER)!==null)throw Error('Hay una recuperación incompleta.');
 const data=Object.fromEntries(BACKUP_KEYS.map(k=>[k,storage.getItem(k)??(k===KEY||k===CATALOG_KEY?'[]':k===RECRUITMENT_KEY?'{"candidates":[],"applications":[],"contacts":[],"interviews":[],"hires":[]}':'{"documents":[],"tasks":[],"fairs":[],"runs":[]}')])) as Record<Key,string>;
 const canonical=validBundle(data).data;
 const raw=JSON.stringify({format:'talentdesk-demo-backup',version:1,exportedAt:at,data:canonical});
 inspectBackup(raw);return raw;
}
export function inspectBackup(raw:string){
 if(typeof raw!=='string'||raw.length>MAX_BACKUP_CHARS)throw Error('Respaldo demasiado grande.');
 const b=JSON.parse(raw) as Backup;
 if(!b||b.format!=='talentdesk-demo-backup'||b.version!==1||typeof b.exportedAt!=='string'||!Number.isFinite(Date.parse(b.exportedAt))||!b.data||Object.keys(b.data).length!==BACKUP_KEYS.length||BACKUP_KEYS.some(k=>typeof b.data[k]!=='string'))throw Error('Formato o versión de respaldo inválido.');
 return {...validBundle(b.data),exportedAt:b.exportedAt};
}
export function canRestore(storage:StoragePort){return storage.getItem(RESTORE_MARKER)===null&&BACKUP_KEYS.every(k=>storage.getItem(k)===null);}
export function recoverIncomplete(storage:RestorePort){if(storage.getItem(RESTORE_MARKER)!=='empty-profile-import')throw Error('No hay recuperación reconocida.');for(const k of BACKUP_KEYS)storage.removeItem(k);storage.removeItem(RESTORE_MARKER);}
export function restoreBackup(storage:RestorePort,raw:string){
 const b=inspectBackup(raw);
 if(!canRestore(storage))throw Error('La restauración requiere un perfil vacío. No se sobrescriben datos.');
 storage.setItem(RESTORE_MARKER,'empty-profile-import');
 try{for(const k of BACKUP_KEYS)storage.setItem(k,b.data[k]);for(const k of BACKUP_KEYS)if(storage.getItem(k)!==b.data[k])throw Error('Verificación de escritura fallida.');storage.removeItem(RESTORE_MARKER);}
 catch(e){try{recoverIncomplete(storage);}catch{throw Error('Recuperación incompleta. Cierra otras pestañas y utiliza la pantalla de recuperación.');}throw e;}
 return b.counts;
}
