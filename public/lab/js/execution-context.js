// Identity checks only. No exercise rule is evaluated here.
export function currentResult(detail){
 const snapshot=window.labStudy?.snapshot();
 return !!snapshot&&detail.runId===snapshot.runId&&detail.revision===snapshot.codeRevision&&
  detail.code===document.getElementById('code').value&&
  detail.missionId===snapshot.mission&&detail.exerciseId===(document.getElementById('pilot-choice')?.value||'')&&
  detail.terrainId===snapshot.world?.id;
}
