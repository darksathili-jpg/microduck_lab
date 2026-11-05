import {mountNotes} from './notes-controller.js';
import {arrangeExperience,isActionPilot,transferPresentation} from './activity-experience.js';
import {renderProse,plainProse,diagnosticProse} from './python-prose.js';
import {mountStatementDrawer} from './atelier-layout.js';
import {currentResult} from './execution-context.js';
import {statement} from '../pedagogy/statements.js';
import {loadEditorial} from './editorial-format.js';
import {statementMarkup,renderStatement,renderWorld,renderLesson} from './statement-renderer.js';
import {PedagogyClient} from './pedagogy-client.js';
import {activities as original,assess as originalAssess} from '../pedagogy/traversee.js';
import {courses as earlierCourses,assessNew} from '../pedagogy/premiere.js';
import {consolidationCourses} from '../pedagogy/consolidation.js';
import {pilotPresentation} from '../pedagogy/pilot-presentation.js';
const courses={...earlierCourses,...consolidationCourses};
export async function mount(initialMission='traversee'){
  const {data:editorial}=await loadEditorial();
  let missionId=initialMission,activities=original,assess=originalAssess;
  const $=id=>document.getElementById(id);const analyzer=new PedagogyClient();let analysisEpoch=0;
  let selected=null,hints=0,attempts=new Map(),lastCode=null;
  const defaultReflection=$('reflection').textContent;
  $('pilot').innerHTML=`<p id="pilot-ready"></p><label for="pilot-choice">Atelier guidé</label> <select id="pilot-choice"><option value="">Programmation libre — parcours existant</option></select>
    <div id="pilot-preparation" hidden><p id="pilot-preparation-status" role="status"></p></div>
    <div id="pilot-content" hidden>${statementMarkup}<details><summary>A · Comprendre la notion</summary><p id="pilot-prerequisites"></p><div id="pilot-course"></div><pre id="pilot-example" hidden></pre><div id="pilot-example-notes" hidden></div><p id="pilot-prediction"></p><button id="pilot-forecast">Écrire ma prévision</button></details>
    <p id="pilot-task" hidden></p><button id="pilot-start">Préparer cet exercice (remplace le code)</button>
    <details><summary>B · Chercher un indice</summary><button id="pilot-hint">Indice suivant</button><ol id="pilot-hints"></ol></details>
    <section id="pedagogy-results" hidden aria-label="Résultats de l’exercice"><h3>Résultats distincts</h3><p id="pilot-feedback" role="status"></p><p id="structure-feedback" role="status" data-status="BLOCKED"></p><p>Compétence pédagogique : BLOCKED — explication, pertinence et autonomie à apprécier par l’enseignant.</p></section><details><summary>D · Expliquer et faire évaluer</summary><p id="pilot-explain"></p><label for="pilot-notes">Mon explication et mes corrections — à discuter avec l’enseignant</label><textarea id="pilot-notes" rows="3" maxlength="8000"></textarea><p>Comportement automatique, correction du programme, compréhension, justification et transfert sont évalués séparément. Aucune compétence n’est attribuée automatiquement.</p></details></div><p id="pilot-storage" role="status"></p>`;
  const explanation=mountNotes({textarea:$('pilot-notes'),status:$('pilot-storage')});
  window.labNotes=explanation;
  mountStatementDrawer();
  $('execution-details').append($('pedagogy-results'));
  $('pedagogy-results').lastElementChild.textContent='Avec l’enseignant : expliquer la solution et vérifier la compréhension. Aucune compétence attribuée automatiquement.';
  const m1Overall=document.createElement('p');m1Overall.id='m1-overall';m1Overall.hidden=true;m1Overall.setAttribute('role','status');$('pedagogy-results').append(m1Overall);
  const clearOverall=()=>{m1Overall.hidden=true;m1Overall.textContent='';};
  addEventListener('lab-terrain',clearOverall);
  $('pilot-choice').addEventListener('change',clearOverall);
  $('pilot-start').addEventListener('click',clearOverall);
  $('code').addEventListener('input',clearOverall);
  addEventListener('lab-mission',clearOverall);
  $('pilot').tabIndex=0;
  function changeMission(id){missionId=id;activities=(id==='traversee'?original:courses[id]||[]).map(a=>({...a,...editorial.sequences[id][a.id]}));assess=id==='traversee'?originalAssess:assessNew;$('pilot-choice').replaceChildren(new Option('Programmation libre — parcours existant',''),...activities.map(a=>new Option(plainProse(a.title),a.id)));choose();$('pilot-ready').textContent=id==='traversee'?'Atelier guidé facultatif · La traversée (recette enseignante validée).':'Atelier guidé · '+document.getElementById('mission-title').textContent+' · recette enseignante à réaliser.';}
  function updatePreparation(){
    const box=$('pilot-preparation'),status=$('pilot-preparation-status'),button=$('pilot-start');
    box.hidden=!selected;
    if(!selected){button.classList.remove('primary');button.removeAttribute('aria-describedby');return;}
    const current=window.labStudy.snapshot(),world=current.world;
    const ready=current.stage===selected.stage&&Object.hasOwn(selected.cases,world?.id);
    const target=[...$('stage').options].find(o=>o.value===selected.stage)?.textContent||'cet exercice';
    const message=ready?'Terrain prêt pour cet exercice : « '+world.name+' ».':
      selected.starter===null?'Terrain de transfert non préparé. Prépare l’évaluation, puis ouvre le transfert à la demande de l’enseignant.':
      current.stage!==selected.stage?'Terrain à préparer : l’activité attend « '+target+' ». Terrain courant : « '+world.name+' » (autre étape).':
      'Terrain à préparer : « '+world.name+' » ne fait pas partie des terrains prévus pour cet exercice.';
    if(status.textContent!==message)status.textContent=message;
    status.dataset.ready=String(ready);
    button.classList.toggle('primary',!ready);button.setAttribute('aria-describedby',status.id);
  }
  function presentationContext(){const current=window.labStudy.snapshot();return {sequenceId:missionId,stage:current.stage,activity:selected};}
  function worldText(){renderWorld(document,window.labStudy?.snapshot().world,presentationContext());}
  addEventListener('lab-terrain',()=>{worldText();updatePreparation();analysisEpoch++;$('structure-feedback').dataset.status='BLOCKED';$('structure-feedback').textContent='Contraintes Python : BLOCKED — terrain changé ; exécuter à nouveau.';});
  function choose(){analysisEpoch++;selected=activities.find(a=>a.id===$('pilot-choice').value);explanation.select(missionId,selected?.id);dispatchEvent(new CustomEvent('lab-exercise',{detail:{missionId,activity:selected,objective:selected?statement(missionId,selected).objective:""}}));renderProse($('reflection'),pilotPresentation(selected)?.reflection||defaultReflection);hints=0;attempts.clear();lastCode=null;$('pilot-content').hidden=!selected;$('pedagogy-results').hidden=!selected;if(!selected){arrangeExperience(null);updatePreparation();window.labDrafts?.context(missionId+'/free',document.getElementById('mission-title').textContent+' — programmation libre','# Écris ton programme Python ici.\n');return;}
    const c=statement(missionId,selected);
    renderStatement(document,selected,c,window.labStudy?.snapshot().world,presentationContext());
    $('statement-api').closest('details').open=matchMedia('(min-width:1051px)').matches;
    $('structure-feedback').dataset.status='BLOCKED';$('structure-feedback').textContent='Contraintes Python : BLOCKED — aucun code analysé pour cet exercice.';worldText();
    renderLesson(document,selected,presentationContext());arrangeExperience(selected,presentationContext());
    $('pilot-hints').replaceChildren();$('pilot-hint').disabled=false;$('pilot-feedback').textContent='Aucun comportement vérifié pour cet exercice. Utilise Exécuter ; les compétences restent à valider avec l’enseignant.';
    window.labDrafts?.context(missionId+'/'+selected.id,document.getElementById('mission-title').textContent+' — '+plainProse(selected.title),selected.starter);
    $('pilot-start').textContent=selected.starter===null?'Préparer l’évaluation (code conservé)':'Préparer le terrain (code conservé)';
    if(!isActionPilot(selected,missionId))$('pilot-preparation').append($('pilot-start'));
    updatePreparation();
  }
  $('pilot-choice').onchange=choose;
  $('pilot-start').onclick=()=>{if(!selected)return;const stage=$('stage');stage.value=selected.stage;stage.dispatchEvent(new Event('change'));const terrain=$('terrain');terrain.value=selected.terrain;terrain.dispatchEvent(new Event('change'));
    attempts.clear();lastCode=null;$('pilot-feedback').textContent=selected.id==='transfert'?'Terrain de transfert non révélé. À la demande de l’enseignant, utilise le bouton de transfert existant en bas de page.':'Terrain préparé. Note ta prévision, puis écris et exécute ton Python.';
    if(selected.id==='transfert')$('transfer').focus();else $('code').focus();
  };
  $('pilot-hint').onclick=()=>{const li=document.createElement('li');renderProse(li,transferPresentation(selected,missionId).hints[hints++]);$('pilot-hints').append(li);$('pilot-hint').disabled=hints===3;};
  $('pilot-forecast').onclick=()=>{$('prediction').closest('details').open=true;$('prediction').focus();};
  addEventListener('lab-busy',e=>{for(const id of ['pilot-choice','pilot-start','pilot-starter'])if($(id))$(id).disabled=e.detail;});
  addEventListener('lab-run-start',()=>{worldText();updatePreparation();analysisEpoch++;clearOverall();$('pilot-feedback').textContent='Nouveau calcul en cours ; aucun comportement actuel annoncé.';$('structure-feedback').dataset.status='BLOCKED';$('structure-feedback').textContent='Contraintes : analyse en attente de cette exécution.';});
  addEventListener('lab-interrupted',()=>{analysisEpoch++;clearOverall();$('structure-feedback').dataset.status='BLOCKED';$('structure-feedback').textContent='Analyse interrompue : exécuter le programme avant de conclure.';});
  addEventListener('lab-result',async e=>{if(!selected||e.detail.missionId!==missionId||!currentResult(e.detail))return;const {terrainId,result,code}=e.detail;
    if(code!==$('code').value){$('pilot-feedback').textContent='Résultat d’une version antérieure : le code modifié reste à tester.';return;}
    if(code!==lastCode){attempts.clear();lastCode=code;}
    const assessment=assess(selected,terrainId,result);
    if(!assessment.applicable){dispatchEvent(new CustomEvent('lab-assessment',{detail:{...e.detail,activity:selected,assessment}}));renderProse($('pilot-feedback'),pilotPresentation(selected)&&selected.id==='s2'?'Terrain de prolongement : comparer avec la prévision puis adapter distance. Le contrôle courant de cet exercice porte sur le terrain court.':'Terrain hors des cas de cet exercice ; résultat de mission affiché dans la console. Prépare le terrain demandé.');return;}
    const ticket=++analysisEpoch,c=statement(missionId,selected);$('structure-feedback').dataset.status='BLOCKED';$('structure-feedback').textContent='Contraintes Python : BLOCKED — analyse syntaxique en cours, sans réexécuter le programme.';
    attempts.set(terrainId,assessment.pass);const expected=Object.keys(selected.cases),passed=expected.filter(id=>attempts.get(id)).length;
    const pilot=pilotPresentation(selected),terrainLabel=pilot?window.labStudy?.snapshot().world.name:terrainId;
    $('pilot-feedback').textContent=`${assessment.pass?'Comportement attendu observé':'Comportement attendu non observé'} sur ${terrainLabel}. ${passed}/${expected.length} cas attendus réussis avec cette même version du code. Ce résultat ne valide ni la construction utilisée, ni le raisonnement : explique ta solution à l’enseignant.`+(pilot&&selected.id==='a2'?' Pour cet exercice, ce contrôle concerne la phase 2 ; les essais de recherche de la phase 1 sont à examiner séparément.':'');
    if(missionId==='memorise'&&selected.id==='m1'){m1Overall.hidden=false;m1Overall.textContent='Bilan M1 : analyse des contraintes en cours ; le comportement seul ne suffit pas à conclure.';}
    const analysis=analyzer.analyze(code,c);
    // Let batch playback finish this case's analysis before changing terrain.
    // Keep the promise out of serialized/cloned assessment event payloads.
    Object.defineProperty(e.detail,'analysisReady',{value:analysis});
    const diagnostic=await analysis;if(ticket!==analysisEpoch||code!==$('code').value||!currentResult(e.detail))return;
    dispatchEvent(new CustomEvent('lab-assessment',{detail:{...e.detail,activity:selected,assessment,diagnostic,coverage:{tested:expected.filter(id=>attempts.has(id)).length,total:expected.length,passed,failed:expected.filter(id=>attempts.get(id)===false).length}}}));
    $('structure-feedback').dataset.status=diagnostic.status;$('structure-feedback').textContent='Contraintes Python : '+diagnostic.status+' — '+diagnostic.reasons.map(diagnosticProse).join(' ');
    if(pilot)$('structure-feedback').textContent='Contraintes de programmation'+(selected.id==='a2'?' du programme complet de phase 2':'')+' : '+(diagnostic.status==='FAIL'?'à corriger':diagnostic.status==='PASS'?'aucune construction interdite repérée':'à examiner avec l’enseignant')+' — '+diagnostic.reasons.map(diagnosticProse).join(' ').replaceAll('AST','syntaxique');
    renderProse($('structure-feedback'),$('structure-feedback').textContent);
    if(missionId==='memorise'&&selected.id==='m1'){
      const issues=[];
      if(result.kind!=='ok')issues.push('erreur d’exécution Python');
      if(!assessment.pass)issues.push('comportement attendu non respecté');
      if(diagnostic.status==='FAIL')issues.push('contraintes Python non respectées');
      const summary=issues.length?'Bilan M1 : à corriger — '+issues.join(' ; ')+'. Voir Résultats distincts.':'Bilan M1 : vérification enseignante requise — comportement attendu observé ; '+(diagnostic.observed?.includes('index')?'constructions repérées, mais leur utilisation effective pour produire le résultat reste à vérifier.':'analyse des constructions non concluante ou indisponible.')+' Aucune compétence validée automatiquement.';
      m1Overall.hidden=false;m1Overall.textContent=summary;
    }
  });
  $('code').addEventListener('input',()=>{analysisEpoch++;$('structure-feedback').dataset.status='BLOCKED';$('structure-feedback').textContent='Contraintes Python : BLOCKED — code modifié, analyse à refaire.';attempts.clear();lastCode=null;if(selected)$('pilot-feedback').textContent='Code modifié : les comportements de cette nouvelle version restent à vérifier.';});
  addEventListener('lab-mission',e=>changeMission(e.detail));changeMission(window.labStudy?.snapshot().mission||initialMission);
}
