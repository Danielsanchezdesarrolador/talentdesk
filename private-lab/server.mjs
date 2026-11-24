// Loopback-only synthetic laboratory. No CLI, no public listener, no production identity provider.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {openStore,validRequest} from './store.mjs';
const COOKIE='td_lab_session',ROOT='/api/private-lab';
const digest=s=>createHash('sha256').update(s).digest();
const token=()=>randomBytes(32).toString('base64url');
function body(req,max){return new Promise((resolve,reject)=>{let size=0,parts=[],exceeded=false;req.on('data',b=>{size+=b.length;if(size>max){exceeded=true;parts=[];}else if(!exceeded)parts.push(b);});req.on('end',()=>{if(exceeded)return reject(Error('too large'));try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch{reject(Error('invalid JSON'));}});req.on('error',reject);});}
export async function startPrivateLab({path=':memory:',initial,clock=Date.now,ttlMs=15*60*1000,ui=false}){
 if(!Number.isInteger(ttlMs)||ttlMs<100||ttlMs>3600000)throw Error('invalid TTL');
 const store=openStore(path,initial),secret=token(),secretHash=digest(secret),sessions=new Map();
 let origin='',failures=0;
 function session(req){
  const values=(req.headers.cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));
  if(values.length!==1)return null;const id=values[0].slice(COOKIE.length+1),entry=sessions.get(id);
  if(!entry)return null;if(clock()>=entry.expires){sessions.delete(id);return null;}return id;
 }
 function respond(res,status,object,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers});res.end(JSON.stringify(object));}
 const cookie=id=>COOKIE+'='+id+'; HttpOnly; SameSite=Strict; Path='+ROOT+'; Max-Age='+Math.ceil(ttlMs/1000);
 const clear=COOKIE+'=; HttpOnly; SameSite=Strict; Path='+ROOT+'; Max-Age=0';
 const server=createServer({requestTimeout:10000,headersTimeout:5000,maxHeaderSize:8192},async(req,res)=>{
  try{
   const deny=()=>respond(res,401,{error:'denied'});
   if(req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)||['cross-site','same-site'].includes(req.headers['sec-fetch-site']))return respond(res,403,{error:'denied'});
   if(!['GET','POST'].includes(req.method))return respond(res,405,{error:'method'});
   if(req.method==='POST'&&(req.headers.origin!==origin||req.headers['content-type']!=='application/json'))return respond(res,403,{error:'denied'});
   const url=req.url;
   if(ui&&req.method==='GET'){
    const known={'/':['./index.html','text/html; charset=utf-8'],'/lab.css':['./lab.css','text/css; charset=utf-8'],'/lab.mjs':['./lab.mjs','text/javascript; charset=utf-8']};
    const module=url?.match(/^\/modules\/([A-Za-z][A-Za-z0-9]*\.js)$/);
    const entry=known[url]??(module?['../.test-build/'+module[1],'text/javascript; charset=utf-8']:null);
    if(entry){let asset;try{asset=await readFile(new URL(entry[0],import.meta.url));}catch{return respond(res,404,{error:'not found'});}res.writeHead(200,{'Content-Type':entry[1],'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});return res.end(asset);}
   }
   if(req.method==='POST'&&url===ROOT+'/login'){
    if(failures>=8)return respond(res,429,{error:'lab locked'});
    let value;try{value=await body(req,1024);}catch{return respond(res,400,{error:'invalid request'});}
    if(!value||Object.keys(value).length!==1||typeof value.secret!=='string'||value.secret.length>100||!timingSafeEqual(digest(value.secret),secretHash)){failures++;return deny();}
    if(failures>=8)return respond(res,429,{error:'lab locked'});failures=0;
    for(const [id,s] of sessions)if(clock()>=s.expires)sessions.delete(id);
    if(sessions.size>=8)return respond(res,429,{error:'session limit'});
    const old=session(req);if(old)sessions.delete(old);
    const id=token();sessions.set(id,{expires:clock()+ttlMs});return respond(res,200,{authenticated:true},{'Set-Cookie':cookie(id)});
   }
   const authorized=session(req);if(!authorized)return deny();
   if(req.method==='GET'&&url===ROOT+'/session')return respond(res,200,{authenticated:true});
   if(req.method==='POST'&&url===ROOT+'/logout'){sessions.delete(authorized);return respond(res,200,{authenticated:false},{'Set-Cookie':clear});}
   if(req.method==='GET'&&url===ROOT+'/snapshot')return respond(res,200,store.snapshot());
   if(req.method==='GET'&&url?.startsWith(ROOT+'/receipts/')){
    const id=url.slice((ROOT+'/receipts/').length);if(!/^[A-Za-z0-9-]{1,100}$/.test(id))return respond(res,400,{error:'invalid request'});
    const found=store.receipt(id);return respond(res,found?200:404,found??{error:'not found'});
   }
   if(req.method==='GET'&&url===ROOT+'/documents')return respond(res,200,{documents:store.documents.list()});
   if(req.method==='GET'&&url?.startsWith(ROOT+'/documents/')){
    const id=url.slice((ROOT+'/documents/').length);if(!/^[A-Za-z0-9-]{1,100}$/.test(id))return respond(res,400,{error:'invalid request'});
    const d=store.documents.read(id);if(!d)return respond(res,404,{error:'not found'});
    res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':d.size,'Content-Disposition':'attachment; filename="talentdesk-DEMO-'+d.id+'.pdf"','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'X-Document-SHA256':d.sha256});return res.end(d.bytes);
   }
   if(req.method==='POST'&&url===ROOT+'/documents'){
    let request;try{request=await body(req,2048);}catch{return respond(res,400,{error:'invalid request'});}
    if(session(req)!==authorized)return deny();
    if(!request||Object.keys(request).length!==4||typeof request.requestId!=='string'||typeof request.candidateId!=='string'||!['CV','Documento'].includes(request.kind)||!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0||!/[A-Za-z0-9-]/.test(request.requestId)||!/^[A-Za-z0-9-]{1,100}$/.test(request.candidateId)||!/^[A-Za-z0-9-]{1,100}$/.test(request.requestId))return respond(res,400,{error:'invalid request'});
    const result=store.documents.create(request);return respond(res,result.kind==='committed'?200:result.kind==='conflict'?409:507,result);
   }
   if(req.method==='POST'&&url===ROOT+'/revisions'){
    let request;try{request=await body(req,8_000_000);validRequest(request);}catch{return respond(res,400,{error:'invalid request'});}
    if(session(req)!==authorized)return deny();
    const outcome=store.write(request);return respond(res,outcome.kind==='committed'?200:outcome.kind==='conflict'?409:507,outcome);
   }
   return respond(res,404,{error:'not found'});
  }catch{if(!res.headersSent)respond(res,500,{error:'lab unavailable'});else res.destroy();}
 });
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;}
 catch(e){store.close();throw e;}
 return {origin,secret,revokeAll(){sessions.clear();},async close(){sessions.clear();await new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();});store.close();}};
}
