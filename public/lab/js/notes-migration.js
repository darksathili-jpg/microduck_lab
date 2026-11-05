/**
 * PROTECTION-02.C2-B. No import-time storage access; no UI, automatic migration,
 * deletion or export. Raw strings are kept as exact UTF-16 code units.
 * The coordinator reads only the six allowlisted localStorage keys.
 */
export const LEGACY_IDENTITIES = Object.freeze(Object.fromEntries(Object.entries({
  traversee:['s1','s2','s3','s4','s5','s6','transfert'],
  explore:['e1','e2','e3','e4','transfert'],
  memorise:['m1','m2','m3','m4','transfert'],
  cartographie:['c1','c2','c3','c4','transfert'],
  fiabilite:['f1','f2','f3','f4','transfert'],
  analyse:['a1','a2','a3','a4','transfert']
}).map(([k,v])=>[k,Object.freeze(v)])));
export const LEGACY_SOURCES = Object.freeze(Object.fromEntries(Object.keys(LEGACY_IDENTITIES).map(k=>[k,'microduck.lab.pilot.v1'+(k==='traversee'?'':'.'+k)])));
export const MIGRATION_LIMITS = Object.freeze({
  rawUnits:65536, snapshotsPerSource:8, snapshots:48, totalRawUnits:1048576,
  receipts:48, entries:256, depth:16, values:2048, members:128,
  textUnits:8000, operationTimeoutMs:15000
});

