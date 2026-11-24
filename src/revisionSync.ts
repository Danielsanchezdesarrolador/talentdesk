// Provider-neutral DEMO protocol. No network adapter or authentication is implemented here.
import {inspectBackup} from './backup.js';
export type Snapshot={revision:number;raw:string};
export type WriteRequest={requestId:string;expectedRevision:number;raw:string};
export type Receipt={requestId:string;revision:number;raw:string};
export type WriteOutcome={kind:'committed';receipt:Receipt}|{kind:'conflict'}|{kind:'denied'};
export interface RevisionTransport {write(request:WriteRequest):Promise<WriteOutcome>;readReceipt(requestId:string):Promise<Receipt|null>;}
export type SyncResult={kind:'confirmed';snapshot:Snapshot}|{kind:'conflict'}|{kind:'denied'}|{kind:'uncertain';requestId:string};
function check(r:WriteRequest){if(!/^[A-Za-z0-9-]{1,100}$/.test(r.requestId)||!Number.isSafeInteger(r.expectedRevision)||r.expectedRevision<0||r.expectedRevision>=Number.MAX_SAFE_INTEGER)throw Error('Solicitud de revisión inválida.');inspectBackup(r.raw);}
function matches(request:WriteRequest,receipt:Receipt){return receipt.requestId===request.requestId&&receipt.revision===request.expectedRevision+1&&receipt.raw===request.raw;}
export async function reconcile(transport:RevisionTransport,request:WriteRequest):Promise<SyncResult>{check(request);try{const receipt=await transport.readReceipt(request.requestId);if(receipt&&matches(request,receipt))return {kind:'confirmed',snapshot:{revision:receipt.revision,raw:receipt.raw}};}catch{/* uncertain, never blind retry */}return {kind:'uncertain',requestId:request.requestId};}
export async function publishRevision(transport:RevisionTransport,request:WriteRequest):Promise<SyncResult>{check(request);let outcome:WriteOutcome;try{outcome=await transport.write(request);}catch{return reconcile(transport,request);}if(outcome.kind==='denied'||outcome.kind==='conflict')return outcome;if(matches(request,outcome.receipt))return {kind:'confirmed',snapshot:{revision:outcome.receipt.revision,raw:outcome.receipt.raw}};return reconcile(transport,request);}
