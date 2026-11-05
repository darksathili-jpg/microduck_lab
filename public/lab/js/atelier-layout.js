import {renderProse} from './python-prose.js';
// Presentation only: preserve existing editors, controls and draft handlers.
export function mountAtelier(){
 const $=id=>document.getElementById(id);
 const hero=document.createElement('section');hero.className='activity-heading';hero.setAttribute('aria-labelledby','atelier-title');
 hero.innerHTML='<div><p class="overline">CARNET D’ATELIER NSI</p><h2 id="atelier-title">Apprendre Python avec Microduck</h2><p id="atelier-objective"></p></div><figure><img src="assets/atelier/preprod-original.svg" width="2172" height="724" alt="Illustration vectorielle de préproduction : robot stylisé et parcours"></figure>';
 $('learning-feedback').before(hero);
 const brief=document.querySelector('.brief'),details=document.createElement('details');details.className='mission-context';const summary=document.createElement('summary');summary.textContent='Contexte de la séquence et choix de l’étape';brief.before(details);details.append(summary,brief);
 $('program-title').textContent='02 · Programmer';$('world-title').textContent='03 · Observer Microduck';
 document.querySelector('.program .section-top span').textContent='PYTHON';
 addEventListener('lab-exercise',e=>{
  const a=e.detail?.activity;renderProse($('atelier-title'),a?.title||$('mission-title').textContent);
  $('atelier-objective').textContent=e.detail?.objective||'Programmation libre : prévois, programme et compare le résultat.';
 });
}
export function mountStatementDrawer(){
 const statement=document.getElementById('statement'),drawer=document.createElement('details'),summary=document.createElement('summary');drawer.id='activity-statement';
 const media=matchMedia('(min-width:1051px)');
 function update(){drawer.open=document.body.classList.contains('action-pilot')||media.matches;summary.textContent=drawer.open?'01 · Comprendre — réduire la consigne':'01 · Comprendre — voir la consigne complète';}
 statement.before(drawer);drawer.append(summary,statement);update();media.addEventListener('change',update);
 drawer.addEventListener('toggle',()=>{summary.textContent=drawer.open?'01 · Comprendre — réduire la consigne':'01 · Comprendre — voir la consigne complète';});
 // A link back to the statement must also reveal it on a narrow display.
 document.addEventListener('click',e=>{const link=e.target.closest('a[href="#code"]');if(link){e.preventDefault();document.getElementById('code').focus();document.getElementById('code').scrollIntoView({block:'center'});}});
 document.querySelector('.program>a').addEventListener('click',()=>{drawer.open=true;});
}
