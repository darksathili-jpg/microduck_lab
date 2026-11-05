import { LEGACY_IDENTITIES, LEGACY_SOURCES, MIGRATION_LIMITS, MigrationIssue, copySource, snapshotIdentity, analyzeLegacy, migrationIdentifiers } from './notes-migration.js';

/**
 * PROTECTION-02.C2-B: isolated explanation storage and explicit migration; no UI or export.
 *
 * Importing this module and constructing NotesStore perform no storage operation.
 * All asynchronous public methods return structured results, never a storage-error
 * rejection. Statuses: ok, saved, conflict, resolved, refused, storage-error,
 * inconsistent. Only saved/conflict/resolved/snapshot-confirmed/migration-confirmed with confirmed:true acknowledge a
 * completed write AND a subsequent verified read. A verification failure may
 * follow a committed write: retry the SAME operationId and identical command.
 *
 * Histories are immutable through this API. This is not authentication, encryption
 * or protection against another script directly changing IndexedDB. Local browser
 * persistence is not an exportable backup or an absolute durability guarantee.
 */

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const NOTES_DB = 'microduck.lab.explanations.v1';
export const NOTES_DB_VERSION = 1;
export const NOTES_LIMITS = freeze({textUnits:8000, versionsPerActivity:100, recoveriesPerActivity:50});
export const NOTES_IDENTITIES = LEGACY_IDENTITIES;

/** Exact structural v1 schema. Migration records are explicitly validated in C2. */
export const NOTES_SCHEMA = freeze({
  notes:{keyPath:['sequenceId','activityId'], indexes:{}},
  versions:{keyPath:'operationId', indexes:{
    byActivity:{keyPath:['sequenceId','activityId'], unique:false},
    byRevision:{keyPath:['sequenceId','activityId','revision'], unique:true}
  }},
  recoveries:{keyPath:'operationId', indexes:{
    byActivity:{keyPath:['sequenceId','activityId'], unique:false},
    byResolution:{keyPath:'resolution.operationId', unique:true}
  }},
  legacySnapshots:{keyPath:'id', indexes:{bySourceKey:{keyPath:'sourceKey', unique:false}}},
  migrations:{keyPath:['snapshotId','parserVersion'], indexes:{bySequence:{keyPath:'sequenceId', unique:false}}}
});

const names = Object.keys(NOTES_SCHEMA);
const activityCount = Object.values(NOTES_IDENTITIES).reduce((n, a) => n + a.length, 0);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) => object(value) && Object.keys(value).length === fields.length && fields.every(k => Object.hasOwn(value, k));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const key = value => JSON.stringify([value.sequenceId, value.activityId]);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const revision = value => Number.isSafeInteger(value) && value >= 0 && value <= NOTES_LIMITS.versionsPerActivity;
const text = value => typeof value === 'string' && value.length <= NOTES_LIMITS.textUnits;
const ref = value => object(value)
  && typeof value.sequenceId === 'string' && typeof value.activityId === 'string'
  && Object.hasOwn(NOTES_IDENTITIES, value.sequenceId)
  && NOTES_IDENTITIES[value.sequenceId].includes(value.activityId);
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

class Issue extends Error {
  constructor(status, code, message) { super(message); this.status=status; this.code=code; }
}
const demand = (condition, code, message, status='inconsistent') => {
  if (!condition) throw new Issue(status, code, message);
};
const refuse = (condition, code, message) => demand(condition, code, message, 'refused');
const failure = error => ({
  status:(error instanceof Issue || error instanceof MigrationIssue) ? error.status : 'storage-error',
  code:(error instanceof Issue || error instanceof MigrationIssue) ? error.code : (error?.name || 'storage-unavailable'),
  message:String(error?.message || error), confirmed:false
});

function command(input, kind) {
  const fields = kind === 'save'
    ? ['sequenceId','activityId','expectedRevision','text','operationId']
    : ['sequenceId','activityId','expectedRevision','recoveryId','choice','operationId'];
  refuse(exact(input, fields), 'invalid-command', 'Identité ou champs de commande invalides.');
  // Capture each supplied value once; validate the same values the command uses.
  input=Object.fromEntries(fields.map(field=>[field,input[field]]));
  refuse(ref(input), 'invalid-command', 'Identité ou champs de commande invalides.');
  refuse(id(input.operationId) && revision(input.expectedRevision), 'invalid-command', 'Opération ou révision invalide.');
  if (kind === 'save') refuse(text(input.text), 'text-limit', 'Une explication contient au plus 8 000 unités UTF-16.');
  else refuse(id(input.recoveryId) && ['apply','keep'].includes(input.choice), 'invalid-resolution', 'Résolution invalide.');
  // Copy primitives before any asynchronous boundary; never retain caller objects.
  return kind === 'save'
    ? {kind, sequenceId:input.sequenceId, activityId:input.activityId, expectedRevision:input.expectedRevision, text:input.text, operationId:input.operationId}
    : {kind, sequenceId:input.sequenceId, activityId:input.activityId, expectedRevision:input.expectedRevision, recoveryId:input.recoveryId, choice:input.choice, operationId:input.operationId};
}

