// Local source documents only. No execution, assessment, terrain or renderer state.
export const DRAFT_KEY='microduck.lab.student-drafts.v1';
const MAX_BYTES=2*1024*1024,object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validDoc=d=>object(d)&&typeof d.code==='string'&&typeof d.label==='string'&&Number.isSafeInteger(d.revision)&&d.revision>=0;
export function parseDrafts(raw){
  if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Volume de brouillons trop important.');
  const d=JSON.parse(raw);
  if(!object(d)||d.version!==1||!object(d.documents)||typeof d.active!=='string'||!Object.hasOwn(d.documents,d.active)||!Array.isArray(d.recovery)||d.recovery.length>50||Object.keys(d.documents).length>128)throw Error('Format de brouillons inconnu ou endommagé.');
  for(const [key,value] of Object.entries(d.documents))if(['__proto__','prototype','constructor'].includes(key)||!validDoc(value))throw Error('Brouillon invalide.');
  for(const v of d.recovery)if(!object(v)||typeof v.owner!=='string'||!validDoc(v))throw Error('Copie de récupération invalide.');
  return d;
}
export class StudentDrafts{
  constructor(storage,initial,legacyRaw=null){
    this.storage=storage;this.base=null;this.locked=false;this.unsaved=false;this.message='';
    this.state={version:1,active:'recovered',documents:{recovered:{code:initial,label:'Programme récupéré ou espace libre',revision:0}},recovery:[]};
    try{
      this.base=storage.getItem(DRAFT_KEY);
      if(this.base!==null){this.state=parseDrafts(this.base);this.message='Brouillon restauré localement — '+this.current.label+'. Ce navigateur uniquement.';}
      else{
        if(legacyRaw!==null){const backup=DRAFT_KEY+'.legacy';if(storage.getItem(backup)===null){storage.setItem(backup,legacyRaw);if(storage.getItem(backup)!==legacyRaw)throw Error('Copie ancienne sauvegarde non vérifiée.');}}
        this.write(this.state);
      }
    }catch(e){this.locked=true;this.unsaved=true;this.message='Brouillons non restaurés : '+e.message+' Code conservé dans cette page ; exporter avant de fermer.';}
  }
  get current(){return this.state.documents[this.state.active];}
  write(next){
    try{
      if(this.locked)throw Error('Données endommagées ou conflit : recharger après export.');
      if(this.storage.getItem(DRAFT_KEY)!==this.base){this.locked=true;throw Error('Une autre page a modifié les brouillons. Exporter ce code avant de recharger.');}
      const raw=JSON.stringify(next);parseDrafts(raw);this.storage.setItem(DRAFT_KEY,raw);
      if(this.storage.getItem(DRAFT_KEY)!==raw){this.locked=true;throw Error('Relecture différente après écriture.');}
      this.base=raw;this.unsaved=false;this.message='Sauvegardé localement — '+next.documents[next.active].label+'. Ce navigateur uniquement.';return true;
    }catch(e){this.unsaved=true;this.message='Sauvegarde indisponible : '+e.message+' Code conservé dans cette page ; exporter avant de fermer.';return false;}
  }
  edit(code){if(code!==this.current.code){this.current.code=code;this.current.revision++;}return this.write(this.state);}
  replace(owner,label,code){
    const next=structuredClone(this.state);
    // Retain both the active document and a destination that will be overwritten.
    for(const key of new Set([next.active,owner])){
      const d=next.documents[key];if(!d)continue;
      if(!next.recovery.some(v=>v.owner===key&&v.code===d.code))next.recovery.push({owner:key,...d});
    }
    if(next.recovery.length>50){this.message='Récupération pleine : aucun remplacement effectué. Exporter les brouillons.';return false;}
    next.documents[owner]={code,label,revision:(next.documents[owner]?.revision??0)+1};next.active=owner;
    if(!this.write(next))return false;this.state=next;return true;
  }
  open(owner){const d=this.state.documents[owner];return !!d&&this.replace(owner,d.label,d.code);}
}

