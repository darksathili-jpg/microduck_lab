import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs';
const ready = (async () => {
  const py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' });
  const response = await fetch(new URL('../python/microduck_sim.py', import.meta.url));
  if (!response.ok) throw Error('Modèle Python indisponible');
  py.FS.writeFile('/home/pyodide/microduck_sim.py', await response.text());
  return py;
})();
ready.then(() => postMessage({ type: 'ready' })).catch(e => postMessage({type:'load-error',message:String(e)}));
self.onmessage = async ({data}) => {
  if (data.type !== 'run') return;
  try {
    const py = await ready;
    py.globals.set('_request_json', JSON.stringify(data));
    const serialized = await py.runPythonAsync(`
import json, io, traceback, contextlib
from microduck_sim import Duck, ActionLimitError
_request = json.loads(_request_json)
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
_duck = Duck(_request['terrain'])
_output = LimitedOutput()
_kind, _error = 'ok', ''
try:
    with contextlib.redirect_stdout(_output), contextlib.redirect_stderr(_output):
        exec(compile(_request['code'], '<eleve>', 'exec'), {'duck': _duck, '__name__': '__main__'})
except SyntaxError:
    _kind, _error = 'syntax', traceback.format_exc(limit=3)
except ActionLimitError:
    _kind, _error = 'actions', traceback.format_exc(limit=3)
except BaseException:
    _kind, _error = 'exception', traceback.format_exc(limit=3)
json.dumps({'kind': _kind, 'error': _error, 'output': ''.join(_output.parts), 'trace': _duck.trace, 'state': _duck.state(), 'actions': _duck.actions, 'collisions': _duck.collisions, 'success': _kind == 'ok' and _duck.objectif_atteint() and _duck.collisions == 0})
`);
    postMessage({ type:'result', id:data.id, result:JSON.parse(serialized) });
  } catch (e) { postMessage({type:'result',id:data.id,result:{kind:'exception',error:String(e),output:'',trace:[],success:false}}); }
};
