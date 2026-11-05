// This channel never changes Python execution or its validation ledger.
export class PedagogyClient {
  constructor(){this.serial=0;this.pending=new Map();}
  close(){this.worker?.terminate();this.worker=null;for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.resolve(this.unavailable());}this.pending.clear();}
  unavailable(){return {status:'BLOCKED',reasons:['Analyse indisponible ou délai dépassé ; contrôle enseignant nécessaire.'],competence:'BLOCKED'};}
  analyze(code,contract){
    if(code.length>64000)return Promise.resolve(this.unavailable());
    if(!this.worker){try{this.worker=new Worker(new URL('../workers/pedagogy-worker.js',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>{const entry=this.pending.get(data.id);if(!entry)return;clearTimeout(entry.timer);this.pending.delete(data.id);entry.resolve(data.result);};this.worker.onerror=()=>this.close();}catch{return Promise.resolve(this.unavailable());}}
    return new Promise(resolve=>{const id=++this.serial;const timer=setTimeout(()=>this.close(),60000);this.pending.set(id,{resolve,timer});try{this.worker.postMessage({id,code,required:contract.required,forbidden:contract.forbidden});}catch{this.close();}});
  }
}