export function mountDrafts(editor,initial,legacyRaw,blankStarter){
  let storage;try{storage=localStorage;}catch{storage={getItem(){throw Error('Stockage refusé');}};}
  const store=new StudentDrafts(storage,initial,legacyRaw);editor.value=store.current.code;
  let target={owner:'traversee/free',label:'La traversée — programmation libre',starter:blankStarter},busy=false;
  const panel=document.createElement('details');panel.id='student-drafts';
  panel.innerHTML='<summary>Mon code : brouillons et récupération</summary><p id="draft-status" role="status"></p><p id="draft-context"></p><div class="controls"><button id="draft-open" type="button">Ouvrir mon brouillon de cet exercice</button><button id="draft-copy" type="button">Utiliser ce code pour cet exercice</button><button id="draft-starter" type="button">Remplacer par l’amorce de cet exercice</button></div><label for="draft-recovery">Versions avant remplacement</label><select id="draft-recovery"></select><button id="draft-restore" type="button">Récupérer cette version</button><div class="controls"><button id="draft-export" type="button">Exporter mon code Python</button><button id="draft-export-all" type="button">Exporter tous mes brouillons</button><label>Importer un fichier Python <input id="draft-import" type="file" accept=".py,text/plain"></label></div><p id="draft-help"></p>';
  editor.parentNode.insertBefore(panel,editor);const $=id=>panel.querySelector('#'+id),status=$('draft-status');panel.before(status);
  let recoveryCount=-1;
  function update(){
    status.textContent=(store.unsaved?'Code non sauvegardé. ':'')+store.message;$('draft-context').textContent='Code actif : '+store.current.label+' · Exercice choisi : '+target.label+'. Changer d’exercice conserve le code affiché.';
    $('draft-open').disabled=busy||!Object.hasOwn(store.state.documents,target.owner);$('draft-copy').disabled=busy||store.state.active===target.owner;
    $('draft-starter').disabled=busy||typeof target.starter!=='string';$('draft-restore').disabled=busy||!store.state.recovery.length;
    $('draft-import').disabled=busy;$('draft-recovery').disabled=busy;
    const selected=$('draft-recovery').value;$('draft-recovery').replaceChildren(...store.state.recovery.map((v,i)=>new Option((i+1)+' · '+v.label+' · version '+v.revision,String(i))));
    if(store.state.recovery.length>recoveryCount)$('draft-recovery').value=String(store.state.recovery.length-1);
    else if([...$('draft-recovery').options].some(o=>o.value===selected))$('draft-recovery').value=selected;
    recoveryCount=store.state.recovery.length;
    $('draft-help').textContent=target.owner==='analyse/a2'?'Pour reprendre A1 : ouvrez A1 et son brouillon, choisissez A2, puis « Utiliser ce code pour cet exercice ». Gardez votre fonction relever_positions ; retirez vous-même son ancien appel principal avant la collecte A2, sinon le robot peut effectuer une double collecte. Aucun corrigé n’est ajouté.':'';
  }
  function apply(operation){if(busy)return false;if(!operation()){update();panel.open=true;return false;}editor.value=store.current.code;editor.setSelectionRange(0,0);editor.dispatchEvent(new Event('input',{bubbles:true}));update();return true;}
  function replace(code,label=target.label,owner=target.owner){
    if(busy)return false;
    if(code!==editor.value&&!confirm('Remplacer le code affiché ? Une copie récupérable doit être enregistrée avant le remplacement. Annuler conserve votre programme.'))return false;
    return apply(()=>store.replace(owner,label,code));
  }
  editor.addEventListener('input',()=>{store.edit(editor.value);update();});
  $('draft-open').onclick=()=>{const d=store.state.documents[target.owner];if(d)replace(d.code,d.label,target.owner);};
  $('draft-copy').onclick=()=>replace(editor.value);
  $('draft-starter').onclick=()=>replace(target.starter);
  $('draft-restore').onclick=()=>{const d=store.state.recovery[Number($('draft-recovery').value)];if(d)replace(d.code,d.label,d.owner);};
  function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('draft-export').onclick=()=>download(editor.value,'microduck-programme.py','text/plain;charset=utf-8');
  $('draft-export-all').onclick=()=>{let legacy=null;try{legacy=storage.getItem(DRAFT_KEY+'.legacy');}catch{}download(JSON.stringify({format:'microduck-student-archive',version:1,working:store.state,storedRaw:store.base,legacyRaw:legacy},null,2),'microduck-brouillons.json','application/json;charset=utf-8');};
  $('draft-import').onchange=async()=>{const file=$('draft-import').files[0],at=editor.value,context=target.owner;try{if(!file)return;if(file.size>MAX_BYTES)throw Error('Fichier trop volumineux.');const code=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(at!==editor.value||context!==target.owner)throw Error('Le code ou le contexte a changé pendant la lecture. Recommencer l’import.');replace(code);}catch(e){store.message='Import refusé : '+e.message;update();}finally{$('draft-import').value='';}};
  addEventListener('storage',e=>{if(e.key===DRAFT_KEY&&e.newValue!==store.base){store.locked=true;store.message='Conflit : une autre page a modifié les brouillons. Ce code reste en mémoire ; exporter avant de recharger.';update();}});
  addEventListener('lab-busy',e=>{busy=e.detail;update();});
  addEventListener('beforeunload',e=>{if(store.current.code!==editor.value||store.unsaved||store.locked){e.preventDefault();e.returnValue='';}});
  const erase=document.getElementById('erase');erase.textContent='Remplacer mon code par une amorce';
  erase.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();replace(typeof target.starter==='string'?target.starter:blankStarter);},true);
  update();
  return {context(owner,label,starter){target={owner,label,starter};update();},store};
}
