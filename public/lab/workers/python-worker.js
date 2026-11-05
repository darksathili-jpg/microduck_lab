import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs';
import {TransitionLedger} from '../js/transition-validator.js';
const send=self.postMessage.bind(self), parse=JSON.parse.bind(JSON);
const token=crypto.randomUUID();
const FIRST_OCCURRENCE_POLICY='analyse/a2:first-occurrence:v1';
const firstOccurrenceSource="\ndef _first_occurrence_checks(namespace, action_count):\n    cases = [\n        (\"duplicates\", [(1, 1), (2, 1), (1, 1)], (1, 1), 0),\n        (\"absent\", [(0, 1), (1, 1), (2, 1)], (9, 1), -1),\n        (\"empty\", [], (1, 1), -1),\n        (\"last\", [(0, 1), (1, 1), (2, 1)], (2, 1), 2),\n    ]\n    function = namespace.get(\"chercher\")\n    output = LimitedOutput()\n    rows = []\n    for name, positions, target, expected in cases:\n        before = positions.copy()\n        actions_before = action_count()\n        row = dict(id=name, expected=expected, status=\"fail\", actual=None,\n                   actualType=None, unchanged=True, actionAttempted=False,\n                   reason=\"\", error=\"\")\n        if \"chercher\" not in namespace:\n            row[\"reason\"] = \"missing\"\n        elif not callable(function):\n            row[\"reason\"] = \"not-callable\"\n        else:\n            try:\n                with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):\n                    value = function(positions, target)\n                row[\"actualType\"] = type(value).__name__[:80]\n                if type(value) is int:\n                    row[\"actual\"] = str(value) if -10**30 < value < 10**30 else \"entier hors plage\"\n                elif type(value) is bool:\n                    row[\"actual\"] = \"True\" if value else \"False\"\n                elif value is None:\n                    row[\"actual\"] = \"None\"\n                else:\n                    row[\"actual\"] = \"type \" + row[\"actualType\"][:60]\n                if type(value) is not int:\n                    row[\"reason\"] = \"type\"\n                elif value != expected:\n                    row[\"reason\"] = \"value\"\n            except BaseException as error:\n                row[\"reason\"] = \"exception\"\n                row[\"error\"] = (type(error).__name__ + \": \" + str(error))[:500]\n            try:\n                row[\"unchanged\"] = positions == before\n            except BaseException:\n                row[\"unchanged\"] = False\n            if not row[\"unchanged\"]:\n                row[\"reason\"] = \"mutation\"\n        row[\"actionAttempted\"] = action_count() != actions_before\n        if row[\"actionAttempted\"]:\n            row[\"reason\"] = \"action\"\n        if not row[\"reason\"]:\n            row[\"status\"] = \"pass\"\n        rows.append(row)\n    return {\"policy\": \"analyse/a2:first-occurrence:v1\",\n            \"status\": \"pass\" if all(row[\"status\"] == \"pass\" for row in rows) else \"fail\",\n            \"cases\": rows}\n\njson.dumps(_first_occurrence_checks(_student_scope, _check_action_count))\n";
const ready=(async()=>{
  const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});
  const read=async name=>{const r=await fetch(new URL('../python/'+name,import.meta.url));if(!r.ok)throw Error('Modèle Python indisponible');return r.text();};
  const model=await read('microduck_sim.py'),api=await read('duck_api.py');
  py.FS.writeFile('/home/pyodide/microduck_sim.py',model);
  py.FS.writeFile('/home/pyodide/duck_api.py',api);
  return {py,model};
})();
ready.then(()=>send({type:'ready',token})).catch(e=>send({type:'load-error',message:String(e)}));
self.onmessage=async({data})=>{
  if(data.type!=='run')return;
  const ledger=new TransitionLedger(data.terrain);
  let engine,scope,terrain,ctor,fault,probing=false,probeActions=0;
  try{
    const {py,model}=await ready;
    // Separate namespace/class from the importable module student code can modify.
    scope=py.toPy({});await py.runPythonAsync(model,{globals:scope});ctor=scope.get('Duck');terrain=py.toPy(data.terrain);engine=ctor(terrain);
    const action=name=>{if(probing){probeActions++;throw Error('Action robotique interdite pendant un contrôle de recherche.');}try{ledger.action(name,command=>{
      const method=engine[command];try{method();}finally{method.destroy();}
      const state=engine.state();try{return state.toJs({dict_converter:Object.fromEntries});}finally{state.destroy();}
    });}catch(e){fault=e;throw e;}};
    py.registerJsModule('_duck_bridge',{action,obstacle:()=>ledger.obstacle(),goal:()=>ledger.goal()});
    // No request id/token or authoritative engine/result is exposed to Python globals.
    py.globals.set('_student_code',data.code);
    const serialized=await py.runPythonAsync(`
import json, io, traceback, contextlib
from duck_api import DuckAPI
class LimitedOutput(io.TextIOBase):
    def __init__(self):
        self.parts = []
        self.length = 0
    def write(self, text):
        if self.length + len(text) > 8000:
            raise RuntimeError('Limite de sortie (8000 caractères) atteinte.')
        self.parts.append(text)
        self.length += len(text)
        return len(text)
_output = LimitedOutput()
_kind, _error = 'ok', ''
try:
    with contextlib.redirect_stdout(_output), contextlib.redirect_stderr(_output):
        _student_scope = {'duck': DuckAPI(), '__name__': '__main__'}
        exec(compile(_student_code, '<eleve>', 'exec'), _student_scope)
except SyntaxError:
    _kind, _error = 'syntax', traceback.format_exc(limit=3)
except BaseException:
    _kind, _error = 'exception', traceback.format_exc(limit=3)
json.dumps({'kind': _kind, 'error': _error, 'output': ''.join(_output.parts)})
`);
    const diagnostic=parse(serialized);
    const kind=fault?(fault.kind==='actions'?'actions':'exception'):['ok','syntax','exception'].includes(diagnostic.kind)?diagnostic.kind:'exception';
    const result=ledger.result(kind,fault?String(fault):diagnostic.error,diagnostic.output);
    try{
      if(data.functionCheck===FIRST_OCCURRENCE_POLICY&&kind==='ok'){
        probing=true;py.globals.set('_check_action_count',()=>probeActions);
        try{result.functionChecks=parse(await py.runPythonAsync(firstOccurrenceSource));}
        catch{result.functionChecks={policy:FIRST_OCCURRENCE_POLICY,status:'unavailable',cases:[]};}
        const after=ledger.result(kind,result.error,result.output);
        if(JSON.stringify(after)!==JSON.stringify({...result,functionChecks:undefined})){
          result.functionChecks={policy:FIRST_OCCURRENCE_POLICY,status:'unavailable',cases:[]};
        }
      }
    }finally{
      probing=false;
      for(const name of ['_student_scope','_check_action_count','_first_occurrence_checks'])if(py.globals.has(name))py.globals.delete(name);
    }
    send({type:'result',id:data.id,token,result});
  }catch(e){send({type:'result',id:data.id,token,result:ledger.result('exception',String(e))});}
  finally{engine?.destroy();terrain?.destroy();ctor?.destroy();scope?.destroy();}
};
