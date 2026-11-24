import {createHash,randomUUID} from 'node:crypto';
import {inspectBackup} from '../.test-build/backup.js';
import {loadRecruitment} from '../.test-build/recruitment.js';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function candidateIds(raw){const b=inspectBackup(raw);return new Set(loadRecruitment({getItem:k=>b.data[k]??null,setItem:()=>{throw Error('read only');}}).candidates.map(c=>c.id));}
const idOK=id=>typeof id==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(id);
export const documentSchema=`CREATE TABLE IF NOT EXISTS originals (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, candidate_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('CV','Documento')), revision INTEGER NOT NULL CHECK(revision>=0), sha256 TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>0), bytes BLOB NOT NULL);`;
function pdf(kind,id){
 // Fixed ASCII synthetic text only, never render user-provided content.
 const drawing='BT /F1 18 Tf 48 740 Td (TalentDesk - '+kind+' SINTETICO) Tj 0 -30 Td /F1 11 Tf (Referencia: '+id+') Tj 0 -24 Td (NO USAR COMO DOCUMENTO REAL) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(drawing)+' >>\nstream\n'+drawing+'\nendstream'];
 let result='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(result));result+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}const at=Buffer.byteLength(result);result+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+at+'\n%%EOF\n';return Buffer.from(result,'ascii');
}
export function verifiedOriginal(row){
 if(!row||!idOK(row.id)||!idOK(row.request_id)||!idOK(row.candidate_id)||!['CV','Documento'].includes(row.kind)||!Number.isSafeInteger(row.revision)||row.revision<0||!Number.isSafeInteger(row.size)||row.size<1||row.size>100000||!/^[a-f0-9]{64}$/.test(row.sha256)||!(row.bytes instanceof Uint8Array))throw Error('invalid original');
 const bytes=Buffer.from(row.bytes);if(bytes.length!==row.size||sha256(bytes)!==row.sha256||!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.subarray(-6).equals(Buffer.from('%%EOF\n')))throw Error('corrupt original');
 return {id:row.id,requestId:row.request_id,candidateId:row.candidate_id,kind:row.kind,revision:row.revision,sha256:row.sha256,size:row.size,bytes};
}
const metadata=({bytes,...meta})=>meta;
export function documentPort(db,snapshot){
 function verifyLinks(raw){const ids=candidateIds(raw);for(const row of db.prepare('SELECT DISTINCT candidate_id FROM originals').all())if(!ids.has(row.candidate_id))throw Error('candidate with archived document cannot be removed');}
 function list(){const s=snapshot(),ids=candidateIds(s.raw);return db.prepare('SELECT * FROM originals ORDER BY revision,id').all().map(row=>{const d=verifiedOriginal(row);if(!ids.has(d.candidateId)||d.revision>s.revision)throw Error('orphan original');return metadata(d);});}
 function read(id){if(!idOK(id))throw Error('invalid id');const row=db.prepare('SELECT * FROM originals WHERE id=?').get(id);if(!row)return null;const d=verifiedOriginal(row),s=snapshot();if(!candidateIds(s.raw).has(d.candidateId)||d.revision>s.revision)throw Error('orphan original');return d;}
 function create(r){
  if(!r||Object.keys(r).length!==4||!idOK(r.requestId)||!idOK(r.candidateId)||!['CV','Documento'].includes(r.kind)||!Number.isSafeInteger(r.expectedRevision)||r.expectedRevision<0)throw Error('invalid document request');
  db.exec('BEGIN IMMEDIATE');try{
   const existing=db.prepare('SELECT * FROM originals WHERE request_id=?').get(r.requestId);
   if(existing){const d=verifiedOriginal(existing),s=snapshot();if(!candidateIds(s.raw).has(d.candidateId)||d.revision>s.revision)throw Error('orphan original');db.exec('COMMIT');return d.candidateId===r.candidateId&&d.kind===r.kind&&d.revision===r.expectedRevision?{kind:'committed',document:metadata(d)}:{kind:'conflict'};}
   const s=snapshot();if(s.revision!==r.expectedRevision||!candidateIds(s.raw).has(r.candidateId)){db.exec('COMMIT');return {kind:'conflict'};}
   if(db.prepare('SELECT count(*) AS n FROM originals').get().n>=100){db.exec('COMMIT');return {kind:'capacity'};}
   const id=randomUUID(),bytes=pdf(r.kind,id),hash=sha256(bytes);
   db.prepare('INSERT INTO originals(id,request_id,candidate_id,kind,revision,sha256,size,bytes) VALUES(?,?,?,?,?,?,?,?)').run(id,r.requestId,r.candidateId,r.kind,s.revision,hash,bytes.length,bytes);
   const d=verifiedOriginal(db.prepare('SELECT * FROM originals WHERE id=?').get(id));db.exec('COMMIT');return {kind:'committed',document:metadata(d)};
  }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
 }
 return {list,read,create,verifyLinks};
}
