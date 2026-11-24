import {privateTransport} from '/modules/privateTransport.js';
import {privateWorkspace} from '/modules/privateWorkspace.js';
import {inspectBackup} from '/modules/backup.js';
import {loadRecruitment} from '/modules/recruitment.js';
const el=id=>document.getElementById(id);
let docEpoch=0,docBusy=false,docPending=null,committedCandidate='';
function clearDocuments(){docEpoch++;docBusy=false;docPending=null;committedCandidate='';el('doc-items').replaceChildren();el('doc-status').textContent='';}
function render(v){
 const closed=v.phase==='locked',busy=v.busy;
 el('access').hidden=!closed;el('workspace').hidden=closed;el('enter').disabled=busy;el('resume').disabled=busy;
 if(closed){clearDocuments();el('secret').value='';el('candidates').replaceChildren();el('revision').textContent='';el('count').textContent='';}
 else{
  const b=inspectBackup(v.draft??v.snapshot.raw),data=b.data;
  const records=loadRecruitment({getItem:k=>data[k]??null,setItem:()=>{throw Error('read only');}});
  el('revision').textContent='Revisión del servidor: '+v.snapshot.revision+(v.draft?' · Borrador sin guardar':'');
  el('count').textContent='Candidatos: '+records.candidates.length;
  el('candidates').replaceChildren(...records.candidates.map(c=>{const li=document.createElement('li');li.textContent=c.firstName+' '+c.lastName+' · '+c.code;return li;}));
  const saved=inspectBackup(v.snapshot.raw).data;committedCandidate=loadRecruitment({getItem:k=>saved[k]??null,setItem:()=>{}}).candidates[0]?.id??'';
  el('doc-create').disabled=busy||docBusy||v.phase!=='ready'||!!v.draft||!committedCandidate||!!docPending;el('doc-list').disabled=busy||docBusy;
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

async function docRequest(create){
 const view=controller.view();if(view.phase==='locked'||docBusy||view.busy||create&&(view.phase!=='ready'||view.draft||!committedCandidate||docPending))return;
 const epoch=++docEpoch;docBusy=true;render(view);const api=privateTransport();
 const current=()=>epoch===docEpoch&&controller.view().phase!=='locked';
 try{
  await api.session();if(!current())return;
  if(create){docPending={requestId:crypto.randomUUID(),candidateId:committedCandidate,kind:'CV',expectedRevision:view.snapshot.revision};
   const res=await fetch('/api/private-lab/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(docPending),credentials:'same-origin',cache:'no-store',redirect:'error'});
   if(res.status===401||res.status===403){controller.lock('Acceso revocado.');return;}
   if(res.status===409||res.status===507){docPending=null;el('doc-status').textContent='Conflicto o límite; actualiza el registro antes de generar.';return;}
   if(!res.ok)throw Error('document result unknown');const result=await res.json();if(result.kind!=='committed'||result.document?.requestId!==docPending.requestId)throw Error('document result unknown');
  }
  const res=await fetch('/api/private-lab/documents',{credentials:'same-origin',cache:'no-store',redirect:'error'});if(res.status===401||res.status===403){controller.lock('Acceso revocado.');return;}if(!res.ok)throw Error('document list unavailable');
  const {documents}=await res.json();await api.session();if(!current())return;
  const found=docPending&&documents.find(d=>d.requestId===docPending.requestId&&d.candidateId===docPending.candidateId&&d.kind===docPending.kind&&d.revision===docPending.expectedRevision);
  if(found)docPending=null;
  el('doc-items').replaceChildren(...documents.map(d=>{const item=document.createElement('li'),a=document.createElement('a');a.textContent='Descargar original '+d.kind+' DEMO';a.href='/api/private-lab/documents/'+encodeURIComponent(d.id);a.download='talentdesk-DEMO-'+d.id+'.pdf';item.append(a,document.createTextNode(' · SHA-256 '+d.sha256));return item;}));
  el('doc-status').textContent=docPending?'Resultado incierto; consulta originales nuevamente, no se repetirá la escritura.':documents.length+' originales verificados.';
 }catch{if(current()){el('doc-items').replaceChildren();el('doc-status').textContent=docPending?'Resultado incierto; consulta originales nuevamente.':'No se pudieron recuperar los originales.';try{await api.session();}catch{if(current())controller.lock('Acceso no verificable.');}}}finally{if(current()){docBusy=false;render(controller.view());}}
}
el('doc-create').addEventListener('click',()=>void docRequest(true));el('doc-list').addEventListener('click',()=>void docRequest(false));
