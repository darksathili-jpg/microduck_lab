// Local formative records. This database confers no identity or privilege.
export const REVIEW_DB='microduck.lab.accompanied-review.v1';
export const PILOTS=new Set(['traversee/s1','fiabilite/f3','analyse/a3']);
export const ARCHIVE_LIMIT=8*1024*1024;
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export async function sha256(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const fresh=()=>({version:1,revision:0,works:{},submissions:[],decisions:[]});
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const string=(v,n)=>typeof v==='string'&&v.length<=n;
const strings=(v,n=2000)=>Array.isArray(v)&&v.length<=100&&v.every(s=>string(s,n));
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const date=v=>typeof v==='string'&&v.length===24&&new Date(v).toISOString()===v;
export function validateLedger(s){
 assert(s&&s.version===1&&Number.isSafeInteger(s.revision)&&s.revision>=0&&s.works&&typeof s.works==='object'&&!Array.isArray(s.works)&&Array.isArray(s.submissions)&&Array.isArray(s.decisions),'Format de dossiers inconnu.');
 assert(Object.keys(s).sort().join(',')==='decisions,revision,submissions,version,works','Champs de dossiers inconnus.');
 assert(s.submissions.length<=120&&s.decisions.length<=120,'Trop de dossiers : aucun avis supprimé.');
 for(const [activityId,w]of Object.entries(s.works))assert(PILOTS.has(activityId)&&w&&string(w.id,100)&&w.id.length>0&&w.owner===activityId,'Travail local inconnu.');
 const ids=new Set(),versions=new Set();
 for(const r of s.submissions){
  assert(r&&string(r.id,100)&&r.id.length>0&&!ids.has(r.id)&&PILOTS.has(r.activityId)&&r.workId===s.works[r.activityId]?.id,'Identité de dossier invalide.');ids.add(r.id);
  const version=r.workId+'/'+r.number;assert(Number.isSafeInteger(r.number)&&r.number>0&&!versions.has(version),'Version de dossier ambiguë.');versions.add(version);
  assert(string(r.title,200)&&string(r.code,64000)&&hash(r.codeHash)&&string(r.explanation,8000)&&date(r.submittedAt),'Programme ou date invalide.');
  assert(r.provenance?.owner===r.activityId&&Number.isSafeInteger(r.provenance.revision)&&r.provenance.revision>=0,'Provenance de travail invalide.');
  assert(r.context?.activityId===r.activityId&&r.context.version===1&&hash(r.contextHash)&&r.context.contract&&r.context.cases&&r.context.terrains&&r.context.sources&&Array.isArray(r.proofs),'Contexte de dossier invalide.');
  assert(r.context.title===r.title&&string(r.context.starter,64000)&&strings(r.context.criteria)&&r.context.criteria.length>0&&strings(r.context.work,12000)&&string(r.context.explain,12000),'Critères ou amorce invalides.');
  assert(strings(r.context.contract.required,100)&&strings(r.context.contract.forbidden,100)&&Object.values(r.context.sources).length>0&&Object.values(r.context.sources).every(hash),'Sources ou contraintes invalides.');
  assert(r.proofs.length===Object.keys(r.context.cases).length&&r.proofs.length>0,'Essais incomplets.');
  const cases=new Set();for(const p of r.proofs){assert(!cases.has(p.terrainId)&&Object.hasOwn(r.context.cases,p.terrainId),'Terrain inconnu ou répété.');cases.add(p.terrainId);assert(p.codeHash===r.codeHash&&p.result?.kind==='ok'&&p.assessment?.applicable===true&&p.assessment.pass===true&&p.diagnostic&&p.diagnostic.status!=='FAIL'&&['PASS','BLOCKED'].includes(p.diagnostic.status),'Preuve non admissible.');assert(string(p.result.output,8000)&&Number.isSafeInteger(p.result.actions)&&p.result.actions>=0&&strings(p.diagnostic.reasons)&&(p.diagnostic.observed===undefined||strings(p.diagnostic.observed,100)),'Résultats ou alertes invalides.');assert(date(p.finishedAt)&&hash(p.terrainHash)&&p.terrain?.id===p.terrainId&&canonical(p.terrain)===canonical(r.context.terrains[p.terrainId]),'Terrain de preuve différent du contexte.');}
 }
 const decisions=new Set(),reviewed=new Set();for(const d of s.decisions){assert(d&&string(d.id,100)&&!decisions.has(d.id)&&ids.has(d.submissionId)&&!reviewed.has(d.submissionId)&&['favorable','correction'].includes(d.verdict)&&string(d.note,1000)&&date(d.decidedAt)&&d.origin==='local-unverified','Décision invalide ou contradictoire.');decisions.add(d.id);reviewed.add(d.submissionId);}
 assert(new TextEncoder().encode(JSON.stringify(s)).length<=ARCHIVE_LIMIT,'Dossiers trop volumineux. Exportez-les ; aucune suppression automatique.');
 return s;
}
export async function verifyLedger(s){
 validateLedger(s);
 for(const r of s.submissions){assert(await sha256(r.code)===r.codeHash,'Empreinte du programme incorrecte.');assert(await sha256(canonical(r.context))===r.contextHash,'Empreinte du contexte incorrecte.');for(const p of r.proofs)assert(await sha256(canonical(p.terrain))===p.terrainHash,'Empreinte du terrain incorrecte.');}
 return s;
}
const conflict=()=>Error('Les dossiers ont changé dans un autre onglet. Actualisez-les avant de recommencer.');
export class ReviewStore{
 constructor(factory=globalThis.indexedDB){this.factory=factory;}
 async open(){
  if(!this.factory)throw Error('Stockage des dossiers indisponible.');
  if(!this.connection)this.connection=new Promise((resolve,reject)=>{
   let request,settled=false;const fail=message=>{if(!settled){settled=true;reject(Error(message));}};
   const timer=setTimeout(()=>fail('Ouverture des dossiers trop longue. Fermez les anciens onglets puis réessayez.'),8000);
   try{request=this.factory.open(REVIEW_DB,1);}catch(e){clearTimeout(timer);fail(e.message);return;}
   request.onupgradeneeded=()=>{request.result.createObjectStore('ledger');};
   request.onblocked=()=>{clearTimeout(timer);fail('Stockage bloqué par un autre onglet.');};
   request.onerror=()=>{clearTimeout(timer);fail(request.error?.message||'Ouverture des dossiers refusée.');};
   request.onsuccess=()=>{clearTimeout(timer);const db=request.result;if(settled){db.close();return;}settled=true;db.onversionchange=()=>{db.close();this.connection=null;};resolve(db);};
  }).catch(e=>{this.connection=null;throw e;});
  return this.connection;
 }
 async read(){const db=await this.open();return new Promise((resolve,reject)=>{let value;const tx=db.transaction('ledger','readonly'),r=tx.objectStore('ledger').get('state');r.onsuccess=()=>{value=r.result??fresh();};tx.oncomplete=()=>{verifyLedger(value).then(resolve,reject);};tx.onabort=()=>reject(tx.error||Error('Lecture interrompue.'));tx.onerror=()=>{};});}
 async change(expectedRevision,operation){
  const db=await this.open();
  const written=await new Promise((resolve,reject)=>{
   let failure,next,result;const tx=db.transaction('ledger','readwrite',{durability:'strict'}),store=tx.objectStore('ledger'),get=store.get('state');
   get.onsuccess=()=>{try{next=validateLedger(get.result??fresh());if(next.revision!==expectedRevision)throw conflict();result=operation(next);next.revision++;validateLedger(next);store.put(next,'state');}catch(e){failure=e;tx.abort();}};
   tx.oncomplete=()=>resolve({state:next,result});tx.onabort=()=>reject(failure||tx.error||Error('Écriture interrompue. Aucun enregistrement confirmé.'));tx.onerror=()=>{};
  });
  // Request success is insufficient: wait for the complete event, then read back.
  const actual=await this.read();
  for(const field of ['works','submissions','decisions']){
   const entries=field==='works'?Object.entries(written.state.works):written.state[field].map(v=>[v.id,v]);
   for(const [id,value]of entries){const reread=field==='works'?actual.works[id]:actual[field].find(v=>v.id===id);assert(canonical(value)===canonical(reread),'Relecture des dossiers différente. Exportez et actualisez avant de réessayer.');}
  }
  return {state:actual,result:written.result};
 }
 async submit(candidate,revision){
  assert(PILOTS.has(candidate.activityId),'Activité hors des trois pilotes.');
  const workId=crypto.randomUUID(),id=crypto.randomUUID();
  // Complete validation and hashing take place before opening the transaction.
  const proposed={...structuredClone(candidate),id,workId,number:1};
  await verifyLedger({version:1,revision:0,works:{[candidate.activityId]:{id:workId,owner:candidate.activityId}},submissions:[proposed],decisions:[]});
  return this.change(revision,s=>{
   const same=s.submissions.find(r=>r.activityId===candidate.activityId&&r.codeHash===candidate.codeHash&&r.contextHash===candidate.contextHash&&r.explanation===candidate.explanation);
   if(same)return same;
   const work=s.works[candidate.activityId]??={id:workId,owner:candidate.activityId};
   const record={...proposed,workId:work.id,number:1+Math.max(0,...s.submissions.filter(r=>r.workId===work.id).map(r=>r.number))};
   s.submissions.push(record);return record;
  });
 }
 async decide(submissionId,verdict,note,revision){
  assert(['favorable','correction'].includes(verdict)&&string(note,1000),'Avis invalide.');
  return this.change(revision,s=>{assert(s.submissions.some(r=>r.id===submissionId),'Dossier introuvable.');const old=s.decisions.find(d=>d.submissionId===submissionId);if(old){assert(old.verdict===verdict&&old.note===note,'Un avis existe déjà pour cette soumission. Il est conservé.');return old;}const d={id:crypto.randomUUID(),submissionId,verdict,note,decidedAt:new Date().toISOString(),origin:'local-unverified'};s.decisions.push(d);return d;});
 }
 async export(){const state=await verifyLedger(await this.read());return JSON.stringify({format:'microduck-local-reviews',version:1,exportedAt:new Date().toISOString(),state});}
 async restore(text,revision){
  assert(new TextEncoder().encode(text).length<=ARCHIVE_LIMIT*2,'Archive trop volumineuse.');
  const archive=JSON.parse(text);assert(archive?.format==='microduck-local-reviews'&&archive.version===1,'Archive de dossiers inconnue.');const incoming=await verifyLedger(archive.state);
  return this.change(revision,s=>{
   for(const [a,w]of Object.entries(incoming.works)){assert(!s.works[a]||canonical(s.works[a])===canonical(w),'Travail local différent pour '+a+'. Utilisez un profil distinct ; aucun dossier remplacé.');s.works[a]??=w;}
   for(const field of ['submissions','decisions'])for(const r of incoming[field]){const old=s[field].find(v=>v.id===r.id);assert(!old||canonical(old)===canonical(r),'Conflit dans l’archive : '+r.id);if(!old)s[field].push(r);}
   return {submissions:incoming.submissions.length,decisions:incoming.decisions.length};
  });
 }
}
