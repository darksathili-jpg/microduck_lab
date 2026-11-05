import {View,isAdvance} from './simulator-view.js';
import {Playback} from '../../experiments/microduck-3d/playback.js';

// Presentation only: no terrain rules or Python execution belong here.
export class RenderController {
  constructor() {
    this.$=id=>document.getElementById(id);this.mode='2d';this.busy=false;this.loading=false;
    this.view=new View(this.$('grid'),this.$('position'));
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.player=new Playback({frame:(a,b,p)=>this.mode==='2d'?this.view.frame(a,b,p):this.safe(()=>this.renderer?.frame(a,b,p)),
      settle:s=>this.settle(s),change:s=>this.update(s),duration:()=>this.mode==='3d'?900:180,
      instant:()=>!this.animate||this.reduced.matches,discrete:()=>false});
    this.$('view-mode').onchange=()=>this.setMode(this.$('view-mode').value);
    this.$('replay').onclick=()=>{this.animate=true;this.player.play(true);};
    this.$('read-step').onclick=()=>this.player.step();
    this.$('retry-3d').onclick=()=>this.setMode('3d');
    for(const [id,factor] of [['zoom-in',.85],['zoom-out',1.18]])this.$(id).onclick=()=>this.safe(()=>this.renderer?.zoom(factor));
    this.$('camera-front').onclick=()=>this.safe(()=>this.renderer?.angle('front'));
    // Keep the current RAF: its instant branch settles and resolves the reading once.
    this.reduced.addEventListener('change',()=>this.notice());
    addEventListener('pagehide',()=>{this.abort?.abort();this.renderer?.dispose();});
  }
  safe(fn){try{return fn();}catch(e){this.fail('Rendu 3D interrompu : '+e.message);}}
  settle(s){
    this.current={...s};
    const walking=this.mode==='2d'&&this.player.state==='playing'&&this.animate&&!this.reduced.matches&&isAdvance(s,this.player.trace[this.player.index+1]);
    this.view.state(s,{walking});this.$('world-3d').setAttribute('aria-label',this.$('grid').getAttribute('aria-label'));
    if(this.mode==='3d')this.safe(()=>{this.renderer?.cancel();this.renderer?.state(s);});
  }
  update(s){
    if(s.state!=='playing')this.view.rest();
    this.$('reading-state').textContent=`Action ${Math.min(s.index+Number(s.state==='playing'),s.actions)}/${s.actions} · ${s.state==='playing'?'lecture en cours':s.state==='finished'?'lecture terminée':s.state==='paused'?'lecture discrète':s.state==='stopped'?'lecture arrêtée':'prêt'}`;
    this.$('replay').disabled=this.busy||!s.actions;this.$('read-step').disabled=this.busy||!s.actions;
    this.$('stop').disabled=!this.busy&&s.state!=='playing';
  }
  notice(message){this.$('render-status').textContent=message||`${this.mode==='3d'?'Vue 3D · marche illustrative 900 ms, sans physique':'Vue 2D légère'}${this.reduced.matches?' · mouvements réduits : état final immédiat ; Pas suivant disponible':''}.`;}
  visibility(){this.$('grid').hidden=this.mode==='3d';this.$('world-3d').hidden=this.mode!=='3d';this.$('view-mode').value=this.mode;this.$('camera-controls').hidden=this.mode!=='3d';}
  fail(message){this.mode='2d';this.loading=false;this.renderer?.dispose();this.renderer=null;this.player.cancel();this.visibility();this.notice(message+' Vue 2D disponible ; Python reste utilisable.');this.$('retry-3d').hidden=false;}
  async setMode(mode){
    const start=performance.now();this.cancel();this.mode=mode;this.visibility();
    if(mode==='2d'){if(this.loading)this.keep2d=true;this.notice();return;}
    if(this.renderer){this.renderer.terrain(this.world);this.renderer.state(this.current);this.switchMs=performance.now()-start;this.notice();return;}
    if(this.loading){this.mode='2d';this.visibility();this.notice('Chargement 3D en cours ; Python reste disponible en 2D.');return;}
    this.mode='2d';this.visibility();this.loading=true;this.notice('Chargement 3D à la demande… Vue 2D disponible, Python indépendant.');
    this.abort=new AbortController();const timer=setTimeout(()=>this.abort.abort(),8000);const requested=this.abort;
    try{const {createRenderer}=await import('../../experiments/microduck-3d/renderer.js');requested.signal.throwIfAborted();
      const renderer=await createRenderer(this.$('world-3d'),message=>this.fail(message),{signal:requested.signal});
      this.renderer=renderer;this.modelMs=performance.now()-start;renderer.terrain(this.world);renderer.state(this.current);
      // A subsequent 2D selection must not be overwritten by a late download.
      if(!this.keep2d){this.mode='3d';this.visibility();}this.notice();this.$('retry-3d').hidden=true;
    }catch(e){this.fail(e.name==='AbortError'?'Chargement 3D annulé après 8 s.':'Modèle 3D indisponible : '+e.message);}
    finally{clearTimeout(timer);this.loading=false;this.keep2d=false;this.switchMs=performance.now()-start;}
  }
  terrain(t){this.world=t;this.player.load([]);this.view.terrain(t);this.current={x:t.start[0],y:t.start[1],heading:t.heading};this.safe(()=>this.renderer?.terrain(t));}
  async playTrace(trace,{animate=true}={}){this.animate=animate;this.player.load(trace);await this.player.play();}
  cancel(){this.player.cancel();}
  setBusy(value){this.busy=value;this.update(this.player.snapshot());}
  snapshot(){return {mode:this.mode,loading:this.loading,current:this.current,trace:this.player.trace,reading:this.player.snapshot(),renderer:this.renderer?.snapshot(),modelMs:this.modelMs,switchMs:this.switchMs,reduced:this.reduced.matches};}
}
