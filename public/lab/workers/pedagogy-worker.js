// Independent, read-only analysis. No Duck, simulator, student exec or bridge.
import {loadPyodide} from 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs';
const ready=(async()=>{
  const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});
  const response=await fetch(new URL('../pedagogy/structure.py',import.meta.url));
  if(!response.ok)throw Error('Analyse syntaxique indisponible');
  await py.runPythonAsync(await response.text());return py;
})();
ready.catch(()=>{});
self.onmessage=async({data})=>{
  try{
    const py=await ready;
    py.globals.set('_request',JSON.stringify(data));
    const result=await py.runPythonAsync("import json\n_r=json.loads(_request)\njson.dumps(analyze(_r['code'], _r['required'], _r['forbidden']))");
    self.postMessage({id:data.id,result:JSON.parse(result)});
  }catch{self.postMessage({id:data.id,result:{status:'BLOCKED',reasons:['Analyse indisponible ; vérification du code par l’enseignant nécessaire.'],competence:'BLOCKED'}});}
};
