// Synthetic private-lab state machine. Not mounted in the public DEMO.
import {inspectBackup,makeBackup} from './backup.js';
import {loadRecruitment,persistRecruitment,saveCandidate,emptyCandidate} from './recruitment.js';
import {publishRevision,reconcile,type Snapshot,type WriteRequest,type SyncResult,type RevisionTransport} from './revisionSync.js';
type API=RevisionTransport&{login(secret:string):Promise<void>;session():Promise<void>;snapshot():Promise<Snapshot>;logout():Promise<void>};
export type PrivateView={phase:'locked'|'ready'|'conflict'|'uncertain';busy:boolean;snapshot:Snapshot|null;draft:string|null;pending:WriteRequest|null;message:string};
const locked=(message:string):PrivateView=>({phase:'locked',busy:false,snapshot:null,draft:null,pending:null,message});
export function privateWorkspace(api:API,notify:(v:PrivateView)=>void,id=()=>crypto.randomUUID(),now=()=>new Date().toISOString()){
 let v=locked('Acceso cerrado.');let generation=0;
 function set(next:PrivateView){v=next;notify(v);}
 function lock(message='Acceso cerrado.'){generation++;set(locked(message));}
 function patch(p:Partial<PrivateView>){set({...v,...p});}
 async function run(fn:(g:number)=>Promise<void>){if(v.busy)return;const g=++generation;patch({busy:true});try{await fn(g);}catch{if(g===generation)lock('No se pudo verificar el acceso o la conexión. Datos retirados de la vista.');}finally{if(g===generation)patch({busy:false});}}
 const current=(g:number)=>g===generation;
 function accept(s:Snapshot,message:string){inspectBackup(s.raw);if(!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('Invalid revision');patch({phase:'ready',snapshot:s,draft:null,pending:null,message});}
 async function load(g:number){await api.session();const s=await api.snapshot();await api.session();if(current(g))accept(s,'Información recuperada del servidor.');}
 async function result(g:number,r:SyncResult){if(!current(g))return;if(r.kind==='denied'){lock('Acceso revocado.');return;}await api.session();if(!current(g))return;if(r.kind==='confirmed')accept(r.snapshot,'Revisión confirmada por el servidor.');else if(r.kind==='conflict')patch({phase:'conflict',pending:null,message:'Otra sesión guardó primero. Tu borrador no se sobrescribió. Descarta el borrador para recuperar la versión actual.'});else patch({phase:'uncertain',message:'Resultado incierto. Consulta el recibo; no se repetirá la escritura.'});}
 return {
  view:()=>v,lock,
  stage:(raw:string)=>{if(v.busy||v.phase!=='ready'||!v.snapshot)throw Error('El espacio privado no está disponible para editar.');inspectBackup(raw);patch({draft:raw,message:'Cambios en memoria. Pendientes de guardar en servidor.'});},
  resume:()=>run(async g=>{if(v.phase!=='locked')return;await load(g);}),
  login:(secret:string)=>run(async g=>{if(v.phase!=='locked')return;await api.login(secret);if(current(g))await load(g);}),
  check:()=>run(async g=>{if(v.phase==='locked')return;await api.session();if(!current(g))return;}),
  refresh:()=>run(async g=>{if(v.phase==='locked'||v.phase==='uncertain')return;await api.session();const s=await api.snapshot();await api.session();if(!current(g))return;if(v.snapshot&&s.revision<v.snapshot.revision)throw Error('Revision rollback');if(v.draft){if(s.revision!==v.snapshot?.revision||s.raw!==v.snapshot.raw)patch({phase:'conflict',message:'Existe una versión nueva. El borrador permanece sin guardar.'});else patch({message:'Borrador conservado. Sin cambios remotos.'});}else accept(s,'Información actualizada desde el servidor.');}),
  add:()=>{if(v.busy||v.phase!=='ready'||!v.snapshot)return;const b=inspectBackup(v.draft??v.snapshot.raw),data=new Map(Object.entries(b.data));const port={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,x:string)=>{data.set(k,x);}};const tag=id();const code=tag.replace(/[^a-zA-Z0-9]/g,'').slice(0,24).toUpperCase();const r=saveCandidate(loadRecruitment(port),{...emptyCandidate,firstName:'Persona',lastName:'Ficticia '+code,code:'DEMO-'+code,email:code.toLowerCase()+'@example.invalid'},tag);persistRecruitment(port,r);patch({draft:makeBackup(port,now()),message:'Borrador sintético en memoria. Aún no guardado.'});},
  save:()=>run(async g=>{if(v.phase!=='ready'||!v.draft||!v.snapshot)return;const request={requestId:id(),expectedRevision:v.snapshot.revision,raw:v.draft};await api.session();if(!current(g))return;patch({pending:request});await result(g,await publishRevision(api,request));}),
  recover:()=>run(async g=>{if(v.phase!=='uncertain'||!v.pending)return;const request=v.pending;await api.session();if(!current(g))return;await result(g,await reconcile(api,request));}),
  discard:()=>run(async g=>{if(v.phase==='locked'||v.phase==='uncertain')return;await load(g);}),
  logout:async()=>{const g=++generation;set(locked('Vista cerrada. Verificando cierre de sesión.'));try{await api.logout();if(current(g))set(locked('Sesión cerrada en servidor.'));}catch{if(current(g))set(locked('Vista cerrada; no se pudo confirmar el cierre en servidor.'));}}
 };
}
