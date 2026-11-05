import {NotesStore, NOTES_IDENTITIES} from './notes-store.js';
import {NotesMigration, LEGACY_SOURCES} from './notes-migration.js';

const key = (sequenceId, activityId) => sequenceId+'/'+activityId;
const problem = e => ({status:'storage-error',code:e?.name||'unavailable',confirmed:false});
const errorText = r => r?.status==='inconsistent'
  ? 'Impossible de relire les explications enregistrées. Aucune réparation automatique n’a été effectuée.'
  : /full|limit|too-large/.test(r?.code||'')
    ? 'La limite de conservation est atteinte. Copie ton texte ; aucune donnée ancienne n’a été supprimée.'
    : 'Enregistrement ou lecture non confirmé. Garde cette page ouverte et copie ton texte avant de fermer.';

/** Only explicit commands write. Drafts and uncertain commands live per identity,
 * not per visible textarea. A timeout does not establish rollback. */
export class NotesController {
  constructor({store=new NotesStore(),migration,notify=()=>{},newId=()=>crypto.randomUUID(),timeoutMs=15000}={}) {
    this.store=store;this.capturedSources=new Map();
    this.migration=migration||new NotesMigration({store,storageFactory:()=>({getItem:sourceKey=>{
      const raw=globalThis.localStorage.getItem(sourceKey),sequenceId=Object.keys(LEGACY_SOURCES).find(k=>LEGACY_SOURCES[k]===sourceKey);
      this.capturedSources.set(sequenceId,{sequenceId,present:raw!==null,raw});return raw;
    }})});this.notify=notify;
    this.newId=newId;this.timeoutMs=timeoutMs;this.items=new Map();this.sources=new Map();
    this.active=null;this.contextGeneration=0;
  }
  emit(){this.notify(this.snapshot());}
  snapshot(){
    const s=this.active;
    return s?{sequenceId:s.sequenceId,activityId:s.activityId,text:s.text,generation:s.generation,
      contextGeneration:this.contextGeneration,ready:s.ready&&!s.loading,editable:s.ready||!s.loading,status:s.status,
      dirty:s.dirty,busy:s.busy,loading:s.loading,message:s.message,pending:!!s.pending,
      recoveries:s.recoveries,plan:s.plan,source:this.sources.get(s.sequenceId)||null,
      unsaved:[...this.items.values()].filter(x=>x.dirty||x.pending||x.busy).length}:null;
  }
  matches(c){const n=this.snapshot();return !!n&&n.ready&&c.ready&&n.sequenceId===c.sequenceId&&n.activityId===c.activityId&&n.generation===c.generation&&n.contextGeneration===c.contextGeneration&&n.text===c.text;}
  hasUnsaved(){return [...this.items.values()].some(s=>s.dirty||s.pending||s.busy)||[...this.sources.values()].some(s=>s.busy||s.captureCommand||s.pendingImport);}
  async call(fn){
    let timer;
    try{return await Promise.race([Promise.resolve().then(fn),new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'storage-error',code:'ui-timeout',confirmed:false,mayHaveCommitted:true}),this.timeoutMs);})]);}
    catch(e){return problem(e);}finally{clearTimeout(timer);}
  }
  select(sequenceId,activityId){
    this.contextGeneration++;
    if(!activityId){this.active=null;this.emit();return Promise.resolve();}
    if(typeof sequenceId!=='string'||typeof activityId!=='string'||!Object.hasOwn(NOTES_IDENTITIES,sequenceId)||!NOTES_IDENTITIES[sequenceId].includes(activityId))throw Error('Unknown explanation identity');
    const k=key(sequenceId,activityId);
    if(!this.items.has(k))this.items.set(k,{sequenceId,activityId,text:'',baseText:'',revision:0,generation:0,
      ready:false,loading:false,dirty:false,busy:false,pending:null,recoveries:[],plan:null,status:'loading',message:'',readTicket:0});
    this.active=this.items.get(k);this.emit();return this.load(this.active);
  }
  async load(s=this.active){
    if(!s||s.busy||s.pending)return;
    const ticket=++s.readTicket,generation=s.generation;
    s.loading=true;s.message='Chargement de ton explication…';this.emit();
    const note=await this.call(()=>this.store.read({sequenceId:s.sequenceId,activityId:s.activityId}));
    const recoveries=note.status==='ok'?await this.call(()=>this.store.listRecoveries({sequenceId:s.sequenceId,activityId:s.activityId})):note;
    if(ticket!==s.readTicket||s.busy)return;
    s.loading=false;
    if(note.status!=='ok'||recoveries.status!=='ok'){
      s.status='error';s.message=errorText(note.status!=='ok'?note:recoveries);this.emit();return;
    }
    s.recoveries=recoveries.recoveries.filter(r=>r.resolution===null);
    if(!s.dirty&&!s.pending&&generation===s.generation){
      const next=note.note.version?.text??'';
      if(next!==s.text||!s.ready)s.generation++;
      s.text=next;s.baseText=next;s.revision=note.note.revision;s.ready=true;
    }
    s.status=s.dirty?'modified':s.recoveries.length?'conflict':'loaded';
    s.message=s.dirty?'Modifications non enregistrées.':s.recoveries.length?'Deux versions sont conservées. Compare-les avant de choisir.':note.note.version?'Explication enregistrée retrouvée sur ce navigateur.':'Aucune explication enregistrée pour cette activité.';
    this.emit();
  }
  edit(text){
    const s=this.active;if(!s||(s.loading&&!s.ready)||typeof text!=='string')return;
    s.text=text;s.generation++;s.ready=true;s.dirty=true;s.plan=null;s.status='modified';
    s.message='Modifications non enregistrées.';this.emit();
  }
  useEmpty(){const s=this.active;if(s&&!s.ready&&!s.loading&&!s.busy&&s.text==='')this.edit('');}
  async save(){
    const s=this.active;if(!s||s.busy||s.loading||!s.ready)return;
    if(!s.pending&&!s.dirty)return;
    if(!s.pending){
      if(s.text.length>8000){s.status='error';s.message='Ton texte dépasse 8 000 caractères UTF-16. Il reste entier dans cette page ; copie-le avant de fermer.';this.emit();return;}
      try{s.pending={method:'save',generation:s.generation,command:{sequenceId:s.sequenceId,activityId:s.activityId,expectedRevision:s.revision,text:s.text,operationId:this.newId()}};}
      catch(e){s.status='error';s.message=errorText(problem(e));this.emit();return;}
    }
    return this.run(s);
  }
  async run(s){
    const p=s.pending;if(!p||s.busy)return;
    s.readTicket++;s.loading=false;s.busy=true;s.status='saving';s.message='Enregistrement en cours…';this.emit();
    const r=await this.call(()=>this.store[p.method](p.command));
    s.busy=false;
    if(!r.confirmed){
      // Definitive refusals have no effect; all uncertain failures retain the command.
      if(r.status==='refused'&&!r.mayHaveCommitted)s.pending=null;
      s.status='error';s.message=errorText(r);this.emit();return r;
    }
    s.pending=null;s.plan=null;
    const unchanged=s.generation===p.generation;
    if(p.method==='save'){
      s.dirty=!unchanged;
      if(r.status==='saved'){s.revision=r.version.revision;s.baseText=r.version.text;}
      if(r.status==='conflict')s.recoveries=[...s.recoveries.filter(x=>x.operationId!==r.recovery.operationId),r.recovery].filter(x=>!x.resolution);
    }else if(unchanged){
      s.text=r.current.version?.text??'';s.baseText=s.text;s.revision=r.current.revision;s.generation++;s.dirty=false;
    }
    s.status=s.dirty?'modified':r.status==='conflict'?'conflict':'confirmed';
    s.message=s.dirty?'La version précédente est conservée ; tes nouvelles modifications ne sont pas enregistrées.':r.status==='conflict'?'Deux versions sont conservées. Compare-les avant de choisir.':'Cette explication est enregistrée sur ce navigateur.';
    const rs=await this.call(()=>this.store.listRecoveries({sequenceId:s.sequenceId,activityId:s.activityId}));
    if(rs.status==='ok')s.recoveries=rs.recoveries.filter(x=>!x.resolution);
    else{s.status='error';s.message='Écriture confirmée, mais comparaison des versions indisponible. Copie ton texte avant de fermer.';}
    this.emit();return r;
  }
  async compare(recoveryId){
    const s=this.active;if(!s||s.busy||s.pending||s.dirty)return;
    const generation=s.generation;
    const r=await this.call(()=>this.store.prepareResolution({sequenceId:s.sequenceId,activityId:s.activityId,recoveryId}));
    if(s.generation!==generation||s.dirty||s.pending)return;
    if(r.status==='ok')s.plan={...r.plan,generation};else{s.plan=null;s.status='error';s.message=errorText(r);}
    this.emit();
  }
  async resolve(choice){
    const s=this.active,p=s?.plan;if(!p||s.busy||s.pending||s.dirty||p.generation!==s.generation||!['apply','keep'].includes(choice))return;
    try{s.pending={method:'resolve',generation:s.generation,command:{sequenceId:s.sequenceId,activityId:s.activityId,recoveryId:p.recoveryId,expectedRevision:p.expectedRevision,choice,operationId:this.newId()}};}
    catch(e){s.message=errorText(problem(e));this.emit();return;}
    return this.run(s);
  }
  source(sequenceId){
    if(!this.sources.has(sequenceId))this.sources.set(sequenceId,{busy:false,snapshotId:null,analysis:null,snapshots:[],message:'',changed:false,captureCommand:null,pendingImport:null});
    return this.sources.get(sequenceId);
  }
  sourceChanged(sequenceId){const m=this.source(sequenceId);m.changed=true;m.message='Les anciennes explications ont changé. Vérifie à nouveau la source avant de poursuivre.';this.emit();}
  async findLegacy(){
    const s=this.active;if(!s)return;const m=this.source(s.sequenceId);if(m.busy||m.pendingImport)return;
    m.busy=true;m.analysis=null;m.message='Recherche et conservation des anciennes explications…';this.emit();
    const r=m.captureCommand?await this.call(()=>this.store.captureSnapshot(m.captureCommand)):await this.call(()=>this.migration.capture({sequenceId:s.sequenceId}));
    if(!r.confirmed&&r.status!=='source-error'&&(r.mayHaveCommitted||r.status==='storage-error'))m.captureCommand=m.captureCommand||this.capturedSources.get(s.sequenceId)||null;
    else m.captureCommand=null;
    if(r.snapshot?.id)m.snapshotId=r.snapshot.id;
    else if(r.operationId?.startsWith('ls1:'))m.snapshotId=r.operationId;
    const inventory=await this.call(()=>this.store.migrationState());
    if(inventory.status==='ok')m.snapshots=inventory.legacySnapshots.filter(x=>x.sequenceId===s.sequenceId);
    m.busy=false;
    if(r.confirmed){m.changed=false;await this.inspectLegacy(m.snapshotId,s.sequenceId);}
    else{m.message=errorText(r)+' Les anciennes sources restent intactes.';this.emit();}
  }
  async inspectLegacy(snapshotId,sequenceId=this.active?.sequenceId){
    const m=this.source(sequenceId);if(m.busy||m.pendingImport||m.captureCommand)return;m.busy=true;m.message='Lecture de la copie conservée…';this.emit();
    const r=await this.call(()=>this.migration.inspect({snapshotId,parserVersion:1}));m.busy=false;
    if(r.status==='ok'&&r.snapshot.sequenceId===sequenceId){
      m.snapshotId=snapshotId;m.analysis=r;
      m.message=r.sourceState==='blocked'?'Anciennes données conservées intégralement, mais non importables. Demande de l’aide à ton enseignant.':r.sourceState==='absent'?'La copie correspond à une ancienne source absente.':'Copie conservée. Tu peux maintenant importer cet instantané ; les différences seront gardées pour comparaison.';
    }else{m.analysis=null;m.message=errorText(r);}
    this.emit();
  }
  async importLegacy(){
    const s=this.active;if(!s)return;const m=this.source(s.sequenceId);
    if(m.busy||m.captureCommand||!m.snapshotId||m.analysis?.snapshot.id!==m.snapshotId)return;
    m.pendingImport=m.pendingImport||{snapshotId:m.snapshotId,parserVersion:1};
    m.busy=true;m.message='Importation de la copie conservée…';this.emit();
    const r=await this.call(()=>this.migration.import(m.pendingImport));m.busy=false;
    if(r.confirmed||(r.status==='refused'&&!r.mayHaveCommitted)||r.status==='source-error')m.pendingImport=null;
    if(r.confirmed&&r.receipt){
      const counts={};for(const e of r.receipt.entries)counts[e.outcome]=(counts[e.outcome]||0)+1;
      m.message=r.receipt.sourceState==='blocked'?'Copie conservée, aucun texte importé.':r.receipt.sourceState==='absent'?'Source absente dans cette copie ; aucun texte importé.':
        'Pour cette copie : '+(counts.imported||0)+' explication(s) ajoutée(s), '+(counts['already-identical']||0)+' identique(s), '+(counts['conflict-preserved']||0)+' différence(s) conservée(s), '+(counts['no-text']||0)+' activité(s) sans texte.';
      if(r.sourceCheck==='changed'||m.changed){m.changed=true;m.message+=' La source historique a changé ; son contenu actuel n’est pas déclaré transféré.';}
      else if(r.sourceCheck==='read-refused')m.message+=' La source actuelle n’a pas pu être vérifiée.';
      else m.message+=' La source était identique lors de la vérification ; les anciennes données sont conservées.';
      for(const item of this.items.values())if(item.sequenceId===s.sequenceId)await this.load(item);
    }else m.message=r.code==='source-changed'?'Les anciennes explications ont changé. Retrouve une nouvelle copie avant de l’importer.':errorText(r)+' Réessaie cette même copie ; aucune importation complète n’est annoncée.';
    this.emit();return r;
  }
}

