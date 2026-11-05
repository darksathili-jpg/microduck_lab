// Independent command ledger. No state, goal or counters supplied by student code.
export class TransitionLedger {
  #terrain; #state; #trace; #actions=0; #collisions=0; #commands=[];
  constructor(terrain){this.#terrain=structuredClone(terrain);this.#state={x:terrain.start[0],y:terrain.start[1],heading:terrain.heading??1};this.#trace=[{...this.#state}];}
  obstacle(){const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][this.#state.heading];const x=this.#state.x+dx,y=this.#state.y+dy;return x<0||y<0||x>=this.#terrain.width||y>=this.#terrain.height||this.#terrain.obstacles.some(p=>p[0]===x&&p[1]===y);}
  goal(){return this.#state.x===this.#terrain.goal[0]&&this.#state.y===this.#terrain.goal[1];}
  action(name,executePython){
    if(!['avancer','tourner_gauche','tourner_droite'].includes(name))throw Error('Commande inconnue');
    if(this.#actions>=200){const e=Error('ActionLimitError: Limite de 200 actions atteinte.');e.kind='actions';throw e;}
    this.#actions++;this.#commands.push(name);
    if(name==='avancer'&&this.obstacle()){this.#collisions++;throw Error('CollisionError: Obstacle ou bord : déplacement impossible.');}
    const next={...this.#state};
    if(name==='avancer'){const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][next.heading];next.x+=dx;next.y+=dy;}
    else next.heading=(next.heading+(name==='tourner_gauche'?3:1))%4;
    const actual=executePython(name);
    if(actual.x!==next.x||actual.y!==next.y||actual.heading!==next.heading)throw Error('Transition Python incohérente avec le terrain.');
    this.#state=next;this.#trace.push({...next});
  }
  result(kind,error='',output=''){return {kind,error,output,state:{...this.#state},trace:this.#trace.map(s=>({...s})),commands:[...this.#commands],actions:this.#actions,collisions:this.#collisions,success:kind==='ok'&&this.goal()&&this.#collisions===0};}
}
Object.freeze(TransitionLedger.prototype);
Object.freeze(TransitionLedger);
