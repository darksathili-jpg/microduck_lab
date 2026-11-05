import {renderProse} from './python-prose.js';
import {mountAtelier} from './atelier-layout.js';
import {mountExecutionFeedback} from './execution-feedback.js';
import {Runtime,FIRST_OCCURRENCE_POLICY} from './runtime-client.js';
import {RenderController} from './render-controller.js';
import {restore,STORAGE_KEY} from './storage.js';
import {attachPythonEditor} from './python-editor.js';
import {catalog,learningTargets,PATH_KEY,restorePath} from './pathway.js';
import {metadata} from '../pedagogy/registry.js';
import {mountDrafts} from './student-drafts.js';
import {isProjectedTransfer} from './activity-experience.js';
const $=id=>document.getElementById(id);
mountExecutionFeedback();
mountAtelier();
const key=STORAGE_KEY;
let restored;try{restored=restore(localStorage);}catch{restored={saved:{},warning:'Sauvegarde locale inaccessible.'};}
let saved=restored.saved;$('storage-status').textContent=restored.warning;
let mission=await fetch(new URL('../missions/traversee.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Mission indisponible');return r.json();});
let path;try{path=restorePath(localStorage);}catch{path={state:{version:1,active:'traversee',stages:{},behavior:{}},warning:'Parcours local inaccessible.'};}
$('path-status').textContent=path.warning||'Code et résultats enregistrés sur ce navigateur seulement ; aucune compétence certifiée.';
let legacyStage=saved.stage||'depart',missionLoad=0,missionAbort;
function pathStatus(){const passed=mission.stages.filter(s=>path.state.behavior[mission.id]?.[s.id]).length;$('path-status').textContent=(path.warning?path.warning+' ':'')+`Historique local : ${passed}/${mission.stages.length} étapes ont eu un lot réussi. Ce n’est ni une validation du code actuel, ni une compétence certifiée, ni un suivi centralisé.`;}
let stage,terrain,epoch=0,codeRevision=0,busy=false,hintCount=0,assessmentTerrain=null;
let presentationExercise=null;
const originalLegacyCriteria=[...$('legacy-criteria').children].map(node=>node.cloneNode(true));
const projectedTransfer=()=>presentationExercise?.missionId===mission.id&&isProjectedTransfer(presentationExercise.activity,mission.id);
function stagePresentation(){
 const projected=projectedTransfer();
 renderProse($('mission-description'),projected?'Réutilise et justifie une stratégie sur un terrain de transfert encore inconnu. Les données de ce terrain seront visibles après sa révélation.':catalog.find(c=>c.id===mission.id).description);
 renderProse($('objective'),projected?'Transfert : prévoir, réutiliser le programme puis expliquer sa pertinence sur le terrain révélé.':stage.objective);
 $('hints').replaceChildren();hintCount=0;$('hint').disabled=projected;
 if(projected){const li=document.createElement('li');li.textContent='Les indices d’entraînement ne sont pas proposés pendant ce transfert. Consulte les aides de l’activité ; l’enseignant décide de l’aide adaptée.';$('hints').append(li);}
 $('legacy-criteria').replaceChildren(...(projected?[]:originalLegacyCriteria.map(node=>node.cloneNode(true))));
 $('sequence-criteria').replaceChildren(...(projected?['Prévoir le résultat avant l’essai ; expliquer ensuite les écarts, les hypothèses et les limites de la stratégie.']:(learningTargets[mission.id]||[])).map(text=>{const li=document.createElement('li');renderProse(li,text);return li;}));
}
addEventListener('lab-exercise',e=>{const wasProjected=projectedTransfer();presentationExercise=e.detail;if(wasProjected||projectedTransfer())stagePresentation();});
$('code').addEventListener('input',()=>{codeRevision++;});
addEventListener('lab-exercise',()=>{epoch++;});
const view=new RenderController();
let executions=0,lastResult=null;const pythonStarted=performance.now();let pythonReadyMs;
window.labStudy={snapshot:()=>({...view.snapshot(),executions,lastResult,pythonReadyMs,runId:epoch,codeRevision,mission:mission.id,stage:stage?.id,world:terrain}),benchmark:()=>view.renderer?.benchmark()};
const runtime=new Runtime(s=>{$('runtime').textContent=s;if(s.includes('prêt')&&pythonReadyMs===undefined)pythonReadyMs=performance.now()-pythonStarted;});
const starter='# Prévois le trajet, puis écris ton programme.\n# Exemple de commande : duck.avancer()\n';
$('code').value=saved.code??starter;$('prediction').value=saved.prediction??'';
let legacyRaw;try{legacyRaw=localStorage.getItem(key);}catch{legacyRaw=null;}
window.labDrafts=mountDrafts($('code'),$('code').value,legacyRaw,starter);
attachPythonEditor($('code'));
$('theme').value=['light','dark','projector'].includes(saved.theme)?saved.theme:'light';
document.documentElement.dataset.theme=$('theme').value;
function persist(){if(mission.id==='traversee')legacyStage=stage.id;try{localStorage.setItem(key,JSON.stringify({version:2,code:saved.code??starter,prediction:$('prediction').value,theme:$('theme').value,stage:legacyStage,progress:saved.progress||{}}));}catch{$('storage-status').textContent='Préférences non sauvegardées ; consulter aussi l’état du brouillon Python.';}path.state.active=mission.id;path.state.stages[mission.id]=stage.id;try{localStorage.setItem(PATH_KEY,JSON.stringify(path.state));}catch{$('path-status').textContent='Parcours non sauvegardé ; le laboratoire reste utilisable.';}}
for(const s of mission.stages){const o=new Option(s.title,s.id);$('stage').add(o);}
function setStage(id){assessmentTerrain=null;stage=mission.stages.find(s=>s.id===id)||mission.stages[0];$('transfer').hidden=!(mission.id==='traversee'?stage.id==='capteurs':stage.allowTransfer);$('stage').value=stage.id;stagePresentation();$('terrain').replaceChildren(...stage.terrains.map(t=>new Option(t.name,t.id)));setTerrain();persist();pathStatus();}
function testScope(){
  const count=stage.terrains.length+Number(!!assessmentTerrain);
  $('test').textContent=`Tester les ${count} terrains révélés`;
  $('test-scope').textContent=`Périmètre du lot : ${stage.terrains.length} terrains d’entraînement${assessmentTerrain?' et 1 situation de transfert révélée':'. Le transfert non révélé est exclu'}. Tests de comportement uniquement ; les compétences restent à valider par l’enseignant.`;
}
function setTerrain(){terrain=$('terrain').value===assessmentTerrain?.id?assessmentTerrain:stage.terrains.find(t=>t.id===$('terrain').value)||stage.terrains[0];view.terrain(terrain);$('results').replaceChildren();$('batch-feedback').textContent='';$('console').textContent='Monde réinitialisé. Le programme est conservé.';testScope();dispatchEvent(new CustomEvent('lab-terrain',{detail:terrain}));}
function lock(value){busy=value;view.setBusy(value);for(const id of ['run','test','stage','terrain','reset','transfer','mission','next-mission'])$(id).disabled=value;$('next-mission').disabled=value||mission.id===catalog.at(-1).id;$('stop').disabled=!value;dispatchEvent(new CustomEvent('lab-busy',{detail:value}));}
const labels={syntax:'Erreur de syntaxe Python',exception:'Exception pendant l’exécution',actions:'Nombre maximal d’actions dépassé',interrupted:'Interruption volontaire',timeout:'Temps d’exécution dépassé',network:'Python indisponible'};
function stationaryAssessment(t,r){
  const id=$('pilot-choice')?.value;if(!id)return null;
  const {activity,assess}=metadata(mission.id,id),expected=activity.cases[t.id];
  // Only an explicit zero-action contract makes arrival irrelevant here.
  return expected?.actions===0&&!expected.goal?assess(activity,t.id,r):null;
}
function describe(r,stationary=null){
  if(r.kind!=='ok')return labels[r.kind]||r.kind;
  if(stationary?.applicable)return `Python exécuté sans erreur. Exercice : comportement attendu ${stationary.pass?'observé':'non observé'}. Arrivée à l’étoile non requise pour cet exercice. Contraintes Python et explication : voir Résultats distincts.`;
  const id=$('pilot-choice')?.value;
  if((mission.id==='traversee'&&id==='s2')||(mission.id==='analyse'&&['a1','a2'].includes(id)))return `Python exécuté sans erreur. État du terrain : étoile ${r.success?'atteinte':'non atteinte'}. `+(id==='a2'?'Ce bilan robotique concerne la phase 2 ; pour la phase 1, comparer les retours aux exemples. ':'')+'Consulter aussi les résultats de l’exercice et les contraintes de programmation.';
  return r.success?'Objectif atteint, sans collision.':'Python exécuté : objectif non atteint.';
}
async function execute(all){
  if(busy)return;const token=++epoch;const code=$('code').value,revision=codeRevision,exerciseId=$('pilot-choice')?.value||'';const terrains=all?[...stage.terrains,...(assessmentTerrain?[assessmentTerrain]:[])]:[terrain];lock(true);$('results').replaceChildren();$('batch-feedback').textContent='';$('console').textContent='Exécution Python…';let passed=true;
  try{
    for(const t of terrains){
      if(token!==epoch)break;
      const checkOptions=mission.id==='analyse'&&exerciseId==='a2'&&Object.hasOwn(metadata(mission.id,exerciseId).activity.cases,t.id)?{functionCheck:FIRST_OCCURRENCE_POLICY}:undefined;
      terrain=t;$('terrain').value=t.id;view.terrain(t);const executionContext={missionId:mission.id,terrainId:t.id,code,revision,runId:token,exerciseId};dispatchEvent(new CustomEvent('lab-run-start',{detail:executionContext}));executions++;const r=await runtime.run(code,t,checkOptions);lastResult={kind:r.kind,success:r.success,actions:r.actions};if(token!==epoch)break;
      const stationary=stationaryAssessment(t,r);
      $('console').textContent=`${r.output||''}${r.error||''}`;
      dispatchEvent(new CustomEvent('lab-python-result',{detail:{...executionContext,result:r}}));
      await view.playTrace(r.trace||[],{animate:!all});
      if(token!==epoch)break;
      const completed={...executionContext,result:r};
      dispatchEvent(new CustomEvent('lab-result',{detail:completed}));
      // The optional guide registers this promise synchronously. Its assessment
      // must still refer to the current terrain when the batch advances.
      if(all&&completed.analysisReady)await completed.analysisReady;
      if(token!==epoch)break;
      const li=document.createElement('li');li.textContent=`${(stationary?.applicable?stationary.pass:r.success)?'✓':'✗'} ${t.name} : ${describe(r,stationary)}${r.actions!==undefined?` (${r.actions} actions)` : ''}`;li.dataset.kind=r.kind;$('results').append(li);passed&&=r.success;
      if(['timeout','interrupted','network'].includes(r.kind))break;
    }
    if(all&&token===epoch){
      if(passed){if(mission.id==='traversee'){saved.progress||={};saved.progress[stage.id]=true;}path.state.behavior[mission.id]||={};path.state.behavior[mission.id][stage.id]=true;persist();pathStatus();}
      const tested=$('results').children.length;
      $('batch-feedback').textContent=`Lot : ${terrains.length} terrains révélés (${stage.terrains.length} entraînement${assessmentTerrain?', 1 transfert':''}) ; effectivement testés : ${tested}/${terrains.length}. Contrôle d’arrivée aux étoiles : ${passed&&tested===terrains.length?'toutes les arrivées sont réussies.':'lot incomplet ou au moins une étoile non atteinte.'} Ce bilan de terrain est distinct des critères de l’exercice, qui peut ne demander aucun déplacement : consulter Résultats distincts. Les compétences et le raisonnement restent à valider par l’enseignant.`;
    }
  }catch(e){if(token===epoch){$('console').textContent=`Incident d’interface : ${e.message}`;dispatchEvent(new Event('lab-interrupted'));}}
  finally{if(token===epoch)lock(false);}
}
$('run').onclick=()=>execute(false);$('test').onclick=()=>execute(true);
$('stop').onclick=()=>{view.cancel();if(!busy)return;epoch++;missionLoad++;missionAbort?.abort();runtime.cancel();lock(false);dispatchEvent(new Event('lab-interrupted'));$('console').textContent='Interruption volontaire. Worker détruit ; Python redémarre. Aucune réussite attribuée.';};
$('reset').onclick=()=>{epoch++;setTerrain();};
$('stage').onchange=()=>{epoch++;setStage($('stage').value);};$('terrain').onchange=()=>{epoch++;setTerrain();};
$('theme').onchange=()=>{document.documentElement.dataset.theme=$('theme').value;persist();};
$('transfer').onclick=async()=>{
  if(busy)return;lock(true);const token=++epoch;
  try{const r=await fetch(new URL('../missions/'+catalog.find(c=>c.id===mission.id).transfer,import.meta.url));if(!r.ok)throw Error('Situation indisponible');const t=await r.json();if(token!==epoch)return;
    assessmentTerrain=t;if(![...$('terrain').options].some(o=>o.value===t.id))$('terrain').add(new Option(t.name,t.id));$('terrain').value=t.id;setTerrain();
    $('console').textContent='Évaluation de transfert ouverte. Prévois le capteur au départ, le nombre de pas et la condition d’arrêt avant de lancer ton programme. L’enseignant évalue ton explication.';
  }catch(e){if(token===epoch)$('console').textContent='Transfert non chargé : '+e.message;}
  finally{if(token===epoch)lock(false);}
};
$('code').oninput=persist;$('prediction').oninput=persist;
$('hint').onclick=()=>{if(projectedTransfer())return;const li=document.createElement('li');renderProse(li,stage.hints[hintCount++]);$('hints').append(li);$('hint').disabled=hintCount===3;};
$('erase').onclick=()=>{try{localStorage.removeItem(key);localStorage.removeItem(key+'.recovery');}catch{}saved={};$('code').value=starter;$('prediction').value='';$('storage-status').textContent='';$('console').textContent='Sauvegarde locale et copie de récupération effacées.';};
for(const c of catalog)$('mission').add(new Option(c.title,c.id));
const desired=new URL(location.href).searchParams.get('mission')||path.state.active;
setStage(saved.stage);
async function switchMission(id){
 if(!catalog.some(c=>c.id===id))return;
 const token=++missionLoad;++epoch;view.cancel();lock(true);missionAbort?.abort();const abort=missionAbort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
 try{const item=catalog.find(c=>c.id===id),r=await fetch(new URL('../missions/'+item.file,import.meta.url),{signal:abort.signal});if(!r.ok)throw Error('Fichier indisponible');const data=await r.json();if(token!==missionLoad)return;if(data.id!==id||!Array.isArray(data.stages)||!data.stages.length)throw Error('Mission invalide');
  mission=data;$('mission').value=id;$('stage').replaceChildren(...mission.stages.map(s=>new Option(s.title,s.id)));
  $('mission-title').textContent=mission.title||'Quelques lignes. Un vrai déplacement.';$('mission-kicker').textContent=item.title;renderProse($('mission-description'),item.description);
  $('legacy-criteria').hidden=id!=='traversee';$('sequence-criteria').hidden=id==='traversee';$('sequence-criteria').replaceChildren(...(learningTargets[id]||[]).map(text=>{const li=document.createElement('li');renderProse(li,text);return li;}));
  setStage(id==='traversee'?legacyStage:path.state.stages[id]);const url=new URL(location.href);url.searchParams.set('mission',id);history.replaceState(null,'',url);
  dispatchEvent(new CustomEvent('lab-mission',{detail:id}));
 }catch(e){if(token===missionLoad){$('mission').value=mission.id;$('console').textContent='Séquence non chargée : '+e.message+'. Le code et la séquence précédente sont conservés.';}}
 finally{clearTimeout(timer);if(token===missionLoad)lock(false);}
}
$('mission').onchange=()=>switchMission($('mission').value);
$('next-mission').onclick=()=>{const next=catalog[catalog.findIndex(c=>c.id===mission.id)+1];if(next)switchMission(next.id);};
$('erase').addEventListener('click',()=>{try{localStorage.removeItem(PATH_KEY);localStorage.removeItem(PATH_KEY+'.recovery');}catch{}path.state={version:1,active:mission.id,stages:{},behavior:{}};$('path-status').textContent='Parcours local effacé ; aucune donnée centralisée n’existe.';});
if(desired!=='traversee'&&catalog.some(c=>c.id===desired))await switchMission(desired);
// Optional teaching layer: failure must never prevent Python or the renderers.
import('./pilot-guide.js').then(async({mount})=>{await mount(mission.id);import('./local-review.js').then(({mountLocalReview})=>mountLocalReview()).catch(()=>{const p=document.createElement('p');p.textContent='Avis locaux indisponibles ; le code et Python restent utilisables.';$('console-verdict').after(p);});}).catch(()=>{$('pilot').textContent='Atelier guidé indisponible ; le laboratoire Python reste utilisable.';});