// An exact command representation, NOT a cryptographic signature or identity proof.
function requestKey(c) {
  return JSON.stringify([c.kind,c.sequenceId,c.activityId,c.expectedRevision,c.operationId,
    c.kind === 'save' ? c.text : c.recoveryId, c.kind === 'save' ? null : c.choice]);
}
function inputRef(input, recovery=false) {
  const fields=recovery ? ['sequenceId','activityId','recoveryId'] : ['sequenceId','activityId'];
  refuse(exact(input, fields), 'invalid-identity', 'Activité inconnue.');
  input=Object.fromEntries(fields.map(field=>[field,input[field]]));
  refuse(ref(input), 'invalid-identity', 'Activité inconnue.');
  if (recovery) refuse(id(input.recoveryId), 'invalid-recovery', 'Récupération invalide.');
  return {...input};
}

function checkStoreNames(db) {
  demand(db.version === NOTES_DB_VERSION && equal([...db.objectStoreNames].sort(), [...names].sort()), 'schema-incompatible', 'Schéma de base incompatible.');
}
function checkSchema(db, tx) {
  checkStoreNames(db);
  for (const name of names) {
    const store=tx.objectStore(name), spec=NOTES_SCHEMA[name];
    demand(equal(store.keyPath, spec.keyPath) && !store.autoIncrement && equal([...store.indexNames].sort(), Object.keys(spec.indexes).sort()), 'schema-incompatible', 'Magasin incompatible : '+name);
    for (const [indexName, expected] of Object.entries(spec.indexes)) {
      const index=store.index(indexName);
      demand(equal(index.keyPath, expected.keyPath) && index.unique === expected.unique && !index.multiEntry, 'schema-incompatible', 'Index incompatible : '+indexName);
    }
  }
}

function validate(raw,prepared) {
  checkSnapshots(raw.legacySnapshots);
  for(const snapshot of raw.legacySnapshots)demand(prepared?.has(snapshot.id)&&sameSnapshot(snapshot,prepared.get(snapshot.id).snapshot),'audit-raced','Instantané non prévalidé exactement.','refused');
  const notes=new Map(), versions=new Map(), recoveries=new Map(), groups=new Map(), resolutions=new Map();
  for (const n of raw.notes) {
    demand(exact(n,['formatVersion','sequenceId','activityId','revision','versionId']) && n.formatVersion === 1 && ref(n) && revision(n.revision) && n.revision > 0 && id(n.versionId) && !notes.has(key(n)), 'invalid-note', 'Tête de note invalide.');
    notes.set(key(n), n);
  }
  for (const v of raw.versions) {
    demand(exact(v,['formatVersion','sequenceId','activityId','operationId','revision','expectedRevision','text','kind','recoveryId','requestKey','createdAt']) && v.formatVersion === 1 && ref(v) && id(v.operationId) && !versions.has(v.operationId) && revision(v.revision) && v.revision > 0 && v.expectedRevision === v.revision-1 && text(v.text) && date(v.createdAt) && ['save','resolve'].includes(v.kind), 'invalid-version', 'Version invalide.');
    demand(v.kind === 'save' ? v.recoveryId === null : id(v.recoveryId), 'invalid-version', 'Origine de version invalide.');
    const c=v.kind === 'save' ? v : {...v, choice:'apply'};
    demand(v.requestKey === requestKey(c), 'invalid-command-record', 'Commande de version incohérente.');
    versions.set(v.operationId,v);
    if (!groups.has(key(v))) groups.set(key(v),[]);
    groups.get(key(v)).push(v);
  }
  for (const [k, rows] of groups) {
    rows.sort((a,b)=>a.revision-b.revision);
    demand(rows.length <= NOTES_LIMITS.versionsPerActivity && rows.every((v,i)=>v.revision === i+1), 'invalid-history', 'Historique incomplet ou trop volumineux.');
    const n=notes.get(k), last=rows.at(-1);
    demand(n && n.revision === last.revision && n.versionId === last.operationId, 'invalid-head', 'Tête différente de la dernière version.');
  }
  demand(notes.size === groups.size, 'orphan-head', 'Une tête ne possède pas son historique.');
  const recoveryCounts=new Map();
  for (const r of raw.recoveries) {
    demand(exact(r,['formatVersion','sequenceId','activityId','operationId','expectedRevision','observedRevision','text','requestKey','createdAt','resolution']) && r.formatVersion === 1 && ref(r) && id(r.operationId) && !versions.has(r.operationId) && !recoveries.has(r.operationId) && revision(r.expectedRevision) && revision(r.observedRevision) && r.expectedRevision !== r.observedRevision && r.observedRevision <= (notes.get(key(r))?.revision ?? 0) && text(r.text) && date(r.createdAt), 'invalid-recovery', 'Récupération incohérente.');
    demand(r.requestKey === requestKey({...r,kind:'save'}), 'invalid-command-record', 'Commande de récupération incohérente.');
    recoveryCounts.set(key(r),(recoveryCounts.get(key(r))||0)+1);
    demand(recoveryCounts.get(key(r)) <= NOTES_LIMITS.recoveriesPerActivity, 'invalid-recovery-count', 'Trop de récupérations.');
    recoveries.set(r.operationId,r);
  }
  for (const r of recoveries.values()) {
    const s=r.resolution;if (s === null) continue;
    demand(exact(s,['operationId','choice','expectedRevision','requestKey','versionId','resolvedAt']) && id(s.operationId) && ['apply','keep'].includes(s.choice) && revision(s.expectedRevision) && s.expectedRevision >= r.observedRevision && s.expectedRevision <= (notes.get(key(r))?.revision ?? 0) && date(s.resolvedAt) && !recoveries.has(s.operationId) && !resolutions.has(s.operationId), 'invalid-resolution', 'Résolution incohérente.');
    demand(s.requestKey === requestKey({...r,...s,kind:'resolve',recoveryId:r.operationId}), 'invalid-command-record', 'Commande de résolution incohérente.');
    if (s.choice === 'apply') {
      const v=versions.get(s.operationId);
      demand(v && v.kind === 'resolve' && v.recoveryId === r.operationId && key(v) === key(r) && v.expectedRevision === s.expectedRevision && v.text === r.text && s.versionId === v.operationId && v.requestKey === s.requestKey, 'invalid-resolution-version', 'Version de résolution incohérente.');
    } else demand(s.versionId === null && !versions.has(s.operationId), 'invalid-keep-resolution', 'Résolution sans remplacement invalide.');
    resolutions.set(s.operationId,r);
  }
  for (const v of versions.values()) if (v.kind === 'resolve') {
    demand(recoveries.get(v.recoveryId)?.resolution?.operationId === v.operationId, 'orphan-resolution', 'Version sans récupération résolue.');
  }
  const state={raw,notes,versions,recoveries,resolutions,groups,prepared};
  return {...state,...validateMigrations(raw,state,prepared)};
}