/** DOM adapter stays beside the existing textarea, including when the teaching
 * layout moves its enclosing details. Student content is never HTML. */
export function mountNotes({textarea,status}){
  const controls=document.createElement('div');controls.id='notes-controls';
  controls.innerHTML='<div class="controls"><button type="button" id="notes-save">Enregistrer mon explication</button><button type="button" id="notes-refresh">Relire les explications enregistrées</button><button type="button" id="notes-empty" hidden>Continuer avec une explication vide pour un échange oral</button></div><p id="notes-unsaved" role="status"></p><details id="notes-conflicts"><summary>Comparer les versions conservées</summary><div id="notes-recoveries"></div><section id="notes-comparison" hidden><label>Version enregistrée<textarea id="notes-current" readonly rows="4"></textarea></label><label>Version à comparer<textarea id="notes-candidate" readonly rows="4"></textarea></label><button type="button" id="notes-apply">Choisir la version à comparer</button><button type="button" id="notes-keep">Garder la version enregistrée</button></section></details><details id="notes-legacy"><summary>Anciennes explications</summary><button type="button" id="notes-find">Retrouver mes anciennes explications</button><label>Copies conservées<select id="notes-snapshots"></select></label><button type="button" id="notes-inspect">Examiner cette copie</button><button type="button" id="notes-import">Importer cette copie</button><p id="notes-migration-status" role="status"></p><label id="notes-raw-label" hidden>Copie intégrale des anciennes données, à conserver<textarea id="notes-raw" readonly rows="5"></textarea></label></details>';
  textarea.after(status,controls);textarea.setAttribute('aria-describedby',status.id);
  const $=id=>controls.querySelector('#'+id);let rendered=null;
  const controller=new NotesController({notify:s=>{
    textarea.disabled=!s||!s.editable;
    if(s&&textarea.value!==s.text)textarea.value=s.text;
    if(!s)textarea.value='';
    const message=s?.message||'';if(status.textContent!==message)status.textContent=message;
    status.dataset.state=s?.status||'idle';
    $('notes-save').disabled=!s||s.loading||s.busy||!s.ready||(!s.dirty&&!s.pending);
    $('notes-save').textContent=s?.pending?'Réessayer le même enregistrement':'Enregistrer mon explication';
    $('notes-refresh').disabled=!s||s.busy||s.loading||s.pending;
    $('notes-empty').hidden=!s||s.ready||s.loading||s.text!=='';
    const unsaved=s?.unsaved||0;$('notes-unsaved').textContent=unsaved?'Texte non confirmé dans '+unsaved+' activité(s). Il reste dans cette page ; copie-le avant de fermer.':'';
    const identity=s?key(s.sequenceId,s.activityId):'';
    if(rendered!==identity){$('notes-comparison').hidden=true;rendered=identity;}
    $('notes-recoveries').replaceChildren();
    for(const r of s?.recoveries||[]){const b=document.createElement('button');b.type='button';b.textContent='Comparer la version du '+new Date(r.createdAt).toLocaleString('fr-FR');b.disabled=s.busy||s.dirty||s.pending;b.onclick=()=>controller.compare(r.operationId);$('notes-recoveries').append(b);}
    $('notes-conflicts').hidden=!(s?.recoveries.length||s?.plan);
    $('notes-comparison').hidden=!s?.plan;
    if(s?.plan){$('notes-current').value=s.plan.current.version?.text??'';$('notes-candidate').value=s.plan.candidate.text;}
    for(const name of ['notes-apply','notes-keep'])$(name).disabled=!s?.plan||s.busy||s.dirty||s.pending;
    const m=s?.source;$('notes-find').disabled=!s||m?.busy||!!m?.pendingImport;
    $('notes-find').textContent=m?.captureCommand?'Réessayer la conservation de la même copie':'Retrouver mes anciennes explications';
    $('notes-inspect').disabled=!s||m?.busy||m?.captureCommand||m?.pendingImport||!m?.snapshots.length;
    $('notes-import').disabled=!s||m?.busy||m?.captureCommand||!m?.analysis||m.analysis.snapshot.id!==m.snapshotId;
    $('notes-import').textContent=m?.pendingImport?'Réessayer l’importation de la même copie':'Importer cette copie';
    $('notes-snapshots').replaceChildren(...(m?.snapshots||[]).map(x=>new Option(new Date(x.capturedAt).toLocaleString('fr-FR'),x.id)));
    if(m?.snapshotId)$('notes-snapshots').value=m.snapshotId;
    $('notes-migration-status').textContent=m?.message||'Les anciennes données ne sont jamais effacées par cette migration.';
    $('notes-raw-label').hidden=m?.analysis?.sourceState!=='blocked';$('notes-raw').value=m?.analysis?.sourceState==='blocked'?m.analysis.snapshot.raw:'';
    dispatchEvent(new CustomEvent('lab-notes-state',{detail:s?{sequenceId:s.sequenceId,activityId:s.activityId,generation:s.generation,contextGeneration:s.contextGeneration,ready:s.ready}:null}));
  }});
  textarea.addEventListener('input',()=>controller.edit(textarea.value));
  $('notes-save').onclick=()=>controller.save();$('notes-refresh').onclick=()=>controller.load();
  $('notes-empty').onclick=()=>controller.useEmpty();
  $('notes-apply').onclick=()=>controller.resolve('apply');$('notes-keep').onclick=()=>controller.resolve('keep');
  $('notes-find').onclick=()=>controller.findLegacy();$('notes-inspect').onclick=()=>controller.inspectLegacy($('notes-snapshots').value);
  $('notes-import').onclick=()=>controller.importLegacy();
  addEventListener('beforeunload',e=>{if(controller.hasUnsaved()){e.preventDefault();e.returnValue='';}});
  addEventListener('focus',()=>controller.load());
  addEventListener('storage',e=>{const seq=Object.keys(LEGACY_SOURCES).find(k=>LEGACY_SOURCES[k]===e.key);if(seq)controller.sourceChanged(seq);else if(e.key===null)for(const k of Object.keys(LEGACY_SOURCES))controller.sourceChanged(k);});
  controller.emit();return controller;
}
