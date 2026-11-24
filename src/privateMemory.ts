import {BACKUP_KEYS,inspectBackup,makeBackup} from './backup.js';
import type {StoragePort} from './vacancies.js';
import type {privateWorkspace} from './privateWorkspace.js';
type Controller=Pick<ReturnType<typeof privateWorkspace>,'view'|'stage'>;
export function privateMemoryPort(c:Controller,now=()=>new Date().toISOString()):StoragePort{
 let cachedRaw:string|null=null,cachedData:ReturnType<typeof inspectBackup>['data']|null=null;
 function current(){const v=c.view();if(v.phase==='locked'||!v.snapshot){cachedRaw=null;cachedData=null;throw Error('Acceso privado cerrado.');}const raw=v.draft??v.snapshot.raw;if(raw!==cachedRaw||!cachedData){cachedData=inspectBackup(raw).data;cachedRaw=raw;}return cachedData;}
 return {getItem(k){if(!BACKUP_KEYS.some(x=>x===k))return null;return current()[k as keyof NonNullable<typeof cachedData>]??null;},setItem(k,value){if(!BACKUP_KEYS.some(x=>x===k))throw Error('Clave fuera del espacio privado.');const v=c.view();if(v.phase!=='ready'||v.busy)throw Error('Edición privada bloqueada.');const data={...current(),[k]:value};const next=makeBackup({getItem:key=>data[key as keyof typeof data]??null,setItem:()=>{throw Error('Solo lectura');}},now());c.stage(next);cachedRaw=null;cachedData=null;}};
}
