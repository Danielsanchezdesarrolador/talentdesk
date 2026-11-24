// HTTP contract adapter for the local synthetic lab. Not mounted in the public application.
import {inspectBackup} from './backup.js';
import type {Receipt,RevisionTransport,Snapshot,WriteRequest,WriteOutcome} from './revisionSync.js';
export class AccessDenied extends Error {constructor(){super('Sesión privada no autorizada.');this.name='AccessDenied';}}
const root='/api/private-lab';
function snapshot(value:unknown):Snapshot{const s=value as Snapshot;if(!s||!Number.isSafeInteger(s.revision)||s.revision<0||typeof s.raw!=='string')throw Error('Respuesta inválida.');inspectBackup(s.raw);return {revision:s.revision,raw:s.raw};}
function receipt(value:unknown):Receipt{const r=value as Receipt;if(!r||typeof r.requestId!=='string'||!/^[A-Za-z0-9-]{1,100}$/.test(r.requestId))throw Error('Recibo inválido.');return {requestId:r.requestId,...snapshot(r)};}
export function privateTransport(send:typeof fetch=fetch){
 function request(path:string,body?:unknown){return send(root+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});}
 function check(res:Response){if(res.status===401||res.status===403)throw new AccessDenied();if(!res.ok)throw Error('Servicio privado no disponible.');}
 const transport:RevisionTransport={
  async write(r:WriteRequest):Promise<WriteOutcome>{const res=await request('/revisions',r);if(res.status===401||res.status===403)return {kind:'denied'};if(res.status===409)return {kind:'conflict'};check(res);const out=await res.json();if(out.kind!=='committed')throw Error('Respuesta de escritura inválida.');return {kind:'committed',receipt:receipt(out.receipt)};},
  async readReceipt(id:string){if(!/^[A-Za-z0-9-]{1,100}$/.test(id))throw Error('Identificador inválido.');const res=await request('/receipts/'+id);if(res.status===404)return null;check(res);return receipt(await res.json());}
 };
 return {...transport,async login(secret:string){const res=await request('/login',{secret});check(res);if((await res.json()).authenticated!==true)throw Error('Sesión inválida.');},async session(){const res=await request('/session');check(res);if((await res.json()).authenticated!==true)throw new AccessDenied();},async snapshot(){const res=await request('/snapshot');check(res);return snapshot(await res.json());},async logout(){const res=await request('/logout',{});check(res);}};
}