/** Structured internal error shared by the two modules; never an implicit conversion. */
export class MigrationIssue extends Error {
  constructor(code,message,status='refused') {super(message);this.code=code;this.status=status;}
}
const issue=(code,message,status)=>{throw new MigrationIssue(code,message,status);};
const failed=e=>({status:e instanceof MigrationIssue?e.status:'storage-error',code:e instanceof MigrationIssue?e.code:(e?.name||'storage-unavailable'),message:String(e?.message||e),confirmed:false});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const known=x=>typeof x==='string'&&Object.hasOwn(LEGACY_IDENTITIES,x);
function fields(input,keys) {
  if(!object(input)||Reflect.ownKeys(input).length!==keys.length||!keys.every(k=>Object.hasOwn(input,k)))issue('invalid-command','Champs de commande invalides.');
  return Object.fromEntries(keys.map(k=>[k,input[k]]));
}
/** Internal boundary: copy and validate exactly {sequenceId,present,raw}, or throw. */
export function copySource(input) {
  const c=fields(input,['sequenceId','present','raw']);
  if(!known(c.sequenceId)||typeof c.present!=='boolean'||(c.present?typeof c.raw!=='string':c.raw!==null))issue('invalid-source','Source historique invalide.');
  if(c.present&&c.raw.length>MIGRATION_LIMITS.rawUnits)issue('source-too-large','Valeur historique trop longue ; aucune capture confirmée.');
  return c;
}
function snapshotRef(input) {
  const c=fields(input,['snapshotId','parserVersion']);
  if(typeof c.snapshotId!=='string'||!/^ls1:[0-9a-f]{64}$/.test(c.snapshotId)||c.parserVersion!==1)issue('invalid-migration','Instantané ou parseur invalide.');
  return c;
}
const u32=n=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,false);return b;};
function u16(s) {
  const b=new Uint8Array(4+s.length*2),v=new DataView(b.buffer);v.setUint32(0,s.length,false);
  for(let i=0;i<s.length;i++)v.setUint16(4+i*2,s.charCodeAt(i),false);
  return b;
}
async function digest(parts) {
  if(!globalThis.crypto?.subtle)issue('crypto-unavailable','Calcul SHA-256 indisponible.','storage-error');
  const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;
  for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
/** Async pure identity calculation. Returns ok + id/sha256/sourceKey/rawUnits, or structured failure. */
export async function snapshotIdentity(input) {
  try {
    const c=copySource(input),sourceKey=LEGACY_SOURCES[c.sequenceId];
    const sha256=await digest([u16('MDL.legacy.v1'),u16(sourceKey),Uint8Array.of(c.present?1:0),...(c.present?[u16(c.raw)]:[])]);
    return {status:'ok',id:'ls1:'+sha256,sha256,sourceKey,rawUnits:c.present?c.raw.length:0};
  } catch(e){return failed(e);}
}
/** Internal pure deterministic identifiers; invalid arguments reject before hashing. */
export async function migrationIdentifiers(snapshotId,sequenceId,parserVersion=1) {
  snapshotRef({snapshotId,parserVersion});
  if(!known(sequenceId))issue('invalid-identity','Séquence inconnue.');
  const operationId='mi1:'+await digest([u16('MDL.import.v1'),u16(snapshotId),u32(parserVersion)]);
  const candidateIds=Object.fromEntries(await Promise.all(LEGACY_IDENTITIES[sequenceId].map(async activityId=>[
    activityId,'ma1:'+await digest([u16('MDL.candidate.v1'),u16(snapshotId),u32(parserVersion),u16(sequenceId),u16(activityId)])
  ])));
  return {operationId,requestKey:JSON.stringify(['import',1,snapshotId,parserVersion]),candidateIds};
}
// Bounded JSON parser. JSON.parse is used ONLY on an already delimited string
// token; object keys are compared after decoding, before any assignment.
function parseBounded(raw) {
  let i=0,values=0,members=0;
  const bad=code=>issue(code,code);
  const ws=()=>{while(i<raw.length&&/[ \t\r\n]/.test(raw[i]))i++;};
  function string() {
    if(raw[i]!=='"')bad('invalid-json');const start=i++;
    while(i<raw.length){
      const c=raw.charCodeAt(i++);
      if(c===34){try{return JSON.parse(raw.slice(start,i));}catch{bad('invalid-json');}}
      if(c<32)bad('invalid-json');
      if(c===92){
        if(i>=raw.length)bad('invalid-json');const e=raw[i++];
        if(e==='u'){if(!/^[0-9a-fA-F]{4}$/.test(raw.slice(i,i+4)))bad('invalid-json');i+=4;}
        else if(!'"\\/bfnrt'.includes(e))bad('invalid-json');
      }
    }
    bad('invalid-json');
  }
  function value(depth) {
    ws();if(++values>MIGRATION_LIMITS.values)bad('parser-limit');
    const c=raw[i];
    if(c==='"')return string();
    if(c==='{'||c==='['){
      if(depth+1>MIGRATION_LIMITS.depth)bad('parser-limit');
      i++;ws();const isObject=c==='{',end=isObject?'}':']',out=isObject?Object.create(null):[],seen=new Set();
      if(raw[i]===end){i++;return out;}
      while(i<raw.length){
        ws();let k;
        if(isObject){
          if(++members>MIGRATION_LIMITS.members)bad('parser-limit');
          k=string();if(seen.has(k))bad('duplicate-member');seen.add(k);ws();
          if(raw[i++]!==':')bad('invalid-json');
        }
        const v=value(depth+1);if(isObject)out[k]=v;else out.push(v);ws();
        if(raw[i]===end){i++;return out;}
        if(raw[i++]!==',')bad('invalid-json');
      }
      bad('invalid-json');
    }
    for(const [token,v]of [['true',true],['false',false],['null',null]])if(raw.startsWith(token,i)){i+=token.length;return v;}
    const number=raw.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if(number){i+=number[0].length;return Number(number[0]);}
    bad('invalid-json');
  }
  const result=value(0);ws();if(i!==raw.length)bad('invalid-json');return result;
}
/**
 * Pure bounded analysis of exactly {sequenceId,present,raw,parserVersion:1}.
 * Returns ok + sourceState/sourceIssue/candidates[{activityId,text:string|null}].
 * A blocked source has no candidates; null means absent, "" remains a valid text.
 */
export function analyzeLegacy(input) {
  try {
    const c=fields(input,['sequenceId','present','raw','parserVersion']);
    const source=copySource({sequenceId:c.sequenceId,present:c.present,raw:c.raw});
    if(c.parserVersion!==1)issue('unsupported-parser','Parseur non pris en charge.');
    const empty=()=>LEGACY_IDENTITIES[c.sequenceId].map(activityId=>({activityId,text:null}));
    const blocked=code=>({status:'ok',sourceState:'blocked',sourceIssue:code,candidates:empty()});
    if(!source.present)return {status:'ok',sourceState:'absent',sourceIssue:null,candidates:empty()};
    let data;try{data=parseBounded(source.raw);}catch(e){if(e instanceof MigrationIssue)return blocked(e.code);throw e;}
    if(!object(data))return blocked('invalid-root');
    if(data.version!==1)return blocked('unsupported-version');
    const keys=Object.keys(data);
    if(keys.length!==2||!Object.hasOwn(data,'version')||!Object.hasOwn(data,'notes'))return blocked('extra-fields');
    if(!object(data.notes))return blocked('invalid-notes');
    for(const k of Object.keys(data.notes))if(!LEGACY_IDENTITIES[c.sequenceId].includes(k))return blocked('unknown-activity');
    for(const k of Object.keys(data.notes)){
      if(typeof data.notes[k]!=='string')return blocked('invalid-note-type');
      if(data.notes[k].length>MIGRATION_LIMITS.textUnits)return blocked('text-too-long');
    }
    return {status:'ok',sourceState:'valid-v1',sourceIssue:null,candidates:LEGACY_IDENTITIES[c.sequenceId].map(activityId=>({
      activityId,text:Object.hasOwn(data.notes,activityId)?data.notes[activityId]:null
    }))};
  }catch(e){return failed(e);}
}

/** Explicit coordinator. Constructor/import performs no storage operation. */
export class NotesMigration {
  #store;#storage;
  constructor({store,storageFactory=()=>globalThis.localStorage}={}) {this.#store=store;this.#storage=storageFactory;}
  #read(sequenceId) {
    try {
      const storage=this.#storage(),raw=storage.getItem(LEGACY_SOURCES[sequenceId]);
      if(raw!==null&&typeof raw!=='string')issue('invalid-source','Lecture historique non textuelle.');
      return {status:'ok',sequenceId,present:raw!==null,raw};
    }catch(e){return {...failed(e),status:'source-error'};}
  }
  /** Read a single known key and persist its exact raw snapshot; never calls setItem/removeItem. */
  async capture(input) {
    try {
      const c=fields(input,['sequenceId']);if(!known(c.sequenceId))issue('invalid-identity','Séquence inconnue.');
      const source=this.#read(c.sequenceId);if(source.status!=='ok')return source;
      const result=await this.#store.captureSnapshot({sequenceId:source.sequenceId,present:source.present,raw:source.raw});
      return {...result,phase:'capture'};
    }catch(e){return failed(e);}
  }
  /** Inspect a saved snapshot without changing records; does not read the current legacy key. */
  async inspect(input) {
    try {
      const c=snapshotRef(input),read=await this.#store.readSnapshot({snapshotId:c.snapshotId});
      if(read.status!=='ok')return read;if(!read.snapshot)return {status:'refused',code:'snapshot-not-found',confirmed:false};
      const s=read.snapshot;
      return {...analyzeLegacy({sequenceId:s.sequenceId,present:s.present,raw:s.raw,parserVersion:c.parserVersion}),snapshot:s};
    }catch(e){return failed(e);}
  }
  /**
   * Replay an existing receipt before checking the live source. For a new import,
   * require exact precheck equality; the postcheck is informational, never atomic.
   */
  async import(input) {
    try {
      const c=snapshotRef(input),prior=await this.#store.readMigration(c);
      if(prior.status!=='ok')return prior;
      const read=await this.#store.readSnapshot({snapshotId:c.snapshotId});
      if(read.status!=='ok')return read;if(!read.snapshot)return {status:'refused',code:'snapshot-not-found',confirmed:false};
      const s=read.snapshot;
      if(!prior.receipt){
        const before=this.#read(s.sequenceId);if(before.status!=='ok')return {...before,phase:'precheck',snapshotId:s.id};
        if(before.present!==s.present||before.raw!==s.raw)return {status:'refused',code:'source-changed',confirmed:false,phase:'precheck',snapshotId:s.id};
      }
      const result=await this.#store.importSnapshot(c);
      if(!result.confirmed)return {...result,phase:'import'};
      const after=this.#read(s.sequenceId);
      const sourceCheck=after.status!=='ok'?'read-refused':after.present===s.present&&after.raw===s.raw?'unchanged':'changed';
      return {...result,sourceCheck,phase:'import'};
    }catch(e){return failed(e);}
  }
}