const snapshotFields=['formatVersion','id','sequenceId','sourceKey','present','raw','rawUnits','sha256','capturedAt'];
const sameSnapshot=(a,b)=>snapshotFields.every(k=>a[k]===b[k]);
const snapshotId=x=>typeof x==='string'&&/^ls1:[0-9a-f]{64}$/.test(x);
function migrationRef(input) {
  refuse(exact(input,['snapshotId','parserVersion']),'invalid-migration','Champs de migration invalides.');
  const c={snapshotId:input.snapshotId,parserVersion:input.parserVersion};
  refuse(snapshotId(c.snapshotId)&&c.parserVersion===1,'invalid-migration','Instantané ou parseur invalide.');
  return c;
}
function checkSnapshots(rows) {
  demand(Array.isArray(rows)&&rows.length<=MIGRATION_LIMITS.snapshots,'invalid-snapshots','Trop d’instantanés.');
  const ids=new Set(),counts=new Map();let units=0;
  for(const s of rows){
    demand(exact(s,snapshotFields)&&s.formatVersion===1&&typeof s.sequenceId==='string'&&Object.hasOwn(LEGACY_SOURCES,s.sequenceId)
      &&s.sourceKey===LEGACY_SOURCES[s.sequenceId]&&typeof s.present==='boolean'&&(s.present?typeof s.raw==='string':s.raw===null)
      &&Number.isSafeInteger(s.rawUnits)&&s.rawUnits===(s.present?s.raw.length:0)&&s.rawUnits<=MIGRATION_LIMITS.rawUnits
      &&typeof s.sha256==='string'&&/^[0-9a-f]{64}$/.test(s.sha256)&&s.id==='ls1:'+s.sha256&&date(s.capturedAt)&&!ids.has(s.id),
      'invalid-snapshot','Instantané invalide.');
    ids.add(s.id);units+=s.rawUnits;counts.set(s.sourceKey,(counts.get(s.sourceKey)||0)+1);
    demand(counts.get(s.sourceKey)<=MIGRATION_LIMITS.snapshotsPerSource,'invalid-snapshot-count','Trop d’instantanés pour cette source.');
  }
  demand(units<=MIGRATION_LIMITS.totalRawUnits,'invalid-snapshot-size','Volume des instantanés dépassé.');
}
async function prepareSnapshots(rows) {
  checkSnapshots(rows);
  return new Map(await Promise.all(rows.map(async snapshot=>{
    const c={sequenceId:snapshot.sequenceId,present:snapshot.present,raw:snapshot.raw};
    const identity=await snapshotIdentity(c);
    demand(identity.status==='ok',identity.code||'snapshot-hash-error',identity.message||'Empreinte non vérifiée.',identity.status==='storage-error'?'storage-error':'inconsistent');
    demand(identity.id===snapshot.id&&identity.sha256===snapshot.sha256,'snapshot-hash-mismatch','Empreinte de l’instantané incohérente.');
    const analysis=analyzeLegacy({...c,parserVersion:1});
    demand(analysis.status==='ok','invalid-snapshot','Analyse de l’instantané impossible.');
    const identifiers=await migrationIdentifiers(snapshot.id,snapshot.sequenceId,1);
    return [snapshot.id,{snapshot,analysis,...identifiers}];
  })));
}
function validateMigrations(raw,state,prepared) {
  demand(raw.migrations.length<=MIGRATION_LIMITS.receipts,'invalid-migration-count','Trop de reçus.');
  const migrations=new Map(),migrationOps=new Map(),effects=new Set();let entries=0;
  for(const m of raw.migrations){
    demand(exact(m,['formatVersion','snapshotId','parserVersion','sequenceId','operationId','requestKey','sourceState','sourceIssue','entries','createdAt'])
      &&m.formatVersion===1&&snapshotId(m.snapshotId)&&m.parserVersion===1&&typeof m.sequenceId==='string'
      &&Object.hasOwn(NOTES_IDENTITIES,m.sequenceId)&&date(m.createdAt)&&Array.isArray(m.entries),
      'invalid-migration','Reçu de migration invalide.');
    const p=prepared.get(m.snapshotId),k=JSON.stringify([m.snapshotId,m.parserVersion]);
    demand(p&&p.snapshot.sequenceId===m.sequenceId&&m.operationId===p.operationId&&m.requestKey===p.requestKey
      &&m.sourceState===p.analysis.sourceState&&m.sourceIssue===p.analysis.sourceIssue
      &&!migrations.has(k)&&!migrationOps.has(m.operationId)
      &&!state.versions.has(m.operationId)&&!state.recoveries.has(m.operationId)&&!state.resolutions.has(m.operationId),
      'invalid-migration-reference','Référence ou opération de migration incohérente.');
    demand(m.entries.length===NOTES_IDENTITIES[m.sequenceId].length,'invalid-migration-entries','Catalogue du reçu incomplet.');
    entries+=m.entries.length;
    for(let i=0;i<m.entries.length;i++){
      const e=m.entries[i],candidate=p.analysis.candidates[i],identity={sequenceId:m.sequenceId,activityId:candidate.activityId};
      demand(exact(e,['activityId','outcome','observedRevision','observedVersionId','recordId'])&&e.activityId===candidate.activityId,
        'invalid-migration-entry','Entrée de migration invalide.');
      const noEffect=m.sourceState==='absent'?'source-absent':m.sourceState==='blocked'?'blocked-source':candidate.text===null?'no-text':null;
      if(noEffect){
        demand(e.outcome===noEffect&&e.observedRevision===null&&e.observedVersionId===null&&e.recordId===null,
          'invalid-migration-entry','Une entrée sans texte contient un effet.');
        continue;
      }
      demand(['imported','already-identical','conflict-preserved'].includes(e.outcome)&&id(e.recordId)&&revision(e.observedRevision),
        'invalid-migration-effect','Effet de migration invalide.');
      if(e.outcome==='imported'){
        const v=state.versions.get(e.recordId);
        demand(e.observedRevision===0&&e.observedVersionId===null&&e.recordId===p.candidateIds[e.activityId]
          &&v&&key(v)===key(identity)&&v.revision===1&&v.expectedRevision===0&&v.kind==='save'&&v.text===candidate.text&&v.createdAt===m.createdAt,
          'invalid-migration-version','Version importée incohérente.');
      }else{
        const v=state.versions.get(e.observedVersionId);
        demand(e.observedRevision>0&&v&&key(v)===key(identity)&&v.revision===e.observedRevision,
          'invalid-migration-observation','Version observée introuvable.');
        if(e.outcome==='already-identical'){
          demand(e.recordId===v.operationId&&v.text===candidate.text,'invalid-migration-identical','Texte déclaré identique différent.');
        }else{
          const r=state.recoveries.get(e.recordId);
          demand(e.recordId===p.candidateIds[e.activityId]&&r&&key(r)===key(identity)&&r.text===candidate.text
            &&v.text!==candidate.text&&r.expectedRevision===0&&r.observedRevision===e.observedRevision&&r.createdAt===m.createdAt,
            'invalid-migration-recovery','Conflit de migration incohérent.');
        }
      }
      if(e.outcome!=='already-identical'){
        demand(!effects.has(e.recordId),'duplicate-migration-effect','Effet revendiqué par plusieurs reçus.');effects.add(e.recordId);
      }
    }
    migrations.set(k,m);migrationOps.set(m.operationId,m);
  }
  demand(entries<=MIGRATION_LIMITS.entries,'invalid-migration-entries','Trop d’entrées de migration.');
  return {migrations,migrationOps};
}

