import {activityGroups} from '../pedagogy/registry.js';
export const FILENAME='editorial.json',BACKUP_NAME='microduck-editorial-backup.json';
export const MAX_BYTES=1024*1024;
export const fieldLabels={title:'Titre',situation:'Précision de situation',work:'Travail demandé — une consigne par zone',prerequisites:'Prérequis',course:'Explication de la notion',prediction:'Question de prévision',explain:'Question de justification',hints:'Trois indices',exampleNotes:'Exemples textuels complémentaires'};
const keys=Object.keys(fieldLabels),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),exact=(obj,expected)=>object(obj)&&Object.keys(obj).length===expected.length&&expected.every(k=>Object.hasOwn(obj,k));
export const clone=value=>JSON.parse(JSON.stringify(value));
export function validateEditorial(value){
  if(!exact(value,['format','version','sequences'])||value.format!=='microduck-editorial'||value.version!==1)throw Error('Format rédactionnel inconnu ou champs protégés ajoutés.');
  if(!exact(value.sequences,Object.keys(activityGroups)))throw Error('Liste des séquences invalide.');
  let total=0;
  for(const [sequence,activities]of Object.entries(activityGroups)){
    const entries=value.sequences[sequence];if(!exact(entries,activities.map(a=>a.id)))throw Error('Identifiants des activités invalides : '+sequence);
    for(const activity of activities){const entry=entries[activity.id];if(!exact(entry,keys))throw Error('Champs rédactionnels invalides : '+activity.id);
      for(const key of keys){const text=entry[key];if(key==='work'||key==='hints'){
        if(!Array.isArray(text)||text.length<(key==='hints'?3:1)||text.length>(key==='hints'?3:20)||text.some(s=>typeof s!=='string'||!s.trim()||s.length>12000))throw Error('Consignes/indices invalides : '+activity.id);
      }else if(typeof text!=='string'||text.length>(key==='title'?200:12000)||(key==='title'&&!text.trim()))throw Error('Texte invalide : '+key);
      }total++;
    }
  }
  if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_BYTES)throw Error('Contenus trop volumineux (1 Mio maximum).');
  return {value,total};
}
export function parseEditorial(text){if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Fichier trop volumineux.');return validateEditorial(JSON.parse(text)).value;}
export function serializeEditorial(value){validateEditorial(value);return JSON.stringify(value,null,2)+'\n';}
export async function loadEditorial(){const response=await fetch(new URL('../pedagogy/editorial.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('Fichier rédactionnel indisponible ; aucun texte ancien substitué.');const text=await response.text();return {text,data:parseEditorial(text)};}
export async function digest(text){const bytes=new TextEncoder().encode(text);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function changes(before,after){validateEditorial(before);validateEditorial(after);const result=[];for(const [sequence,entries]of Object.entries(before.sequences))for(const [id,entry]of Object.entries(entries))for(const key of keys)if(JSON.stringify(entry[key])!==JSON.stringify(after.sequences[sequence][id][key]))result.push({sequence,id,key,before:entry[key],after:after.sequences[sequence][id][key]});return result;}
export function reviewNotice(before,after){const changed=changes(before,after),words=/\b(for|while|if|else|assert|global|return|True|False|index|range)\b|\d|duck\./gu;const signals=changed.filter(c=>JSON.stringify(c.before).match(words)?.join('|')!==JSON.stringify(c.after).match(words)?.join('|'));return {changed,signals,message:signals.length?'Éléments de spécification modifiés (Python, nombres ou commandes). Revue explicite obligatoire ; les validateurs ne sont pas adaptés.':'Correction rédactionnelle présumée. La cohérence sémantique n’est pas prouvée : revue explicite obligatoire.'};}
