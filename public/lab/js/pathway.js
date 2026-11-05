export const catalog=[
 {id:'traversee',title:'01 · La traversée',file:'traversee.json',transfer:'traversee-transfert.json',description:'Programme le robot en Python pour atteindre l’étoile sans collision. Chaque déplacement affiché provient du monde calculé par Python.'},
 {id:'explore',title:'02 · Microduck explore',file:'explore.json',transfer:'explore-transfert.json',description:'Observe le capteur, prends une décision et construis une stratégie sur un trajet à un coude. Ce parcours n’est pas un algorithme général de labyrinthe.'},
 {id:'memorise',title:'03 · Microduck mémorise',file:'memorise.json',transfer:'memorise-transfert.json',description:'Écris des listes Python pour mémoriser des commandes et les observations produites par le robot, puis parcours ces données.'},
 {id:'cartographie',title:'04 · Microduck cartographie',file:'cartographie.json',transfer:'cartographie-transfert.json',description:'Associe chaque observation à un couple de coordonnées avec un dictionnaire Python. Les coordonnées sont suivies par ton programme, pas mesurées par un capteur réel.'},
 {id:'fiabilite',title:'05 · Microduck contrôle ses commandes',file:'fiabilite.json',transfer:'fiabilite-transfert.json',description:'Spécifie des fonctions, vérifie leurs contrats avec assert et distingue variable locale, variable globale, valeur renvoyée et comportement du robot.'},
 {id:'analyse',title:'06 · Microduck analyse sa trajectoire',file:'analyse.json',transfer:'analyse-transfert.json',description:'Construis le journal logique des cases parcourues, puis écris une recherche séquentielle et compte les comparaisons.'}
];
export const learningTargets={
 explore:['Prévoir le booléen du capteur et distinguer observation, négation et action.','Expliquer if et while, le choix rotation/déplacement et le cas zéro sur ces terrains bornés.','Montrer la fonction réutilisable, son retour et la différence entre déplacements et actions.','Justifier le transfert relatif au cap et les limites de la stratégie, avec les aides réellement utilisées.'],
 memorise:['Expliquer l’ordre des éléments, les indices et la longueur d’une liste Python.','Montrer comment le programme parcourt les commandes et corrige un indice hors limites.','Construire un journal d’observations dans une fonction et expliquer la valeur de retour et la lecture finale.','Prévoir puis justifier un journal nouveau sans recopier une sortie préfabriquée.'],
 cartographie:['Distinguer tuple de coordonnées, clé, valeur booléenne et absence de clé.','Montrer le dictionnaire réellement construit à partir des lectures et expliquer le suivi des coordonnées.','Parcourir les valeurs ou les items et justifier le résumé, y compris un relevé vide.','Adapter les paramètres au départ et au cap du transfert ; distinguer coordonnées logiques et localisation physique.']
};
Object.assign(learningTargets,{
 fiabilite:['Énoncer préconditions et postcondition ; distinguer contrat et exemple testé.','Montrer que le cas zéro ne déplace pas le robot ; diagnostiquer une assertion en échec.','Distinguer variable locale et variable globale, paramètre et argument, valeur renvoyée et valeur affichée.','Réutiliser la fonction et ses tests sur le transfert ; expliquer les limites des assertions.'],
 analyse:['Construire le journal à partir des déplacements autorisés, sans lire une trace interne.','Écrire une recherche de première occurrence et justifier la sentinelle -1.','Tester première, dernière, absente, vide et doublons ; corriger une borne.','Compter les comparaisons et justifier le coût linéaire dans le pire cas, séparément du nombre de pas.']
});
export const PATH_KEY='microduck.lab.pathway.v1';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function restorePath(storage){
 const state={version:1,active:'traversee',stages:{},behavior:{}};let raw;
 try{raw=storage.getItem(PATH_KEY);if(!raw)return {state,warning:''};const d=JSON.parse(raw);if(!object(d)||d.version!==1)throw Error('format');
  let partial=false;if(catalog.some(c=>c.id===d.active))state.active=d.active;else partial=true;
  for(const field of ['stages','behavior']){if(!object(d[field])){partial=true;continue;}for(const c of catalog){const value=d[field][c.id];if(value===undefined)continue;if(field==='stages'&&typeof value==='string'&&value.length<80)state.stages[c.id]=value;else if(field==='behavior'&&object(value)){state.behavior[c.id]={};for(const [key,flag]of Object.entries(value))if(key.length<80&&typeof flag==='boolean'&&!['__proto__','constructor','prototype'].includes(key))state.behavior[c.id][key]=flag;else partial=true;}else partial=true;}}
  if(partial)throw Object.assign(Error('partial'),{state});return {state,warning:''};
 }catch(e){try{if(raw&&!storage.getItem(PATH_KEY+'.recovery'))storage.setItem(PATH_KEY+'.recovery',raw);}catch{}return {state:e.state||state,warning:'Parcours local restauré partiellement ou réinitialisé. Le code Python reste indépendant ; les résultats locaux ne sont pas des compétences validées.'};}
}
