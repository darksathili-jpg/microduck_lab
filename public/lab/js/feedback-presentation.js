import {normalizeFirstOccurrenceChecks} from './runtime-client.js';
// Convert authentic evaluator outputs to a view. Never recompute a contract.
export const stateLabels={executed:'PYTHON EXÉCUTÉ',running:'EN COURS',error:'ERREUR PYTHON',fix:'À CORRIGER',pending:'TESTS À POURSUIVRE',success:'CRITÈRES AUTOMATIQUES SATISFAITS',review:'VÉRIFICATION ENSEIGNANTE',stale:'RÉSULTAT À ACTUALISER'};
export const stateIcons={executed:'•',running:'…',error:'×',fix:'!',pending:'↗',success:'✓',review:'?',stale:'↻'};
function presentBaseFeedback({result:r,assessment:a,diagnostic:d,coverage,activity,missionId}){
 if(r.kind!=='ok')return {state:'error',title:r.kind==='syntax'?'Erreur de syntaxe Python':r.kind==='timeout'?'Temps d’exécution dépassé':r.kind==='interrupted'?'Exécution interrompue':r.kind==='network'?'Python indisponible':'Erreur pendant l’exécution Python',reason:'Le programme ne s’est pas terminé normalement. Le message réel est conservé dans la sortie.',next:'Corrige la cause indiquée avant d’examiner les autres critères.',short:'Exécution non terminée normalement.'};
 const phase=missionId==='analyse'&&activity?.id==='a2';
 if(!a?.applicable)return {state:'pending',title:activity?.id==='s2'?'Prolongement : comparer le trajet':'Contrôle courant non applicable à ce terrain',reason:`Python exécuté sans erreur. Étoile ${r.success?'atteinte':'non atteinte'} sur ce terrain.`,next:activity?.id==='s2'?'Explique l’adaptation de `distance` ; le contrôle courant reste sur le terrain court.':'Prépare le terrain de l’exercice avant de demander son contrôle.',short:'Terrain distinct du contrôle courant.'};
 const behavior=a.pass?'Comportement attendu observé.':'Comportement attendu non observé.';
 if(!a.pass||coverage?.failed>0)return {state:'fix',title:phase?'Contrôle robotique de phase 2 à corriger':'Le comportement demandé n’est pas respecté',reason:'Python exécuté sans erreur. '+behavior+(coverage?.failed>0?` Cas essayés non conformes : ${coverage.failed}.`:''),next:phase?'Pour la recherche seule (phase 1), compare les exemples séparément. Pour la phase 2, vérifie la collecte et l’affichage demandés.':'Compare les actions et la sortie aux critères de l’exercice.',short:phase?'Phase 2 : comportement à corriger.':'Comportement demandé à corriger.'};
 if(d?.status==='FAIL')return {state:'fix',title:missionId==='memorise'&&activity.id==='m1'&&!d.observed?.includes('index')?'Les accès indexés manquent':'Les contraintes Python sont à corriger',reason:'Python exécuté sans erreur. '+behavior,next:'Reprends les constructions demandées ; les vérifications détaillées indiquent celles qui manquent ou sont interdites.',short:'Contraintes Python à corriger.'};
 if(coverage&&coverage.tested<coverage.total){const n=coverage.total-coverage.tested;return {state:'pending',title:n===1?'Un terrain reste à essayer':`${n} terrains restent à essayer`,reason:`${coverage.tested}/${coverage.total} cas de cet exercice effectivement essayés avec cette version du code. `+behavior,next:'Essaie les autres terrains prévus ; explique ensuite tes résultats.',short:n===1?'Un terrain restant.':`${n} terrains restants.`};}
 if(d?.status!=='PASS')return {state:'review',title:d?.observed?.length?'Expliquer et faire examiner le programme':'Analyse non concluante : examen enseignant requis',reason:'Python exécuté sans erreur. '+behavior+(coverage?` ${coverage.passed}/${coverage.total} cas attendus conformes.`:''),next:(d?.observed?.length?'Explique l’utilisation effective des constructions repérées.':'Fais examiner le code ; aucune conformité des constructions n’est annoncée.')+' Aucune compétence attribuée automatiquement.',short:'Examen du programme et de l’explication.'};
 return {state:'success',title:'Les critères automatiques contrôlés sont satisfaits',reason:'Python exécuté sans erreur. '+behavior,next:'Explique ta démarche à l’enseignant. Aucune compétence attribuée automatiquement.',short:'Critères automatiques satisfaits.'};
}

const searchCaseLabels={duplicates:'doublons',absent:'cible absente',empty:'liste vide',last:'dernière position'};
function searchCaseText(row){
 const label=searchCaseLabels[row.id];
 if(row.status==='pass')return label+' : conforme';
 if(row.reason==='value')return label+' : attendu \x60'+row.expected+'\x60, obtenu \x60'+row.actual+'\x60';
 if(row.reason==='type')return label+' : indice de type \x60int\x60 attendu, obtenu \x60'+row.actual+'\x60 (type \x60'+row.actualType+'\x60)';
 if(row.reason==='mutation')return label+' : liste modifiée';
 if(row.reason==='action')return label+' : action du robot tentée pendant la recherche';
 if(row.reason==='missing')return label+' : fonction \x60chercher\x60 absente';
 if(row.reason==='not-callable')return label+' : \x60chercher\x60 ne peut pas être appelée';
 return label+' : exception pendant le contrôle'+(row.error?' ('+row.error.slice(0,160)+')':'');
}
export function presentFeedback(input){
 const view=presentBaseFeedback(input),{result:r,assessment:a,coverage,activity,missionId}=input;
 if(missionId!=='analyse'||activity?.id!=='a2'||r.kind!=='ok'||!a?.applicable)return view;
 const checks=normalizeFirstOccurrenceChecks(r.functionChecks);
 const terrainText=coverage?'Terrains : '+coverage.passed+'/'+coverage.total+' conformes. ':'Terrain courant : '+(a.pass?'conforme':'à corriger')+'. ';
 if(checks.status==='unavailable'){
  return {...view,state:view.state==='fix'?'fix':'pending',
   title:view.state==='fix'?view.title:'Contrôles de recherche indisponibles',
   reason:terrainText+'Recherche : les quatre contrôles ne sont pas disponibles ou sont incomplets. '+view.reason,
   next:'Relance les tests avant de conclure sur la recherche. Si le problème persiste, fais examiner le programme. Aucune compétence attribuée automatiquement.',
   short:'Recherche non vérifiée ; aucun résultat global conforme.'};
 }
 const passed=checks.cases.filter(row=>row.status==='pass').length;
 const reason=terrainText+'Recherche : '+passed+'/4 contrôles conformes. '+checks.cases.map(searchCaseText).join(' ; ')+'.';
 if(checks.status==='fail'){
  return {...view,state:'fix',title:a.pass&&!(coverage?.failed>0)?'Recherche à corriger':'Terrains et recherche à corriger',
   reason:reason+' '+view.reason,
   next:'Corrige la fonction \x60chercher\x60 puis relance les tests. Les terrains et la recherche sont contrôlés séparément. '+view.next,
   short:'Recherche à corriger ; '+terrainText.trim()};
 }
 return {...view,reason:reason+' '+view.reason};
}
