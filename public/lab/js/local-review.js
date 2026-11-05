import {ReviewStore,PILOTS,sha256,canonical,verifyLedger,ARCHIVE_LIMIT} from './review-store.js';
import {ReviewContext,reviewCriteria} from './review-context.js';
import {currentResult} from './execution-context.js';
import {plainProse,renderProse,diagnosticProse} from './python-prose.js';

export function mountLocalReview(){
 const $=id=>document.getElementById(id),store=new ReviewStore(),contexts=new ReviewContext();
 let state=null,storageError='',activity=null,activityId='',missionId='',fingerprint=null,codeHash=null,matching=null,proofs=new Map(),lastAssessment=null,busy=false,running=false,generation=0;
 let presented=null,presentedRevision=null,pendingArchive=null,invalidatedByEdit=false;
 const heading=$('learning-title'),oldHeading=heading.textContent;
 const panel=document.createElement('section');panel.id='local-review';panel.hidden=true;panel.setAttribute('aria-labelledby','review-heading');
 panel.innerHTML='<h3 id="review-heading">Mon travail et l’avis enseignant</h3><p id="review-status"></p><p id="review-message" role="status"></p><div class="controls"><button id="review-adopt" type="button">Utiliser une copie pour cet exercice</button><button id="review-submit" type="button" hidden>Soumettre mon programme</button><button id="review-present" type="button" hidden>Présenter mon travail</button><button id="review-help" type="button" aria-expanded="false">Demander de l’aide</button></div><p id="review-help-text" hidden>Montre ton écran à l’enseignant, même si les essais ne réussissent pas encore. Cette demande ne soumet aucun programme.</p><details id="review-history"><summary>Dossiers et sauvegarde sur ce poste</summary><label for="review-versions">Versions soumises de cette activité</label><select id="review-versions"></select><button id="review-open-version" type="button">Examiner cette version</button><p>Ces dossiers restent dans ce navigateur. Exportez-les avant d’effacer ses données ou de changer de poste. Un export local ne certifie aucune identité.</p><div class="controls"><button id="review-export" type="button">Exporter les dossiers</button><button id="review-refresh" type="button">Actualiser les dossiers</button><label>Ouvrir une sauvegarde de dossiers <input id="review-import" type="file" accept=".json,application/json"></label></div><p id="review-import-info"></p><button id="review-restore" type="button" hidden>Restaurer ces dossiers</button></details>';
 $('console-verdict').after(panel);
 const dialog=document.createElement('dialog');dialog.id='review-dialog';dialog.setAttribute('aria-labelledby','review-dialog-title');
 dialog.innerHTML='<div class="review-dialog-top"><h2 id="review-dialog-title">Examen accompagné</h2><button id="review-close" type="button">Fermer</button></div><p>Avis enregistré sur ce poste — identité non authentifiée.</p><h3 id="review-activity-title"></h3><p id="review-version-info"></p><p id="review-current-match"></p><h3>Programme soumis — lecture seule</h3><pre tabindex="0"><code id="review-code"></code></pre><h3>Exigences à examiner</h3><ul id="review-criteria"></ul><details><summary>Contraintes, amorce et contexte de cette version</summary><pre id="review-contract"></pre><pre id="review-starter"></pre><p id="review-context-info"></p></details><h3>Essais réellement exécutés</h3><ol id="review-trials"></ol><h3>Explication soumise par l’élève</h3><p id="review-explanation"></p><h3>Avis pédagogique</h3><p id="review-existing-decision"></p><label for="review-note">Observation courte (facultative)</label><textarea id="review-note" maxlength="1000" rows="2"></textarea><div class="controls"><button id="review-approve" type="button">Valider cette version</button><button id="review-correct" type="button">Demander une correction</button><button id="review-dialog-refresh" type="button">Actualiser le dossier</button></div><p id="review-decision-message" role="status"></p><details><summary>Historique de cette activité</summary><ul id="review-decision-history"></ul></details>';
 document.body.append(dialog);
 const date=value=>new Date(value).toLocaleString('fr-FR');
 const decision=r=>state?.decisions.find(d=>d.submissionId===r?.id);
 const rows=()=>state?.submissions.filter(r=>r.activityId===activityId).sort((a,b)=>b.number-a.number)||[];
 const notice=text=>{$('review-message').textContent=text;};
 const explanationState=()=>window.labNotes?.snapshot();
 const explanationReady=s=>!!s?.ready&&s.sequenceId+'/'+s.activityId===activityId;
 function publish(){dispatchEvent(new CustomEvent('lab-review-state',{detail:matching?{current:true,verdict:decision(matching)?.verdict||null,date:decision(matching)?.decidedAt}:null}));}
 function reset(){proofs.clear();lastAssessment=null;matching=null;codeHash=null;fingerprint=null;invalidatedByEdit=false;publish();notice('');}
 function trialBlocker(){
  if(!activity)return 'Choisis un exercice avant de soumettre.';
  if(running)return 'Essais en cours : attends leur fin avant de soumettre.';
  if(invalidatedByEdit)return 'Code modifié : refais les essais avec cette nouvelle version.';
  const ids=Object.keys(activity.cases),label=id=>'« '+(fingerprint?.context.terrains[id]?.name||proofs.get(id)?.terrain?.name||id)+' »';
  for(const id of ids){const p=proofs.get(id);if(!p||p.pending)continue;
   if(p.code!==$('code').value)return 'Code modifié : refais les essais avec cette nouvelle version.';
   if(p.result?.kind!=='ok')return 'L’exécution n’a pas abouti sur '+label(id)+' : corrige la cause affichée et réessaie.';
   if(!p.assessment?.applicable)return 'Terrain hors des critères de cet exercice : prépare le terrain demandé.';
   if(!p.assessment.pass)return 'Résultat incorrect sur '+label(id)+' : corrige le programme et réessaie.';
   if(p.diagnostic?.status==='FAIL')return 'Contraintes Python à corriger sur '+label(id)+' : consulte les vérifications.';
  }
  const missing=ids.filter(id=>!proofs.has(id));if(missing.length)return 'Terrains encore à essayer avec ce code : '+missing.map(label).join(', ')+'.';
  const pending=ids.filter(id=>proofs.get(id).pending||!proofs.get(id).diagnostic);if(pending.length)return 'Analyse encore attendue pour '+pending.map(label).join(', ')+'.';
  if(!lastAssessment||!currentResult(lastAssessment))return 'Le contexte a changé : exécute à nouveau le code sur le terrain choisi.';
  return null;
 }
 function admissible(){return trialBlocker()===null;}
 async function refresh(){
  const ticket=++generation,pilot=PILOTS.has(activityId);panel.hidden=!pilot;heading.textContent=pilot?'Apprentissage : critères et avis pédagogique':oldHeading;
  if(!pilot){matching=null;publish();return;}
  $('review-submit').hidden=true;$('review-adopt').hidden=true;$('review-present').hidden=true;
  if(!state||storageError){$('review-status').textContent=storageError?'Dossiers indisponibles : '+storageError:'Chargement des dossiers…';publish();return;}
  const code=$('code').value;
  try{
   const [context,hash]=await Promise.all([contexts.forActivity(missionId,activity),sha256(code)]);if(ticket!==generation)return;
   fingerprint=context;codeHash=hash;
   const owner=window.labDrafts?.store.state.active,work=state.works[activityId];
   matching=rows().find(r=>r.workId===work?.id&&r.codeHash===hash&&r.contextHash===context.hash&&owner===activityId)||null;
   const history=rows(),recent=history[0],d=decision(matching);
   let status;
   if(matching)status=d?(d.verdict==='favorable'?'Avis favorable pour cette version':'Correction demandée')+' — '+date(d.decidedAt)+'.':'Programme soumis — en attente de l’enseignant';
   else if(recent)status=recent.codeHash===hash?'Un dossier antérieur existe ; le travail ou son contexte diffère.':'Programme modifié depuis la version '+recent.number+' ; l’ancien avis reste dans l’historique.';
   else status=trialBlocker()||(owner!==activityId||window.labDrafts?.store.unsaved||window.labDrafts?.store.locked?'Essais conformes pour ce code.':activity.id==='s1'?'Critères automatiques satisfaits : tu peux poursuivre. L’examen accompagné est facultatif.':'Essais admissibles : tu peux soumettre ton programme.');
   if(recent&&!matching&&trialBlocker())status+=' '+trialBlocker();
   if(owner!==activityId){status+=' Ce code appartient à un autre brouillon : utilise une copie pour cet exercice.';$('review-adopt').hidden=false;}
   if(window.labDrafts?.store.unsaved||window.labDrafts?.store.locked)status+=' Le brouillon n’est pas sauvegardé : exporte ton code avant de fermer.';
   $('review-status').textContent=status;
   $('review-submit').textContent=activity.id==='s1'?'Demander un examen accompagné':'Soumettre mon programme';
    const explanation=explanationState();
    const revisedExplanation=d?.verdict==='correction'&&explanationReady(explanation)&&explanation.text!==matching.explanation;
   $('review-submit').hidden=(!!matching&&!revisedExplanation)||owner!==activityId||!admissible()||window.labDrafts?.store.unsaved||window.labDrafts?.store.locked;
    $('review-submit').disabled=busy||!explanationReady(explanation);
    if(!explanationReady(explanation))$('review-status').textContent+=' Attends le chargement de l’explication de cette activité avant de soumettre.';
   const selected=$('review-versions').value;$('review-versions').replaceChildren(...history.map(r=>new Option('Version '+r.number+' · '+date(r.submittedAt)+' · '+(decision(r)?.verdict==='favorable'?'Avis favorable':decision(r)?'Correction demandée':'En attente'),r.id)));
   if(history.some(r=>r.id===selected))$('review-versions').value=selected;
   $('review-open-version').disabled=!history.length||busy;$('review-versions').disabled=!history.length;
   $('review-present').hidden=!history.length;$('review-present').disabled=busy;
   $('review-export').disabled=busy;$('review-import').disabled=busy;$('review-adopt').disabled=busy||running;
   publish();
  }catch(e){if(ticket===generation){matching=null;publish();$('review-status').textContent='Soumission indisponible : '+e.message;}}
 }
 async function reload(){try{const loaded=await store.read();if(!state||loaded.revision>=state.revision)state=loaded;storageError='';}catch(e){state=null;storageError=e.message;}await refresh();}
 function changed(){const hadTrials=invalidatedByEdit||proofs.size>0;generation++;matching=null;publish();$('review-status').textContent='Programme modifié ; les anciens dossiers sont conservés.';reset();invalidatedByEdit=hadTrials;refresh();}
 function select(detail){reset();missionId=detail.missionId;activity=detail.activity;activityId=activity?missionId+'/'+activity.id:'';refresh();}
 addEventListener('lab-exercise',e=>select(e.detail));
 $('code').addEventListener('input',changed);
 addEventListener('lab-notes-state',()=>refresh());
 addEventListener('lab-busy',e=>{running=!!e.detail;refresh();});
 addEventListener('lab-terrain',()=>{lastAssessment=null;refresh();});
 addEventListener('lab-interrupted',()=>{lastAssessment=null;refresh();});
 document.addEventListener('click',e=>{if(e.target.id==='pilot-start'){reset();refresh();}});
 addEventListener('lab-run-start',e=>{if(!PILOTS.has(activityId)||!currentResult(e.detail))return;invalidatedByEdit=false;lastAssessment=null;proofs.set(e.detail.terrainId,{pending:true});refresh();});
 addEventListener('lab-assessment',e=>{
  const d=e.detail;if(!PILOTS.has(activityId)||!currentResult(d))return;
  proofs.set(d.terrainId,{code:d.code,runId:d.runId,revision:d.revision,terrainId:d.terrainId,terrain:structuredClone(window.labStudy.snapshot().world),finishedAt:new Date().toISOString(),result:structuredClone(d.result),assessment:structuredClone(d.assessment),diagnostic:structuredClone(d.diagnostic)});lastAssessment=d;refresh();
 });
 $('review-adopt').onclick=()=>{$('draft-copy').click();};
 $('review-help').onclick=()=>{const show=$('review-help-text').hidden;$('review-help-text').hidden=!show;$('review-help').setAttribute('aria-expanded',String(show));};
 async function operation(fn){if(busy)return;busy=true;await refresh();try{await fn();}catch(e){notice('Enregistrement non confirmé : '+e.message);if(dialog.open)$('review-decision-message').textContent='Enregistrement non confirmé : '+e.message;}finally{busy=false;await refresh();}}
 $('review-submit').onclick=()=>operation(async()=>{
  if(!admissible()||!fingerprint||!state||window.labDrafts.store.state.active!==activityId||window.labDrafts.store.unsaved||window.labDrafts.store.locked)throw Error('Code ou essais à actualiser.');
   const explanationSnapshot=explanationState();
   if(!explanationReady(explanationSnapshot))throw Error('Attends le chargement de l’explication de cette activité.');
   const source=$('code').value,selectedId=activityId,revision=state.revision,context=fingerprint,hash=codeHash,explanation=explanationSnapshot.text,provenance={owner:window.labDrafts.store.state.active,revision:window.labDrafts.store.current.revision};
  const captured=structuredClone([...proofs.values()].filter(p=>Object.hasOwn(activity.cases,p.terrainId)));
  await contexts.verify();
  const evidence=await Promise.all(captured.map(async p=>{const {code,...rest}=p;if(code!==source)throw Error('Une preuve concerne un autre code.');return {...rest,codeHash:hash,terrainHash:await sha256(canonical(p.terrain))};}));
  if(source!==$('code').value||selectedId!==activityId||!admissible()||context.hash!==fingerprint?.hash)throw Error('Le code ou les essais ont changé pendant la préparation. Recommence.');
   if(!window.labNotes.matches(explanationSnapshot))throw Error('L’explication ou son activité a changé pendant la préparation. Recommence.');
  const saved=await store.submit({activityId:selectedId,title:plainProse(activity.title),code:source,codeHash:hash,submittedAt:new Date().toISOString(),explanation,provenance,context:context.context,contextHash:context.hash,proofs:evidence},revision);
  state=saved.state;notice('Programme soumis — en attente de l’enseignant');signal();
 });
 function showRecord(record){
  if(!record)return;presented=record;presentedRevision=state.revision;
  $('review-activity-title').textContent=record.title;$('review-version-info').textContent='Version '+record.number+' · soumise le '+date(record.submittedAt);
  $('review-current-match').textContent=matching?.id===record.id?'Ce dossier correspond au programme courant.':'Ce dossier concerne une version ou un contexte antérieur ; il ne valide pas le programme courant.';
  $('review-code').textContent=record.code;$('review-criteria').replaceChildren(...record.context.criteria.map(text=>{const li=document.createElement('li');renderProse(li,text);return li;}));
  $('review-contract').textContent=JSON.stringify(record.context.contract,null,2);$('review-starter').textContent=record.context.starter;$('review-context-info').textContent='Empreinte du code : '+record.codeHash+'\nContexte : '+record.contextHash+'\nLes espaces des sorties sont normalisés par les contrôles existants. Les constructions repérées ne prouvent pas leur pertinence.';
  $('review-trials').replaceChildren(...record.proofs.map(p=>{
   const li=document.createElement('li'),h=document.createElement('h4'),result=document.createElement('p'),output=document.createElement('pre'),analysis=document.createElement('p'),details=document.createElement('details'),summary=document.createElement('summary'),raw=document.createElement('pre');
   h.textContent=p.terrain.name;result.textContent='Python sans erreur · comportement conforme · '+p.result.actions+' action(s) · '+date(p.finishedAt);output.textContent=p.result.output||'(aucun affichage demandé)';
   renderProse(analysis,(p.diagnostic.status==='PASS'?'Contraintes automatiques satisfaites.':p.diagnostic.observed?.length?'Constructions repérées ; utilisation à examiner.':'Analyse indisponible ou non concluante ; examen manuel nécessaire.')+' '+(p.diagnostic.reasons||[]).map(reason=>diagnosticProse(reason,{verbatim:true})).join(' '));
   summary.textContent='Terrain, trace et détails du contrôle';raw.textContent=JSON.stringify(p,null,2);details.append(summary,raw);li.append(h,result,output,analysis,details);return li;
  }));
  $('review-explanation').textContent=record.explanation||'Aucune explication écrite ; échange oral possible.';
  const d=decision(record);$('review-existing-decision').textContent=d?(d.verdict==='favorable'?'Avis favorable pour cette version':'Correction demandée')+' — '+date(d.decidedAt)+(d.note?' · '+d.note:''):'Aucun avis enregistré.';
  $('review-note').value=d?.note||'';$('review-note').disabled=!!d;
  for(const id of ['review-approve','review-correct'])$(id).disabled=!!d||busy;
  $('review-decision-message').textContent='';
  $('review-decision-history').replaceChildren(...rows().map(r=>{const li=document.createElement('li'),d=decision(r),b=document.createElement('button');b.type='button';b.textContent='Version '+r.number+' — '+(d?(d.verdict==='favorable'?'Avis favorable':'Correction demandée')+' · '+date(d.decidedAt)+(d.note?' · '+d.note:''):'En attente');b.onclick=()=>showRecord(r);li.append(b);return li;}));
  if(!dialog.open)dialog.showModal();
 }
 $('review-present').onclick=()=>showRecord(matching||rows()[0]);$('review-open-version').onclick=()=>showRecord(state.submissions.find(r=>r.id===$('review-versions').value));$('review-close').onclick=()=>dialog.close();
 for(const [id,verdict]of [['review-approve','favorable'],['review-correct','correction']])$(id).onclick=()=>{
  const record=presented,revision=presentedRevision,note=$('review-note').value;
  if(!record||busy)return;
  for(const button of ['review-approve','review-correct'])$(button).disabled=true;
  operation(async()=>{const saved=await store.decide(record.id,verdict,note,revision);state=saved.state;showRecord(record);$('review-decision-message').textContent='Avis enregistré le '+date(saved.result.decidedAt)+'.';notice('Avis enregistré pour la version '+record.number+'.');signal();}).then(()=>{if(!decision(record))for(const button of ['review-approve','review-correct'])$(button).disabled=false;});
 };
 $('review-dialog-refresh').onclick=async()=>{const id=presented?.id;await reload();if(state)showRecord(state.submissions.find(r=>r.id===id));};
 $('review-refresh').onclick=reload;
 $('review-export').onclick=()=>operation(async()=>{const text=await store.export(),url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='microduck-dossiers-locaux.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Export demandé : vérifie le fichier téléchargé.');});
 $('review-import').onchange=async()=>{
  pendingArchive=null;$('review-restore').hidden=true;
  try{const file=$('review-import').files[0];if(!file)return;if(file.size>ARCHIVE_LIMIT*2)throw Error('Archive trop volumineuse.');const text=await file.text(),data=JSON.parse(text);if(data.format!=='microduck-local-reviews'||data.version!==1)throw Error('Archive de dossiers inconnue.');await verifyLedger(data.state);pendingArchive=text;$('review-import-info').textContent=data.state.submissions.length+' dossier(s), '+data.state.decisions.length+' avis. Archive locale non authentifiée ; restauration par ajout, sans remplacer le code ni les dossiers existants.';$('review-restore').hidden=false;}catch(e){notice('Archive refusée : '+e.message);}finally{$('review-import').value='';}
 };
 $('review-restore').onclick=()=>operation(async()=>{if(!pendingArchive||!state)throw Error('Ouvre et contrôle une sauvegarde.');const result=await store.restore(pendingArchive,state.revision);state=result.state;pendingArchive=null;$('review-restore').hidden=true;$('review-import-info').textContent='Dossiers restaurés et relus. Aucun code remplacé.';signal();});
 let channel;try{channel=new BroadcastChannel('microduck-local-reviews');channel.onmessage=()=>reload();}catch{}
 function signal(){channel?.postMessage('changed');}
 addEventListener('focus',()=>reload());addEventListener('visibilitychange',()=>{if(!document.hidden)reload();});
 reload();
}
