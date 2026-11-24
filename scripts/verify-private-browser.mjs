import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {startPrivateLab} from '../private-lab/server.mjs';
import {makeBackup} from '../.test-build/backup.js';
const require=createRequire(join(process.env.QA_NODE_MODULES,'_qa.cjs'));
const {chromium}=require('playwright');
const initial=makeBackup({getItem:()=>null,setItem:()=>{}},'2026-11-24T12:00:00Z');
const lab=await startPrivateLab({initial,ui:true});
const browser=await chromium.launch({headless:true});
try{
 const a=await browser.newContext({viewport:{width:1366,height:900}}),b=await browser.newContext({viewport:{width:390,height:844}});
 const p=await a.newPage(),q=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));q.on('pageerror',e=>errors.push(e.message));
 await Promise.all([p.goto(lab.origin),q.goto(lab.origin)]);
 for(const x of [p,q]){await x.getByRole('status').getByText(/No se pudo verificar/).waitFor();await x.getByLabel('Clave efímera del laboratorio').fill(lab.secret);await x.getByRole('button',{name:'Ingresar al laboratorio'}).click();await x.getByText('Candidatos: 0',{exact:true}).waitFor();}
 await p.getByRole('button',{name:'Crear candidato ficticio'}).click();await p.getByText('Candidatos: 1',{exact:true}).waitFor();
 await q.getByText('Candidatos: 0',{exact:true}).waitFor();
 await q.getByRole('button',{name:'Crear candidato ficticio'}).click();
 await p.getByRole('button',{name:'Guardar revisión en servidor'}).click();await p.getByText('Revisión del servidor: 1',{exact:true}).waitFor();
 await q.getByRole('button',{name:'Guardar revisión en servidor'}).click();await q.getByRole('status').getByText(/Otra sesión guardó primero/).waitFor();
 assert.equal(await q.getByRole('button',{name:'Guardar revisión en servidor'}).isDisabled(),true);
 await q.getByRole('button',{name:'Descartar borrador y actualizar'}).click();await q.getByText('Revisión del servidor: 1',{exact:true}).waitFor();
 assert.equal(await p.locator('#candidates').innerText(),await q.locator('#candidates').innerText());
 await q.reload();await q.getByText('Candidatos: 1',{exact:true}).waitFor();
 assert.deepEqual(await q.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);
 await mkdir('qa-output',{recursive:true});await p.screenshot({path:'qa-output/private-lab-desktop.png',fullPage:true});await q.screenshot({path:'qa-output/private-lab-mobile.png',fullPage:true});
 assert.ok(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 lab.revokeAll();for(const x of [p,q]){await x.getByRole('heading',{name:'Acceso privado'}).waitFor({timeout:12000});assert.equal(await x.locator('#candidates').innerText(),'');}
 assert.deepEqual(errors,[]);console.log('PRIVATE_BROWSER_PASS desktop + mobile, conflict, reload, revocation, no browser storage');
}finally{await browser.close();await lab.close();}