function current(s, identity) {
  const n=s.notes.get(key(identity)), v=n ? s.versions.get(n.versionId) : null;
  return {sequenceId:identity.sequenceId,activityId:identity.activityId,revision:n?.revision ?? 0,version:v};
}
function receipt(s, c) {
  refuse(!s.migrationOps.has(c.operationId),'operation-id-reused','Cet identifiant désigne une migration.');
  const v=s.versions.get(c.operationId), r=s.recoveries.get(c.operationId), resolved=s.resolutions.get(c.operationId);
  const storedKey=v?.requestKey ?? r?.requestKey ?? resolved?.resolution.requestKey;
  if (storedKey === undefined) return null;
  refuse(storedKey === requestKey(c), 'operation-id-reused', 'Cet identifiant désigne une autre commande.');
  if (v) return {status:v.kind === 'resolve' ? 'resolved':'saved',operationId:c.operationId,version:v,current:current(s,c)};
  if (r) return {status:'conflict',operationId:c.operationId,recovery:r,current:current(s,c)};
  return {status:'resolved',operationId:c.operationId,recovery:resolved,current:current(s,c)};
}

/**
 * Independent store for the fixed database. Optional indexedDB injection is for
 * isolated testing. openTimeoutMs must be an integer in [100,30000], default 8000.
 * No DOM, localStorage, network or existing review database is accessed.
 */
export class NotesStore {
  #factory; #timeout; #pending=null; #db=null; #epoch=0;
  constructor(options={}) {
    this.#factory=()=>Object.hasOwn(options,'indexedDB') ? options.indexedDB : globalThis.indexedDB;
    this.#timeout=options.openTimeoutMs ?? 8000;
  }

  async #guard(fn) { try { return await fn(); } catch (error) { return failure(error); } }

