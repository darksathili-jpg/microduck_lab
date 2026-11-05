import {renderProse} from './python-prose.js';
import {metadata} from '../pedagogy/registry.js';
import {currentResult} from './execution-context.js';
import {presentFeedback,stateLabels,stateIcons} from './feedback-presentation.js';
export function mountExecutionFeedback(){
 const $=id=>document.getElementById(id),program=document.querySelector('.program'),diagnostics=document.querySelector('.diagnostics');
 const feedback=document.createElement('section');feedback.id='learning-feedback';feedback.className='atelier-status';feedback.tabIndex=-1;feedback.setAttribute('aria-label','Retour sur mon programme');feedback.setAttribute('aria-live','polite');
 feedback.innerHTML='<span id="feedback-icon" aria-hidden="true"></span><div><p id="feedback-label"></p><h2 id="feedback-title"></h2><p id="execution-feedback"></p><p id="behavior-feedback"></p><p id="constraint-summary"></p><p id="next-action"></p></div>';
 document.querySelector('.learning-workspace').before(feedback);
 const recap=document.createElement('p');recap.id='console-verdict';recap.innerHTML='<span id="recap-icon" aria-hidden="true"></span> <span id="recap-text"></span> <a href="#learning-feedback">Détail</a>';
 diagnostics.firstElementChild.querySelector('h2').textContent='Sortie Python';$('console').after(recap);
 const details=document.createElement('details');details.id='execution-details';const summary=document.createElement('summary');summary.textContent='Détails des terrains et des vérifications';details.append(summary,diagnostics.lastElementChild);diagnostics.append(details);
 const controls=program.querySelector('.controls');
 $('code').before(controls);controls.after($('runtime'));$('code').after(diagnostics);details.append($('test-scope'));
 let technicalView,localReview;
 addEventListener('lab-review-state',e=>{localReview=e.detail;if(technicalView)show(technicalView,true);});
 function show(view,preserveDetails=false){
  technicalView=view;
  if(['success','review'].includes(view.state)&&localReview?.current&&localReview.verdict){const favorable=localReview.verdict==='favorable';view={...view,state:'local-'+localReview.verdict,title:favorable?'Avis favorable pour cette version':'Correction demandée',next:'Avis pédagogique local enregistré. Consulte le dossier près de la sortie Python.',short:favorable?'Avis favorable pour cette version.':'Correction demandée par l’enseignant.'};}
  feedback.dataset.state=recap.dataset.state=view.state;feedback.dataset.verdict=view.state==='fix'?'fail':view.state;
  $('feedback-label').textContent=stateLabels[view.state]||(view.state==='local-favorable'?'AVIS FAVORABLE POUR CETTE VERSION':'CORRECTION DEMANDÉE');$('feedback-icon').textContent=$('recap-icon').textContent=stateIcons[view.state]||(view.state==='local-favorable'?'✓':'!');$('feedback-title').textContent=view.title;
  $('execution-feedback').textContent=view.reason||'';$('next-action').textContent=view.next||'';$('recap-text').textContent=(stateLabels[view.state]||view.title)+' — '+(view.short||view.title);
  if(!preserveDetails)for(const id of ['behavior-feedback','constraint-summary'])$(id).textContent='';
  for(const id of ['feedback-title','execution-feedback','next-action','recap-text'])renderProse($(id),$(id).textContent);
 }
 const invalidate=()=>show({state:'stale',title:'Exécute cette version du programme',reason:'Les résultats précédents ne décrivent pas ce nouveau contexte.',next:'Ton code est conservé.',short:'Nouvelle exécution nécessaire.'});
 $('code').addEventListener('input',invalidate);for(const name of ['lab-mission','lab-terrain','lab-exercise','lab-interrupted'])addEventListener(name,invalidate);
 addEventListener('lab-busy',e=>{if(e.detail)invalidate();});
 addEventListener('lab-run-start',()=>show({state:'running',title:'Exécution Python en cours',reason:'Aucun verdict n’est annoncé pendant le calcul.',next:'Tu peux interrompre l’exécution.',short:'Aucun verdict disponible.'}));
 addEventListener('lab-python-result',e=>{
  if(!currentResult(e.detail))return;
  if(e.detail.result.kind!=='ok'){show(presentFeedback({result:e.detail.result}));return;}
  show({state:'running',title:'Python exécuté — lecture de la trace',reason:'Le calcul est terminé sans erreur. Les mouvements affichent son résultat.',next:e.detail.exerciseId?'Les vérifications de l’exercice suivent cette lecture.':'Aucun exercice n’est évalué.',short:'Lecture de la trace en cours.'});
 });
 addEventListener('lab-result',e=>{
  if(!currentResult(e.detail))return;const {result:r,exerciseId}=e.detail;
  if(r.kind!=='ok'){show(presentFeedback({result:r}));return;}
  if(!exerciseId){show({state:'executed',title:'Aucun exercice évalué',reason:`${r.actions??0} action(s) du robot ; étoile ${r.success?'atteinte':'non atteinte'}. Aucun contrat d’exercice sélectionné.`,next:'Une exécution sans exception ne prouve pas que le programme répond à un exercice.',short:'Aucun exercice évalué.'});return;}
  show({state:'running',title:'Analyse des contraintes en cours',reason:'Python exécuté sans erreur. La sortie est disponible.',next:'Le comportement et les contraintes restent présentés séparément.',short:'Vérification du programme en cours.'});
 });
 addEventListener('lab-assessment',e=>{
  if(!currentResult(e.detail))return;const d=e.detail,{activity}=metadata(d.missionId,d.activity.id);
  show(presentFeedback({...d,activity}));
  const expected=activity.cases[d.terrainId];
  if(d.coverage)$('behavior-feedback').textContent=`Cas réellement essayés avec ce code : ${d.coverage.tested}/${d.coverage.total} ; conformes : ${d.coverage.passed}/${d.coverage.total}.`;
  if(expected?.actions===0&&!expected.goal)$('behavior-feedback').textContent=`Arrivée à l’étoile non requise : zéro action demandée. Actions observées : ${Number.isInteger(d.result.actions)?d.result.actions:'indisponibles'}. Le contrôle de sortie normalise les espaces.`;
  const diagnostic=d.diagnostic;
  if(diagnostic)$('constraint-summary').textContent=diagnostic.status==='FAIL'?(d.missionId==='memorise'&&activity.id==='m1'&&!diagnostic.observed?.includes('index')?'Contraintes Python : aucun accès indexé repéré.':'Contraintes Python : à corriger ; voir les détails.'):(diagnostic.status==='PASS'?'Contraintes Python : critères automatiques satisfaits.':diagnostic.observed?.length?'Contraintes Python : constructions repérées ; utilisation et explication à examiner.':'Contraintes Python : analyse non concluante ; examen enseignant nécessaire.');
 });
 invalidate();
}
