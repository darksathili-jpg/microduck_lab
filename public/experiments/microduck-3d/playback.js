// Time belongs to the viewer, not the Python simulation. One trace, one RAF loop.
export class Playback {
  constructor({frame,settle,change,duration,instant,discrete}) {
    Object.assign(this,{frame,settle,change,duration,instant,discrete});
    this.trace=[];this.index=0;this.progress=0;this.state='idle';this.serial=0;
  }
  snapshot(){return {index:this.index,progress:this.progress,state:this.state,actions:Math.max(0,this.trace.length-1)};}
  emit(){this.change(this.snapshot());}
  halt(){++this.serial;cancelAnimationFrame(this.raf);this.resolve?.();this.resolve=null;}
  load(trace){this.halt();this.trace=trace.map(s=>({...s}));this.index=0;this.progress=0;this.state=trace.length?'ready':'idle';if(trace.length)this.settle(this.trace[0]);this.emit();}
  cancel(){this.halt();this.progress=0;this.state=this.trace.length?'stopped':'idle';if(this.trace.length)this.settle(this.trace[this.index]);this.emit();}
  pause(){if(this.state!=='playing')return;this.halt();this.state='paused';this.emit();}
  step(){
    this.halt();if(!this.trace.length)return;
    if(this.index>=this.trace.length-1)this.index=0;
    this.index=Math.min(this.index+1,this.trace.length-1);this.progress=0;
    this.settle(this.trace[this.index]);this.state=this.index===this.trace.length-1?'finished':'paused';this.emit();
  }
  play(restart=false){
    this.halt();if(!this.trace.length)return Promise.resolve();
    if(restart||this.index>=this.trace.length-1){this.index=0;this.progress=0;this.settle(this.trace[0]);}
    this.state='playing';this.emit();const token=this.serial;let last=performance.now();
    return new Promise(resolve=>{
      this.resolve=resolve;
      const finish=()=>{this.state='finished';this.progress=0;this.resolve=null;this.emit();resolve();};
      const tick=now=>{
        if(token!==this.serial)return;
        if(this.instant()||this.index>=this.trace.length-1){this.index=this.trace.length-1;this.settle(this.trace[this.index]);finish();return;}
        this.progress=Math.min(1,this.progress+Math.max(0,now-last)/this.duration());last=now;
        const from=this.trace[this.index],to=this.trace[this.index+1];
        if(!this.discrete())this.frame(from,to,this.progress,this.index+1);
        if(this.progress>=1){this.index++;this.progress=0;this.settle(to);}
        this.emit();
        if(this.index>=this.trace.length-1){finish();return;}
        this.raf=requestAnimationFrame(tick);
      };
      this.raf=requestAnimationFrame(tick);
    });
  }
}
