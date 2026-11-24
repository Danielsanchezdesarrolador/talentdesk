import test from 'node:test';import assert from 'node:assert/strict';import {processSummary,processReport,inProcess} from '../.test-build/processWorkspace.js';
import {emptyRecruitment,emptyCandidate,saveCandidate,addApplication,recordContact} from '../.test-build/recruitment.js';
import {emptyOps,emptyDoc,saveDocument} from '../.test-build/operations.js';
const today='2026-11-24',at=today+'T12:00:00Z',v={id:'v',title:'Cargo DEMO A',unit:'Unidad DEMO',slots:3,covered:1,status:'Activa',date:today},w={...v,id:'w',title:'Cargo DEMO B'};
let s=saveCandidate(emptyRecruitment(),{...emptyCandidate,firstName:'Persona',lastName:'Demo',code:'DEMO-1'},'c');s=addApplication(s,[v,w],'c','v','a',at);s=addApplication(s,[v,w],'c','w','b',at);s=recordContact(s,[v,w],'a','ct','Interesado','','',at);
let ops=saveDocument(emptyOps(),s,{...emptyDoc,applicationId:'b',name:'Otro DEMO',due:today},'d',false,at);
test('proceso conserva candidato compartido y separa postulaciones',()=>{const x=processSummary(v,s,ops,today);assert.equal(x.apps.length,1);assert.equal(x.called,1);assert.equal(x.toSchedule,1);assert.equal(x.docs.length,0);assert.equal(x.pending,2);assert.equal(processSummary(w,s,ops,today).callQueue,1);assert.equal(processSummary(w,s,ops,today).docPending,1);});
test('scope selecciona por postulación no candidato',()=>{assert.equal(inProcess(s,'v','a'),true);assert.equal(inProcess(s,'v','b'),false);assert.equal(inProcess(s,undefined,'b'),true);assert.equal(inProcess(s,'v','missing'),false);});
test('reporte no contiene otro proceso y distingue cobertura manual de ingresos',()=>{const x=processReport(v,s,ops,today);assert.match(x,/Cobertura: 1\/3/);assert.match(x,/Ingresos confirmados DEMO: 0/);assert.ok(!x.includes('Cargo DEMO B'));});
