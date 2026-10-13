import {Runtime} from './runtime-client.js';
import {View} from './simulator-view.js';
const $=id=>document.getElementById(id);
const key='microduck.lab.jalon1.v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
const mission=await fetch(new URL('../missions/traversee.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Mission indisponible');return r.json();});
let stage,terrain,epoch=0,busy=false,hintCount=0;
const view=new View($('grid'),$('position'));
const runtime=new Runtime(s=>$('runtime').textContent=s);
const starter='# Prévois le trajet, puis écris ton programme.\n# Exemple de commande : duck.avancer()\n';
$('code').value=saved.code??starter;$('prediction').value=saved.prediction??'';
$('theme').value=['light','dark','projector'].includes(saved.theme)?saved.theme:'light';
document.documentElement.dataset.theme=$('theme').value;
function persist(){try{localStorage.setItem(key,JSON.stringify({code:$('code').value,prediction:$('prediction').value,theme:$('theme').value,stage:stage.id,progress:saved.progress||{}}));}catch{$('runtime').textContent='Sauvegarde locale indisponible';}}
for(const s of mission.stages){const o=new Option(s.title,s.id);$('stage').add(o);}
function setStage(id){stage=mission.stages.find(s=>s.id===id)||mission.stages[0];$('stage').value=stage.id;$('objective').textContent=stage.objective;$('terrain').replaceChildren(...stage.terrains.map(t=>new Option(t.name,t.id)));hintCount=0;$('hints').replaceChildren();$('hint').disabled=false;setTerrain();persist();}
function setTerrain(){terrain=stage.terrains.find(t=>t.id===$('terrain').value)||stage.terrains[0];view.terrain(terrain);$('results').replaceChildren();$('console').textContent='Monde réinitialisé. Le programme est conservé.';}
function lock(value){busy=value;for(const id of ['run','test','stage','terrain','reset'])$(id).disabled=value;$('stop').disabled=!value;}
const labels={syntax:'Erreur de syntaxe Python',exception:'Exception pendant l’exécution',actions:'Nombre maximal d’actions dépassé',interrupted:'Interruption volontaire',timeout:'Temps d’exécution dépassé',network:'Python indisponible'};
function describe(r){return r.kind==='ok'?(r.success?'Objectif atteint, sans collision.':'Python exécuté : objectif non atteint.'):labels[r.kind]||r.kind;}
async function execute(all){
  if(busy)return;const token=++epoch;const code=$('code').value;const terrains=all?[...stage.terrains]:[terrain];lock(true);$('results').replaceChildren();$('console').textContent='Exécution Python…';let passed=true;
  try{
    for(const t of terrains){
      if(token!==epoch)break;
      view.terrain(t);const r=await runtime.run(code,t);if(token!==epoch)break;
      $('console').textContent=`${t.name} · ${describe(r)}\n${r.output||''}${r.error||''}`;
      for(const s of r.trace||[]){if(token!==epoch)break;view.state(s);if(!all&&!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,180));}
      if(token!==epoch)break;
      const li=document.createElement('li');li.textContent=`${r.success?'✓':'✗'} ${t.name} : ${describe(r)}${r.actions!==undefined?` (${r.actions} actions)` : ''}`;li.dataset.kind=r.kind;$('results').append(li);passed&&=r.success;
      if(['timeout','interrupted','network'].includes(r.kind))break;
    }
    if(all&&passed&&token===epoch){saved.progress||={};saved.progress[stage.id]=true;persist();$('console').textContent+='\nTous les terrains de cette étape sont réussis. Explique maintenant pourquoi ton programme fonctionne.';}
  }catch(e){if(token===epoch)$('console').textContent=`Python indisponible : ${e.message}`;}
  finally{if(token===epoch)lock(false);}
}
$('run').onclick=()=>execute(false);$('test').onclick=()=>execute(true);
$('stop').onclick=()=>{epoch++;runtime.cancel();lock(false);$('console').textContent='Interruption volontaire. Worker détruit ; Python redémarre. Aucune réussite attribuée.';};
$('reset').onclick=()=>{epoch++;setTerrain();};
$('stage').onchange=()=>{epoch++;setStage($('stage').value);};$('terrain').onchange=()=>{epoch++;setTerrain();};
$('theme').onchange=()=>{document.documentElement.dataset.theme=$('theme').value;persist();};
$('code').oninput=persist;$('prediction').oninput=persist;
$('hint').onclick=()=>{const li=document.createElement('li');li.textContent=stage.hints[hintCount++];$('hints').append(li);$('hint').disabled=hintCount===3;};
$('erase').onclick=()=>{try{localStorage.removeItem(key);}catch{}saved={};$('code').value=starter;$('prediction').value='';$('console').textContent='Sauvegarde locale effacée.';};
setStage(saved.stage);
