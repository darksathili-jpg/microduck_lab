export const STORAGE_KEY='microduck.lab.jalon1.v1';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function restore(storage){
  let raw;try{raw=storage.getItem(STORAGE_KEY);}catch{return {saved:{},warning:'Sauvegarde locale inaccessible ; travaillez sans restauration.'};}
  if(!raw)return {saved:{},warning:''};
  let data,warning='';
  try{data=JSON.parse(raw);if(!object(data))throw Error('shape');}
  catch{data={};warning='Sauvegarde impossible à restaurer. Un espace de travail vide a été récupéré.';}
  const saved={};let partial=false;
  for(const field of ['code','prediction'])if(field in data){if(typeof data[field]==='string')saved[field]=data[field];else partial=true;}
  if('theme' in data){if(['light','dark','projector'].includes(data.theme))saved.theme=data.theme;else partial=true;}
  if('stage' in data){if(['depart','capteurs'].includes(data.stage))saved.stage=data.stage;else partial=true;}
  if('progress' in data){if(object(data.progress)){saved.progress={};for(const id of ['depart','capteurs'])if(typeof data.progress[id]==='boolean')saved.progress[id]=data.progress[id];}else partial=true;}
  if(partial||('version' in data&&data.version!==1&&data.version!==2))warning='Sauvegarde restaurée partiellement : certaines valeurs incompatibles ont été écartées.';
  if(warning)try{if(!storage.getItem(STORAGE_KEY+'.recovery'))storage.setItem(STORAGE_KEY+'.recovery',raw);}catch{}
  return {saved,warning};
}
