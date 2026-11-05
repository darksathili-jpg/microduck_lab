import {renderProse} from './python-prose.js';
// Compact learning presentation; independent from the three local-review pilots.
export const isProjectedTransfer=(activity,sequenceId)=>activity?.id==='transfert'&&['traversee','explore','memorise','cartographie','fiabilite','analyse'].includes(sequenceId);
export const isActionPilot=(activity,sequenceId)=>activity?.presentationBlocked===true||isProjectedTransfer(activity,sequenceId)||['s1','s2','s3','s4','s5','s6','e1','e2','e3','e4','m1','m2','m3','m4','c1','c2','c3','c4','f1','f2','f3','f4','a1','a2','a3','a4'].includes(activity?.id);
// A presentation only: never pass this projection to an assessor or a draft store.
// The first two editorial instructions and first result paragraph are the public contract.
// Complete reference prose remains available in the teacher's editing fields.
export function transferPresentation(activity,sequenceId){
 if(!isProjectedTransfer(activity,sequenceId))return activity?.id==='transfert'?{...activity,presentationBlocked:true,situation:'',prerequisites:'',work:['Sélectionne la séquence et l’activité de transfert pour consulter son contrat.'],example:null,exampleNotes:'Contexte de transfert incomplet : aucune donnée réservée présentée.',course:'Retrouve l’activité dans « Atelier guidé ».',prediction:'Prévois le résultat après révélation effective du terrain.',explain:'Explique ta démarche avec l’enseignant.',hints:['Vérifie la séquence sélectionnée.','Sélectionne l’activité de transfert.','Demande à l’enseignant de vérifier le contexte.']}:activity;
 const courses={
  traversee:'Un transfert met à l’épreuve une stratégie sur une situation non montrée pendant l’entraînement. Prévois, programme, puis explique les hypothèses et les limites de ta stratégie. L’arrivée seule ne démontre pas l’autonomie.',
  explore:activity.course.replace('La stratégie d’Explore convient à ce coude, pas à tous les labyrinthes.','Une stratégie ne convient pas nécessairement à tous les terrains : explique ses limites.'),
  memorise:activity.course,
  cartographie:'Réutilise une fonction de collecte déjà travaillée. Une clé repère la case où une observation est lue, pas la case devant le robot. Le capteur renvoie un booléen, pas des coordonnées. `return` transmet le dictionnaire ; `sorted(carte.items())` produit une liste triée de ses associations pour l’affichage, sans transformer `carte` en liste.',
  fiabilite:activity.course,
  analyse:activity.course
 };
 const hints={
  cartographie:['Relève les coordonnées initiales et le cap après révélation, puis justifie les arguments choisis.','Distingue la position qui sert de clé et la case observée par le capteur.','Vérifie la conservation de l’observation finale et distingue l’ordre des visites de l’ordre d’affichage.'],
  fiabilite:['Vérifie les préconditions sur le terrain révélé avant de choisir les arguments.','Une commande relative dépend du cap du robot ; ne modifie pas ses coordonnées par affectation.','Réutilise le contrat et justifie le cas sans déplacement ; une autre distance change l’argument, pas le contrat.'],
  analyse:['Distingue la collecte qui déplace le robot des recherches sur la liste déjà construite.','Vérifie que la liste conserve le départ et reste inchangée pendant les deux recherches.','Relis le contrat du tuple renvoyé, y compris le cas absent ; distingue comparaisons, déplacements et affichages.']
 };
 return {...activity,prerequisites:sequenceId==='traversee'?'Savoir utiliser les capteurs et justifier une condition d’arrêt ; prévoir sans exécuter.':sequenceId==='fiabilite'?'Savoir définir et appeler une fonction avec paramètre, exprimer ses préconditions avec `assert`, renvoyer une valeur et justifier les cas limites.':activity.prerequisites,work:activity.work.slice(0,2),example:null,exampleNotes:activity.exampleNotes.split('\n\n')[0],course:courses[sequenceId],hints:hints[sequenceId]||activity.hints,prediction:sequenceId==='explore'?'Sur le terrain révélé, prévois les positions et les caps au fil des actions. Quel nombre de déplacements la fonction doit-elle renvoyer ?':activity.prediction,explain:sequenceId==='explore'?'Montre la définition et l’unique appel de `explorer()`. Explique où le compteur est augmenté, pourquoi une rotation n’est pas un déplacement et quelles sont les limites de ta stratégie.':activity.explain};
}
export function transferRevealed(activity,{sequenceId,stage,world}={}){return !!(isProjectedTransfer(activity,sequenceId)&&stage&&stage===activity.stage&&world?.id&&activity.cases&&Object.hasOwn(activity.cases,world.id));}
let anchors,help,question,starterButton,recoveryAnchors;
export function arrangeExperience(activity,context={}){
 activity=transferPresentation(activity,context.sequenceId);
 const pilot=isActionPilot(activity,context.sequenceId),program=document.querySelector('.program');document.body.classList.toggle('action-pilot',pilot);if(!program)return;
 if(!anchors){anchors=new Map();for(const id of ['pilot-course','pilot-hint','pilot-explain']){const node=document.getElementById(id).closest('details'),anchor=document.createComment('resource-position');node.before(anchor);anchors.set(node,anchor);}
  help=document.createElement('section');help.id='learning-help';const title=document.createElement('h2');title.textContent='Aide pour un nouvel essai';help.append(title);program.append(help);
  question=document.createElement('section');question.id='pilot-understand';question.innerHTML='<h2>Comprendre après l’essai</h2><p></p>';program.append(question);
  starterButton=document.createElement('button');starterButton.id='pilot-starter';starterButton.type='button';starterButton.textContent='Charger l’amorce…';starterButton.addEventListener('click',()=>document.getElementById('draft-starter').click());program.querySelector('.controls').append(starterButton);
 }
 help.hidden=question.hidden=starterButton.hidden=!pilot;
 if(!recoveryAnchors){recoveryAnchors=new Map();for(const id of ['draft-status','student-drafts']){const node=document.getElementById(id),anchor=document.createComment('recovery-position');node.before(anchor);recoveryAnchors.set(node,anchor);}}
 for(const[node,anchor]of recoveryAnchors){if(pilot)help.before(node);else anchor.after(node);}
 for(const[node,anchor]of anchors){if(pilot){help.append(node);node.open=false;}else anchor.after(node);}
 const prepare=document.getElementById('pilot-start');if(!prepare.previousPosition){prepare.previousPosition=document.createComment('prepare-position');prepare.before(prepare.previousPosition);}
 if(pilot)program.querySelector('.controls').prepend(prepare);else prepare.previousPosition.after(prepare);
 const essentials=document.getElementById('action-essentials');if(pilot)program.querySelector('.section-top').after(essentials);else document.getElementById('action-pilot').append(essentials);
 starterButton.disabled=activity?.starter===null;renderProse(question.querySelector('p'),activity?.explain||'');document.getElementById('pilot-explain').hidden=pilot;
 const hero=document.querySelector('.activity-heading');hero.classList.toggle('compact-heading',pilot);
 if(pilot){document.getElementById('atelier-title').textContent='L’atelier Python';document.getElementById('atelier-objective').textContent='Un défi, un programme, un résultat à comprendre.';}
 const drawer=document.getElementById('activity-statement');drawer.open=pilot||matchMedia('(min-width:1051px)').matches;
}
