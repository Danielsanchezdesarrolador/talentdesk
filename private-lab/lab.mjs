import {privateTransport} from '/modules/privateTransport.js';
import {privateWorkspace} from '/modules/privateWorkspace.js';
import {inspectBackup} from '/modules/backup.js';
import {loadRecruitment} from '/modules/recruitment.js';
const el=id=>document.getElementById(id);
function render(v){
 const closed=v.phase==='locked',busy=v.busy;
 el('access').hidden=!closed;el('workspace').hidden=closed;el('enter').disabled=busy;el('resume').disabled=busy;
 if(closed){el('secret').value='';el('candidates').replaceChildren();el('revision').textContent='';el('count').textContent='';}
 else{
  const b=inspectBackup(v.draft??v.snapshot.raw),data=b.data;
  const records=loadRecruitment({getItem:k=>data[k]??null,setItem:()=>{throw Error('read only');}});
  el('revision').textContent='Revisión del servidor: '+v.snapshot.revision+(v.draft?' · Borrador sin guardar':'');
  el('count').textContent='Candidatos: '+records.candidates.length;
  el('candidates').replaceChildren(...records.candidates.map(c=>{const li=document.createElement('li');li.textContent=c.firstName+' '+c.lastName+' · '+c.code;return li;}));
  el('add').disabled=busy||v.phase!=='ready';el('save').disabled=busy||v.phase!=='ready'||!v.draft;el('refresh').disabled=busy||v.phase==='uncertain';el('discard').disabled=busy||v.phase==='uncertain'||!v.draft;
  el('recover').hidden=v.phase!=='uncertain';el('recover').disabled=busy;
 }
 el('status').textContent=v.message;
}
const controller=privateWorkspace(privateTransport(),render);render(controller.view());
el('login').addEventListener('submit',e=>{e.preventDefault();const secret=el('secret').value;el('secret').value='';void controller.login(secret);});
for(const [id,action] of Object.entries({resume:controller.resume,add:controller.add,save:controller.save,refresh:controller.refresh,discard:controller.discard,recover:controller.recover,logout:controller.logout}))el(id).addEventListener('click',()=>void action());
addEventListener('offline',()=>controller.lock('Sin conexión. Datos retirados de la vista.'));
addEventListener('pagehide',()=>controller.lock('Vista cerrada.'));
addEventListener('pageshow',e=>{if(e.persisted)controller.lock('Revalida el acceso.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)controller.lock('Vista oculta. Revalida el acceso.');});
setInterval(()=>{if(!document.hidden)void controller.check();},5000);
void controller.resume();
