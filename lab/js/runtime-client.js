export class Runtime {
  constructor(onState) { this.onState = onState; this.serial = 0; this.start(); }
  start() {
    this.onState('Chargement Python…');
    this.ready = new Promise((resolve, reject) => {
      this.readyReject = reject;
      this.worker = new Worker(new URL('../workers/python-worker.js', import.meta.url), {type:'module'});
      this.loadTimer = setTimeout(() => this.fail('Chargement Python trop long. Vérifiez le réseau puis réessayez.'), 60000);
      this.worker.onmessage = ({data}) => {
        if (data.type === 'ready') { clearTimeout(this.loadTimer); this.loaded = true; this.onState('Python prêt'); resolve(); }
        if (data.type === 'load-error') this.fail(data.message);
        if (data.type === 'result' && this.pending?.id === data.id) {
          clearTimeout(this.runTimer); const pending = this.pending; this.pending = null; pending.resolve(data.result);
        }
      };
      this.worker.onerror = e => this.fail(e.message || 'Worker indisponible');
    });
    this.ready.catch(() => {});
  }
  fail(message) {
    clearTimeout(this.loadTimer); clearTimeout(this.runTimer);
    this.worker.terminate(); this.loaded = false; this.failed = true;
    this.readyReject?.(Error(message));
    this.pending?.resolve({kind:'network',error:message,trace:[],success:false}); this.pending = null;
    this.onState('Python indisponible · réessayez');
  }
  async run(code, terrain) {
    if (code.length > 64000) return {kind:'exception',error:'Programme trop volumineux : maximum 64 000 caractères.',trace:[],success:false};
    if (this.failed) { this.failed = false; this.start(); }
    await this.ready;
    return new Promise(resolve => {
      const id = ++this.serial;
      this.pending = {id,resolve};
      this.runTimer = setTimeout(() => this.cancel('timeout'), 5000);
      this.worker.postMessage({type:'run',id,code,terrain});
    });
  }
  cancel(kind = 'interrupted') {
    clearTimeout(this.runTimer); clearTimeout(this.loadTimer);
    this.worker.terminate(); this.loaded = false;
    this.readyReject?.(Error('Chargement interrompu'));
    this.pending?.resolve({kind,error:kind === 'timeout' ? 'Temps maximal de 5 secondes dépassé.' : 'Interruption volontaire.',trace:[],success:false});
    this.pending = null; this.failed = false; this.start();
  }
}
