export const FIRST_OCCURRENCE_POLICY='analyse/a2:first-occurrence:v1';
const functionCases={duplicates:0,absent:-1,empty:-1,last:2};
const checkReasons=new Set(['missing','not-callable','exception','type','value','mutation','action']);
const unavailableChecks=()=>({policy:FIRST_OCCURRENCE_POLICY,status:'unavailable',cases:[]});
// Validate the Worker report, including completeness, before presenting its verdict.
export function normalizeFirstOccurrenceChecks(report){
  if(!report||report.policy!==FIRST_OCCURRENCE_POLICY||!['pass','fail'].includes(report.status)||
    !Array.isArray(report.cases)||report.cases.length!==4)return unavailableChecks();
  const seen=new Set(),rows=[];
  for(const row of report.cases){
    if(!row||!Object.hasOwn(functionCases,row.id)||seen.has(row.id)||row.expected!==functionCases[row.id]||
      !['pass','fail'].includes(row.status)||typeof row.unchanged!=='boolean'||typeof row.actionAttempted!=='boolean'||
      !(row.actual===null||typeof row.actual==='string'&&row.actual.length<=80)||
      !(row.actualType===null||typeof row.actualType==='string'&&row.actualType.length<=80)||
      typeof row.error!=='string'||row.error.length>500||
      (row.status==='fail'?!checkReasons.has(row.reason):row.reason!==''))return unavailableChecks();
    if(row.status==='pass'&&(!row.unchanged||row.actionAttempted||row.actualType!=='int'||row.actual!==String(row.expected)))return unavailableChecks();
    seen.add(row.id);rows.push({...row});
  }
  if((rows.every(row=>row.status==='pass')?'pass':'fail')!==report.status)return unavailableChecks();
  return {policy:FIRST_OCCURRENCE_POLICY,status:report.status,cases:rows};
}
export class Runtime {
  constructor(onState, options = {}) {
    this.onState = onState; this.serial = 0; this.generation = 0;
    this.factory = options.workerFactory || (() => new Worker(new URL('../workers/python-worker.js', import.meta.url), {type:'module'}));
    this.loadTimeout = options.loadTimeout ?? 60000;
    this.runTimeout = options.runTimeout ?? 5000;
    this.start();
  }
  start() {
    const generation = ++this.generation;
    this.loaded = false; this.failed = false;
    this.onState('Chargement Python…');
    this.ready = new Promise((resolve, reject) => {
      this.readyReject = reject;
      let worker;
      try { worker = this.worker = this.factory(); }
      catch (e) { this.failed = true; this.onState('Python indisponible · réessayez'); reject(e); return; }
      const current = () => generation === this.generation && worker === this.worker;
      let readyReceived=false,token;
      this.loadTimer = setTimeout(() => { if (current()) this.fail('Chargement Python trop long. Vérifiez le réseau puis réessayez.'); }, this.loadTimeout);
      worker.onmessage = ({data}) => {
        if (!current()) return;
        if (data.type === 'ready' && !readyReceived) { readyReceived=true;token=data.token;clearTimeout(this.loadTimer); this.loaded = true; this.onState('Python prêt'); resolve(); }
        if (data.type === 'load-error') this.fail(data.message);
        if (data.type === 'result' && readyReceived && data.token === token && this.pending?.id === data.id) {
          clearTimeout(this.runTimer); const pending = this.pending; this.pending = null;
          // Replace the interpreter, including imported modules and virtual files.
          worker.terminate(); this.start(); pending.resolve(pending.functionCheck && data.result?.kind==='ok' ? {...data.result,functionChecks:normalizeFirstOccurrenceChecks(data.result.functionChecks)} : data.result);
        }
      };
      worker.onerror = e => { if (current()) this.fail(e.message || 'Worker indisponible'); };
    });
    this.ready.catch(() => {});
  }
  fail(message) {
    clearTimeout(this.loadTimer); clearTimeout(this.runTimer);
    ++this.generation; this.worker?.terminate(); this.loaded = false; this.failed = true;
    this.readyReject?.(Error(message));
    this.pending?.resolve({kind:'network',error:message,trace:[],success:false}); this.pending = null;
    this.onState('Python indisponible · réessayez');
  }
  async run(code, terrain, options = {}) {
    if (code.length > 64000) return {kind:'exception',error:'Programme trop volumineux : maximum 64 000 caractères.',trace:[],success:false};
    if (this.pending || this.waiting) return {kind:'exception',error:'Une exécution est déjà en cours.',trace:[],success:false};
    if (this.failed) this.start();
    const generation = this.generation;
    const waiting = this.waiting = {};
    try { await this.ready; }
    catch (e) { return {kind:this.failed ? 'network':'interrupted',error:e.message,trace:[],success:false}; }
    finally { if (this.waiting === waiting) this.waiting = null; }
    if (generation !== this.generation) return {kind:'interrupted',error:'Interruption volontaire.',trace:[],success:false};
    return new Promise(resolve => {
      const id = ++this.serial;
      const functionCheck = options?.functionCheck===FIRST_OCCURRENCE_POLICY ? FIRST_OCCURRENCE_POLICY : undefined;
      this.pending = {id,resolve,functionCheck};
      this.runTimer = setTimeout(() => { if (generation === this.generation) this.cancel('timeout'); }, this.runTimeout);
      try { this.worker.postMessage({type:'run',id,code,terrain,...(functionCheck?{functionCheck}:{})}); }
      catch (e) { this.fail(e.message || 'Envoi au Worker impossible'); }
    });
  }
  cancel(kind = 'interrupted') {
    clearTimeout(this.runTimer); clearTimeout(this.loadTimer);
    this.worker?.terminate(); this.loaded = false;
    this.readyReject?.(Error('Chargement interrompu'));
    this.pending?.resolve({kind,error:kind === 'timeout' ? 'Temps maximal de 5 secondes dépassé.' : 'Interruption volontaire.',trace:[],success:false});
    this.pending = null; this.waiting = null; this.start();
  }
}
