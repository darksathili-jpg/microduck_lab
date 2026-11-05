import {canonical,sha256,PILOTS} from './review-store.js';
import {metadata} from '../pedagogy/registry.js';
import {plainProse} from './python-prose.js';
const paths=['./runtime-client.js','./transition-validator.js','./execution-context.js','./pedagogy-client.js','../workers/python-worker.js','../workers/pedagogy-worker.js','../python/microduck_sim.py','../python/duck_api.py','../pedagogy/structure.py','../pedagogy/registry.js','../pedagogy/statements.js','../pedagogy/traversee.js','../pedagogy/premiere.js','../pedagogy/consolidation.js'];
export const reviewCriteria={
 'traversee/s1':['Trois appels successifs à duck.avancer(), sans boucle.','Prévoir et expliquer les positions après chaque appel.'],
 'fiabilite/f3':['Initialiser la variable locale compte dans avancer_n.','Incrémenter compte après chaque déplacement.','Renvoyer la valeur du compteur local avec return ; renvoyer n ne démontre pas ce travail.','Expliquer pourquoi la variable globale compte reste à 99 ; conserver les assertions.'],
 'analyse/a3':['Comparer réellement chaque position à la cible et compter ces comparaisons.','S’arrêter à la première occurrence et compter la comparaison qui trouve la cible.','Traiter l’absence, une liste vide et des occurrences répétées.','Expliquer le résultat sur d’autres cibles ; ne pas modifier la liste ni déplacer le robot pendant la recherche.']
};
async function source(path){const response=await fetch(new URL(path,import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('Contexte technique indisponible : '+path);const text=await response.text();return {path,hash:await sha256(text),text};}
export class ReviewContext{
 constructor(){this.ready=this.load();this.ready.catch(()=>{});}
 async load(){
  const rows=await Promise.all(paths.map(source));
  const missions=await Promise.all(['traversee','fiabilite','analyse'].map(async id=>{const row=await source('../missions/'+id+'.json');return [id,JSON.parse(row.text)];}));
  return {sources:Object.fromEntries(rows.map(r=>[r.path,r.hash])),missions:Object.fromEntries(missions)};
 }
 async forActivity(missionId,activity){
  const activityId=missionId+'/'+activity.id;if(!PILOTS.has(activityId))throw Error('Activité hors pilote.');const loaded=await this.ready,{contract}=metadata(missionId,activity.id);
  const terrains={};for(const id of Object.keys(activity.cases)){const world=loaded.missions[missionId].stages.flatMap(s=>s.terrains).find(t=>t.id===id);if(!world)throw Error('Terrain attendu introuvable.');terrains[id]=world;}
  const context={version:1,activityId,title:plainProse(activity.title),contract:structuredClone(contract),cases:structuredClone(activity.cases),terrains,starter:activity.starter,work:activity.work,explain:activity.explain,criteria:reviewCriteria[activityId],sources:loaded.sources};
  return {context,hash:await sha256(canonical(context))};
 }
 async verify(){
  const before=await this.ready,now=await this.load();
  if(canonical(before)!==canonical(now))throw Error('Les critères ou les sources ont changé. Rechargez le laboratoire et refaites les essais avant de soumettre.');
 }
}
