// Closed, synthetic SQLite lab only. Never use this as an institutional backup procedure.
import {DatabaseSync} from 'node:sqlite';
import {createCipheriv,createDecipheriv,randomBytes,pbkdf2Sync} from 'node:crypto';
import {readFile,writeFile,stat,access,mkdtemp,rm,link} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {inspectBackup} from '../.test-build/backup.js';
import {verifiedOriginal,candidateIds,sha256} from './documents.mjs';
const MAX=64*1024*1024,ITER=600000,HEADER=Buffer.from('TD-LAB-DB-V1\0','ascii');
function key(password,salt){if(typeof password!=='string'||password.length<12||password.length>256)throw Error('invalid password');return pbkdf2Sync(password,salt,ITER,32,'sha256');}
async function absent(path){try{await access(path);}catch(e){if(e.code==='ENOENT')return;throw e;}throw Error('destination or sidecar already exists');}
export async function verifyClosedLab(path){
 for(const suffix of ['-journal','-wal','-shm'])await absent(path+suffix);
 const s=await stat(path);if(!s.isFile()||s.size<100||s.size>MAX)throw Error('invalid database size');
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  const integrity=db.prepare('PRAGMA integrity_check').all();if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')throw Error('database integrity failed');
  const ws=db.prepare('SELECT id,revision,raw FROM workspace').all();if(ws.length!==1||ws[0].id!==1||!Number.isSafeInteger(ws[0].revision)||ws[0].revision<0||ws[0].revision>100)throw Error('invalid workspace');
  const current=ws[0];inspectBackup(current.raw);const ids=candidateIds(current.raw),receipts=db.prepare('SELECT * FROM receipts ORDER BY revision').all();
  if(receipts.length!==current.revision)throw Error('receipt sequence incomplete');
  for(let i=0;i<receipts.length;i++){const r=receipts[i];if(r.revision!==i+1||r.expected_revision!==i||!/^[A-Za-z0-9-]{1,100}$/.test(r.request_id))throw Error('invalid receipt');inspectBackup(r.raw);}
  if(receipts.length&&receipts.at(-1).raw!==current.raw)throw Error('last receipt differs from workspace');
  const originals=db.prepare('SELECT * FROM originals ORDER BY id').all();if(originals.length>100)throw Error('too many originals');
  const documents=originals.map(row=>{const d=verifiedOriginal(row);if(!ids.has(d.candidateId)||d.revision>current.revision||d.revision>0&&!candidateIds(receipts[d.revision-1].raw).has(d.candidateId))throw Error('invalid document reference');return {id:d.id,sha256:d.sha256,size:d.size};});
  return {revision:current.revision,receipts:receipts.length,documents};
 }finally{db.close();}
}
export async function encryptClosedLab(source,destination,password){
 // Caller must stop the lab and hold exclusive control of the source path.
 await absent(destination);const manifest=await verifyClosedLab(source);const raw=await readFile(source);if(raw.length>MAX)throw Error('database too large');
 const salt=randomBytes(16),iv=randomBytes(12),k=key(password,salt),cipher=createCipheriv('aes-256-gcm',k,iv);k.fill(0);cipher.setAAD(HEADER);
 const encrypted=Buffer.concat([cipher.update(raw),cipher.final()]),archive=Buffer.concat([HEADER,salt,iv,cipher.getAuthTag(),encrypted]);raw.fill(0);
 await writeFile(destination,archive,{flag:'wx',mode:0o600});return {manifest,sha256:sha256(archive)};
}
export async function restoreClosedLab(source,destination,password){
 await absent(destination);for(const suffix of ['-journal','-wal','-shm'])await absent(destination+suffix);
 const info=await stat(source);const offset=HEADER.length+44;if(!info.isFile()||info.size<=offset||info.size>MAX+offset)throw Error('invalid archive size');
 const archive=await readFile(source);if(!archive.subarray(0,HEADER.length).equals(HEADER))throw Error('invalid archive');
 const start=HEADER.length,salt=archive.subarray(start,start+16),iv=archive.subarray(start+16,start+28),tag=archive.subarray(start+28,start+44),k=key(password,salt),decipher=createDecipheriv('aes-256-gcm',k,iv);k.fill(0);decipher.setAAD(HEADER);decipher.setAuthTag(tag);
 const raw=Buffer.concat([decipher.update(archive.subarray(offset)),decipher.final()]);
 const dir=await mkdtemp(join(dirname(destination),'.td-lab-restore-')),temporary=join(dir,'candidate.sqlite');
 try{await writeFile(temporary,raw,{flag:'wx',mode:0o600});const manifest=await verifyClosedLab(temporary);await link(temporary,destination);return manifest;}finally{raw.fill(0);await rm(dir,{recursive:true,force:true});}
}