  async #connect() {
    if (this.#pending) return this.#pending;
    const epoch=this.#epoch;
    const pending=new Promise((resolve,reject)=>{
      let request,done=false;
      const stop=error=>{if (!done) {done=true;clearTimeout(timer);reject(error);}};
      const timer=setTimeout(()=>stop(new Issue('storage-error','open-timeout','Ouverture de la base non confirmée.')),this.#timeout);
      try {
        refuse(Number.isInteger(this.#timeout) && this.#timeout >= 100 && this.#timeout <= 30000,'invalid-options','Délai invalide.');
        const factory=this.#factory();
        if (!factory) throw new Issue('storage-error','unavailable','IndexedDB indisponible.');
        request=factory.open(NOTES_DB,NOTES_DB_VERSION);
      } catch (e) {stop(e);return;}
      request.onupgradeneeded=event=>{
        try {
          if (done || epoch !== this.#epoch) throw new Issue('storage-error','closed','Ouverture annulée.');
          demand(event.oldVersion === 0,'schema-incompatible','Mise à niveau non prise en charge.');
          for (const [name,spec] of Object.entries(NOTES_SCHEMA)) {
            const store=request.result.createObjectStore(name,{keyPath:spec.keyPath});
            for (const [indexName,index] of Object.entries(spec.indexes)) store.createIndex(indexName,index.keyPath,{unique:index.unique});
          }
        } catch (e) {request.transaction?.abort();stop(e);}
      };
      request.onblocked=()=>stop(new Issue('storage-error','open-blocked','Ouverture bloquée par une autre connexion.'));
      request.onerror=()=>stop(request.error?.name === 'VersionError' ? new Issue('refused','schema-incompatible','Une version de base plus récente existe.') : request.error);
      request.onsuccess=()=>{
        const db=request.result;
        if (done || epoch !== this.#epoch) {db.close();stop(new Issue('storage-error','closed','Connexion fermée.'));return;}
        try {checkStoreNames(db);const tx=db.transaction(names,'readonly');checkSchema(db,tx);} catch (e) {db.close();stop(e);return;}
        db.onversionchange=()=>{db.close();if (this.#db === db) {this.#db=null;this.#pending=null;this.#epoch++;}};
        db.onclose=()=>{if (this.#db === db) {this.#db=null;this.#pending=null;}};
        this.#db=db;done=true;clearTimeout(timer);resolve(db);
      };
    });
    this.#pending=pending;
    try {return await pending;} catch (e) {if (this.#pending === pending) this.#pending=null;throw e;}
  }


  #checkToken(token) {
    if(token?.stopped)throw new Issue('storage-error','operation-timeout','Opération interrompue ; résultat non confirmé.');
  }
  async #migration(fn) {
    const token={stopped:false,transactions:new Set(),writeStarted:false,committed:false,operationId:null};
    let timer;
    const timeout=new Promise(resolve=>{timer=setTimeout(()=>{
      token.stopped=true;
      for(const tx of token.transactions)try{tx.abort();}catch{}
      resolve({status:'storage-error',code:'operation-timeout',confirmed:false,operationId:token.operationId,
        mayHaveCommitted:token.writeStarted,retrySameOperation:token.operationId!==null});
    },MIGRATION_LIMITS.operationTimeoutMs);});
    const work=(async()=>{try{return await fn(token);}catch(e){
      return {...failure(e),operationId:token.operationId,...(token.committed?{mayHaveCommitted:true,retrySameOperation:true}:{})};
    }})();
    try{return await Promise.race([work,timeout]);}finally{clearTimeout(timer);}
  }
  async #prepare(db,token) {
    this.#checkToken(token);
    const rows=await new Promise((resolve,reject)=>{
      let tx;
      try{checkStoreNames(db);tx=db.transaction(['legacySnapshots'],'readonly');}catch(e){reject(e);return;}
      token?.transactions.add(tx);let result,problem;
      tx.oncomplete=()=>{token?.transactions.delete(tx);problem?reject(problem):resolve(result);};
      tx.onabort=()=>{token?.transactions.delete(tx);reject(problem||tx.error||new Issue('storage-error','transaction-aborted','Prélecture annulée.'));};
      tx.onerror=()=>{};
      try{
        const s=tx.objectStore('legacySnapshots'),count=s.count();
        count.onsuccess=()=>{try{
          demand(count.result<=MIGRATION_LIMITS.snapshots,'unsupported-data-size','Trop d’instantanés.');
          const q=s.getAll();q.onsuccess=()=>{result=q.result;};
        }catch(e){problem=e;try{tx.abort();}catch{}}};
      }catch(e){problem=e;try{tx.abort();}catch{}}
    });
    this.#checkToken(token);
    const prepared=await prepareSnapshots(rows);
    this.#checkToken(token);return prepared;
  }
  async #transaction(mode, operation, token=null) {
    this.#checkToken(token);
    const db=await this.#connect(),prepared=await this.#prepare(db,token);
    this.#checkToken(token);
    return new Promise((resolve,reject)=>{
      let tx,problem,result;
      try {
        checkStoreNames(db);tx=db.transaction(names,mode,mode==='readwrite'?{durability:'strict'}:undefined);
        token?.transactions.add(tx);if(token&&mode==='readwrite')token.writeStarted=true;
        checkSchema(db,tx);
      }catch(e){if(tx)try{tx.abort();}catch{}token?.transactions.delete(tx);reject(e);return;}
      const abort=e=>{problem=e;try{tx.abort();}catch{}};
      tx.oncomplete=()=>{token?.transactions.delete(tx);if(token&&mode==='readwrite')token.committed=true;problem?reject(problem):resolve(result);};
      tx.onabort=()=>{token?.transactions.delete(tx);reject(problem||tx.error||new Issue('storage-error','transaction-aborted','Transaction annulée.'));};
      tx.onerror=()=>{};
      const raw={},stores=Object.fromEntries(names.map(n=>[n,tx.objectStore(n)]));let remaining=names.length;
      const maximum={notes:activityCount,versions:activityCount*NOTES_LIMITS.versionsPerActivity,recoveries:activityCount*NOTES_LIMITS.recoveriesPerActivity,legacySnapshots:MIGRATION_LIMITS.snapshots,migrations:MIGRATION_LIMITS.receipts};
      try{
        for(const name of names){
          const count=stores[name].count();
          count.onsuccess=()=>{try{
            demand(count.result<=maximum[name],'unsupported-data-size','Volume incompatible : '+name);
            const read=stores[name].getAll();
            read.onsuccess=()=>{try{
              raw[name]=read.result;
              if(--remaining===0){
                this.#checkToken(token);
                demand(raw.legacySnapshots.length===prepared.size&&raw.legacySnapshots.every(s=>prepared.has(s.id)&&sameSnapshot(s,prepared.get(s.id).snapshot)),
                  'audit-raced','Les instantanés ont changé depuis leur prélecture.','refused');
                result=operation(validate(raw,prepared),stores);
              }
            }catch(e){abort(e);}};
          }catch(e){abort(e);}};
        }
      }catch(e){abort(e);}
    });
  }

  async #commit(c, operation) {
    const write=await this.#transaction('readwrite',(s,stores)=>{
      const old=receipt(s,c);if (old) return {replayed:true};
      operation(s,stores);return {replayed:false};
    });
    try {
      const read=await this.#transaction('readonly',s=>{
        const result=receipt(s,c);
        demand(result,'missing-confirmation','Résultat de l’opération introuvable.');
        return result;
      });
      return {...read,confirmed:true,replayed:write.replayed};
    } catch (e) {
      return {...failure(e),operationId:c.operationId,mayHaveCommitted:true,retrySameOperation:true};
    }
  }

  #appendVersion(s, stores, c, value, recovery=null, createdAt=new Date().toISOString()) {
    const note=s.notes.get(key(c)),rows=s.groups.get(key(c)) || [];
    refuse(rows.length < NOTES_LIMITS.versionsPerActivity,'versions-full','Limite de 100 versions atteinte ; aucune suppression.');
    const v={formatVersion:1,sequenceId:c.sequenceId,activityId:c.activityId,operationId:c.operationId,revision:(note?.revision ?? 0)+1,expectedRevision:c.expectedRevision,text:value,kind:c.kind,recoveryId:recovery?.operationId ?? null,requestKey:requestKey(c),createdAt};
    const n={formatVersion:1,sequenceId:c.sequenceId,activityId:c.activityId,revision:v.revision,versionId:v.operationId};
    s.raw.versions.push(v);
    if (note) s.raw.notes[s.raw.notes.indexOf(note)]=n;else s.raw.notes.push(n);
    if (recovery) recovery.resolution={operationId:c.operationId,choice:'apply',expectedRevision:c.expectedRevision,requestKey:requestKey(c),versionId:v.operationId,resolvedAt:v.createdAt};
    validate(s.raw,s.prepared);
    stores.versions.add(v);stores.notes.put(n);
    if (recovery) stores.recoveries.put(recovery);
  }

  /** Open/create the exact schema and audit all five stores. Returns ok or an error result. */
  async open() {return this.verifyInvariants();}

  /** Close this instance's connection. Pending opening is invalidated; active transactions may finish. */
  close() {this.#epoch++;this.#db?.close();this.#db=null;this.#pending=null;return {status:'closed'};}

  /** Read one {sequenceId,activityId}. revision=0 and version=null mean no accepted note. */
  async read(input) {return this.#guard(async()=>{const identity=inputRef(input);return this.#transaction('readonly',s=>({status:'ok',note:current(s,identity)}));});}

  /** Return all immutable accepted versions of one activity, ordered by revision. */
  async history(input) {return this.#guard(async()=>{const identity=inputRef(input);return this.#transaction('readonly',s=>({status:'ok',versions:s.groups.get(key(identity)) || []}));});}

  /** Return all recoveries, including resolved ones; texts are never purged. */
  async listRecoveries(input) {return this.#guard(async()=>{const identity=inputRef(input);return this.#transaction('readonly',s=>({status:'ok',recoveries:[...s.recoveries.values()].filter(r=>key(r) === key(identity))}));});}

  /**
   * save({sequenceId,activityId,expectedRevision,text,operationId}).
   * At the expected revision: append a version and advance only this note.
   * Otherwise: add a recovery without changing the head. All recoveries, including
   * resolved ones, count toward 50. Distinct operationIds create distinct versions
   * even for identical text. Refusals abort without an operation record.
   */
  async save(input) {return this.#guard(async()=>{
    const c=command(input,'save');
    return this.#commit(c,(s,stores)=>{
      const actual=s.notes.get(key(c))?.revision ?? 0;
      if (actual === c.expectedRevision) {this.#appendVersion(s,stores,c,c.text);return;}
      refuse([...s.recoveries.values()].filter(r=>key(r) === key(c)).length < NOTES_LIMITS.recoveriesPerActivity,'recoveries-full','Limite de 50 récupérations atteinte ; aucune suppression.');
      const r={formatVersion:1,sequenceId:c.sequenceId,activityId:c.activityId,operationId:c.operationId,expectedRevision:c.expectedRevision,observedRevision:actual,text:c.text,requestKey:requestKey(c),createdAt:new Date().toISOString(),resolution:null};
      s.raw.recoveries.push(r);validate(s.raw,s.prepared);stores.recoveries.add(r);
    });
  });}

  /** Read-only comparison plan for {sequenceId,activityId,recoveryId}; no text is adopted. */
  async prepareResolution(input) {return this.#guard(async()=>{
    const identity=inputRef(input,true);
    return this.#transaction('readonly',s=>{
      const r=s.recoveries.get(identity.recoveryId);
      refuse(r && key(r) === key(identity),'recovery-not-found','Récupération introuvable pour cette activité.');
      refuse(r.resolution === null,'already-resolved','Cette récupération possède déjà une résolution.');
      const note=current(s,identity);
      return {status:'ok',plan:{sequenceId:identity.sequenceId,activityId:identity.activityId,recoveryId:r.operationId,expectedRevision:note.revision,current:note,candidate:r}};
    });
  });}

  /**
   * resolve({sequenceId,activityId,recoveryId,expectedRevision,choice,operationId}).
   * choice='apply' appends the exact candidate as a new version; 'keep' preserves
   * the current head. Both retain the candidate and persist a verified resolution.
   * If the head changed since preparation, refuse without resolving or overwriting.
   */
  async resolve(input) {return this.#guard(async()=>{
    const c=command(input,'resolve');
    return this.#commit(c,(s,stores)=>{
      const r=s.recoveries.get(c.recoveryId);
      refuse(r && key(r) === key(c),'recovery-not-found','Récupération introuvable pour cette activité.');
      refuse(r.resolution === null,'already-resolved','Une résolution existe déjà ; elle est conservée.');
      refuse((s.notes.get(key(c))?.revision ?? 0) === c.expectedRevision,'resolution-stale','La note a changé ; préparer une nouvelle comparaison.');
      if (c.choice === 'apply') {this.#appendVersion(s,stores,c,r.text,r);return;}
      r.resolution={operationId:c.operationId,choice:'keep',expectedRevision:c.expectedRevision,requestKey:requestKey(c),versionId:null,resolvedAt:new Date().toISOString()};
      validate(s.raw,s.prepared);stores.recoveries.put(r);
    });
  });}

  /** Audit schema, limits, command identities, contiguous history and all head/resolution links. */
  async verifyInvariants() {return this.#guard(()=>this.#transaction('readonly',s=>({status:'ok',database:NOTES_DB,version:NOTES_DB_VERSION,counts:Object.fromEntries(names.map(n=>[n,s.raw[n].length]))})));}


  /** Save exact {sequenceId,present,raw}; confirmed only after complete and verified read. */
  async captureSnapshot(input) {return this.#migration(async token=>{
    const c=copySource(input),identity=await snapshotIdentity(c);
    if(identity.status!=='ok')throw new MigrationIssue(identity.code,identity.message,identity.status);
    token.operationId=identity.id;this.#checkToken(token);
    const snapshot={formatVersion:1,id:identity.id,sequenceId:c.sequenceId,sourceKey:identity.sourceKey,
      present:c.present,raw:c.raw,rawUnits:identity.rawUnits,sha256:identity.sha256,capturedAt:new Date().toISOString()};
    const preparedNew=await prepareSnapshots([snapshot]);this.#checkToken(token);
    const write=await this.#transaction('readwrite',(s,stores)=>{
      const prior=s.raw.legacySnapshots.find(x=>x.id===snapshot.id);
      if(prior){
        refuse(prior.sourceKey===snapshot.sourceKey&&prior.present===snapshot.present&&prior.raw===snapshot.raw,
          'snapshot-hash-collision','Collision d’identité ; aucune donnée remplacée.');
        return {snapshot:prior,replayed:true};
      }
      refuse(s.raw.legacySnapshots.length<MIGRATION_LIMITS.snapshots,'snapshots-full','Limite d’instantanés atteinte.');
      refuse(s.raw.legacySnapshots.filter(x=>x.sourceKey===snapshot.sourceKey).length<MIGRATION_LIMITS.snapshotsPerSource,
        'source-snapshots-full','Limite d’instantanés pour cette source atteinte.');
      refuse(s.raw.legacySnapshots.reduce((n,x)=>n+x.rawUnits,0)+snapshot.rawUnits<=MIGRATION_LIMITS.totalRawUnits,
        'snapshot-space-full','Volume maximal des instantanés atteint.');
      s.prepared.set(snapshot.id,preparedNew.get(snapshot.id));s.raw.legacySnapshots.push(snapshot);
      validate(s.raw,s.prepared);stores.legacySnapshots.add(snapshot);
      return {snapshot,replayed:false};
    },token);
    const saved=await this.#transaction('readonly',s=>{
      const actual=s.raw.legacySnapshots.find(x=>x.id===snapshot.id);
      demand(actual&&sameSnapshot(actual,write.snapshot),'missing-confirmation','Instantané non retrouvé exactement.');
      return actual;
    },token);
    return {status:'snapshot-confirmed',operationId:snapshot.id,snapshot:saved,confirmed:true,replayed:write.replayed};
  });}

  /** Read one validated snapshot or null. Does not write records. */
  async readSnapshot(input) {return this.#guard(async()=>{
    refuse(exact(input,['snapshotId']),'invalid-snapshot','Référence d’instantané invalide.');
    const value=input.snapshotId;refuse(snapshotId(value),'invalid-snapshot','Identifiant d’instantané invalide.');
    return this.#transaction('readonly',s=>({status:'ok',snapshot:s.raw.legacySnapshots.find(x=>x.id===value)||null}));
  });}

  /** Read the immutable receipt for {snapshotId,parserVersion:1}, or null. */
  async readMigration(input) {return this.#guard(async()=>{
    const c=migrationRef(input);
    return this.#transaction('readonly',s=>({status:'ok',receipt:s.migrations.get(JSON.stringify([c.snapshotId,c.parserVersion]))||null}));
  });}

  /**
   * Explicitly import a saved snapshot. Never reads localStorage. Creates first
   * versions only for empty targets; differing candidates become C1 recoveries.
   * All effects and the receipt share one transaction; no deletion or overwrite.
   */
  async importSnapshot(input) {return this.#migration(async token=>{
    const c=migrationRef(input);
    // Import id does not depend on the sequence; obtain it from the controlled snapshot.
    const read=await this.#transaction('readonly',s=>{
      const p=s.prepared.get(c.snapshotId);refuse(p,'snapshot-not-found','Instantané introuvable.');return p;
    },token);
    token.operationId=read.operationId;
    const write=await this.#transaction('readwrite',(s,stores)=>{
      const k=JSON.stringify([c.snapshotId,c.parserVersion]),prior=s.migrations.get(k);
      if(prior)return {receipt:prior,replayed:true};
      const p=s.prepared.get(c.snapshotId);refuse(p,'snapshot-not-found','Instantané introuvable.');
      refuse(s.raw.migrations.length<MIGRATION_LIMITS.receipts,'migrations-full','Limite de reçus atteinte.');
      const claimed=new Set();
      const claim=operationId=>{
        refuse(!claimed.has(operationId)&&!s.versions.has(operationId)&&!s.recoveries.has(operationId)&&!s.resolutions.has(operationId)&&!s.migrationOps.has(operationId),
          'operation-id-reused','Identifiant déjà utilisé ; aucune opération réattribuée.');
        claimed.add(operationId);
      };
      claim(p.operationId);
      const m={formatVersion:1,snapshotId:c.snapshotId,parserVersion:1,sequenceId:p.snapshot.sequenceId,
        operationId:p.operationId,requestKey:p.requestKey,sourceState:p.analysis.sourceState,sourceIssue:p.analysis.sourceIssue,
        entries:[],createdAt:new Date().toISOString()};
      for(const candidate of p.analysis.candidates){
        const e={activityId:candidate.activityId,outcome:null,observedRevision:null,observedVersionId:null,recordId:null};
        if(m.sourceState==='absent')e.outcome='source-absent';
        else if(m.sourceState==='blocked')e.outcome='blocked-source';
        else if(candidate.text===null)e.outcome='no-text';
        else{
          const identity={sequenceId:m.sequenceId,activityId:candidate.activityId},n=s.notes.get(key(identity)),v=n?s.versions.get(n.versionId):null;
          e.observedRevision=n?.revision??0;e.observedVersionId=n?.versionId??null;
          if(v&&v.text===candidate.text){e.outcome='already-identical';e.recordId=v.operationId;}
          else{
            const operationId=p.candidateIds[candidate.activityId];claim(operationId);
            const command={kind:'save',...identity,expectedRevision:0,text:candidate.text,operationId};
            e.recordId=operationId;
            if(!n){
              this.#appendVersion(s,stores,command,candidate.text,null,m.createdAt);e.outcome='imported';
            }else{
              refuse(s.raw.recoveries.filter(r=>key(r)===key(identity)).length<NOTES_LIMITS.recoveriesPerActivity,
                'recoveries-full','Limite de récupérations atteinte ; importation annulée.');
              const r={formatVersion:1,...identity,operationId,expectedRevision:0,observedRevision:n.revision,text:candidate.text,
                requestKey:requestKey(command),createdAt:m.createdAt,resolution:null};
              s.raw.recoveries.push(r);stores.recoveries.add(r);e.outcome='conflict-preserved';
            }
          }
        }
        m.entries.push(e);
      }
      s.raw.migrations.push(m);validate(s.raw,s.prepared);stores.migrations.add(m);
      return {receipt:m,replayed:false};
    },token);
    const saved=await this.#transaction('readonly',s=>{
      const actual=s.migrations.get(JSON.stringify([c.snapshotId,c.parserVersion]));
      demand(actual&&equal(actual,write.receipt),'missing-confirmation','Reçu non retrouvé exactement.');
      return actual;
    },token);
    return {status:'migration-confirmed',operationId:token.operationId,receipt:saved,confirmed:true,replayed:write.replayed};
  });}

  /** Validated persistent inventory; no automatic capture, import or retry. */
  async migrationState() {return this.#guard(()=>this.#transaction('readonly',s=>({
    status:'ok',implemented:true,legacySnapshots:s.raw.legacySnapshots,migrations:s.raw.migrations
  })));}

}
