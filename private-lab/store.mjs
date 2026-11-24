// Synthetic, local integration-test store. Not a production database adapter.
import {DatabaseSync} from 'node:sqlite';
import {inspectBackup} from '../.test-build/backup.js';
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(s);
const MAX_REVISIONS=100;
export function validRequest(r){
 if(!r||typeof r!=='object'||Object.keys(r).length!==3||!validId(r.requestId)||!Number.isSafeInteger(r.expectedRevision)||r.expectedRevision<0||r.expectedRevision>=Number.MAX_SAFE_INTEGER||typeof r.raw!=='string')throw Error('invalid request');
 inspectBackup(r.raw);
}
export function openStore(path,initial){
 inspectBackup(initial);
 const db=new DatabaseSync(path);
 try{
 db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=0), raw TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts (request_id TEXT PRIMARY KEY, expected_revision INTEGER NOT NULL, revision INTEGER NOT NULL UNIQUE, raw TEXT NOT NULL, CHECK(revision=expected_revision+1));');
 db.prepare('INSERT OR IGNORE INTO workspace (id,revision,raw) VALUES (1,0,?)').run(initial);
 function snapshot(){const s=db.prepare('SELECT revision,raw FROM workspace WHERE id=1').get();if(!s||!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('invalid store');inspectBackup(s.raw);return {revision:s.revision,raw:s.raw};}
 function receipt(id){if(!validId(id))throw Error('invalid id');const row=db.prepare('SELECT request_id AS requestId,revision,raw FROM receipts WHERE request_id=?').get(id);if(!row)return null;inspectBackup(row.raw);return {requestId:row.requestId,revision:row.revision,raw:row.raw};}
 snapshot();
 function write(r){
  validRequest(r);db.exec('BEGIN IMMEDIATE');
  try{
   const prior=receipt(r.requestId);
   if(prior){db.exec('COMMIT');return prior.revision===r.expectedRevision+1&&prior.raw===r.raw?{kind:'committed',receipt:prior}:{kind:'conflict'};}
   const s=snapshot();if(s.revision!==r.expectedRevision){db.exec('COMMIT');return {kind:'conflict'};}
   if(s.revision>=MAX_REVISIONS){db.exec('COMMIT');return {kind:'capacity'};}
   const revision=s.revision+1;
   const update=db.prepare('UPDATE workspace SET revision=?,raw=? WHERE id=1 AND revision=?').run(revision,r.raw,r.expectedRevision);
   if(update.changes!==1)throw Error('unexpected revision update');
   db.prepare('INSERT INTO receipts(request_id,expected_revision,revision,raw) VALUES(?,?,?,?)').run(r.requestId,r.expectedRevision,revision,r.raw);
   db.exec('COMMIT');return {kind:'committed',receipt:{requestId:r.requestId,revision,raw:r.raw}};
  }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
 }
 return {snapshot,receipt,write,close:()=>db.close()};
 }catch(e){db.close();throw e;}
}
