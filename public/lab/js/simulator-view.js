const robot = `<svg viewBox="0 0 80 90" aria-hidden="true"><path d="M20 62h14v23H14v-8h6m28-15h14v15h6v8H48" fill="#ed9b26" stroke="#142b34" stroke-width="3"/><rect x="15" y="35" width="50" height="35" rx="12" fill="#fbd351" stroke="#142b34" stroke-width="3"/><rect x="13" y="9" width="54" height="35" rx="13" fill="#fbd351" stroke="#142b34" stroke-width="3"/><rect x="20" y="16" width="40" height="15" rx="5" fill="#142b34"/><circle cx="29" cy="23" r="3" fill="#75ead1"/><circle cx="51" cy="23" r="3" fill="#75ead1"/><path d="M32 36h16l-8 10z" fill="#ef7845"/></svg><span class="arrow"></span>`;
// Heading identity is explicit: North/back, East/right, South/front, West/left.
const idlePoses=['up_idle.png','right_idle.png','down_idle.png','left_idle.png'];
const walkingPoses=['up','right','down','left'].flatMap(direction=>['a','b'].map(phase=>`${direction}_step_${phase}.png`));
export const isAdvance=(a,b)=>!!a&&!!b&&a.heading===b.heading&&Math.abs(b.x-a.x)+Math.abs(b.y-a.y)===1;
export class View {
  constructor(grid, position) {
    this.grid=grid; this.position=position;this.walkPhase=null;
    this.poses=[];this.spritesReady=false; // Preproduction proposal: existing coded SVG fallback.
    this.walkingPoses=[];this.walkingReady=false; // PNG redistribution rights not established.
  }
  loadPoses(files,readyFlag) {
    const images=files.map(file=>{
      const image=new Image(256,256);
      image.className='duck-pose';image.alt='';image.hidden=true;
      image.onerror=()=>{this[readyFlag]=false;this.showPose();};
      image.src=new URL('../assets/microduck-2d/'+file,import.meta.url).href;
      return image;
    });
    // Idle and walking groups decode independently; a missing walk keeps idle usable.
    Promise.all(images.map(image=>image.decode().then(()=>{
      if(image.naturalWidth!==256||image.naturalHeight!==256)throw new Error('Invalid pose dimensions');
    }))).then(()=>{this[readyFlag]=true;this.showPose();})
      .catch(()=>{this[readyFlag]=false;this.showPose();});
    return images;
  }
  showPose() {
    if(!this.robot||this.robot.parentNode!==this.grid)return;
    this.robot.classList.toggle('has-sprite',!!this.spritesReady);
    const selected=this.spritesReady?(this.walkingReady&&this.walkPhase!==null?this.walkingPoses[this.heading*2+this.walkPhase]:this.poses[this.heading]):null;
    for(const [images,ready] of [[this.poses,this.spritesReady],[this.walkingPoses,this.walkingReady]])for(const image of images){
      image.hidden=image!==selected;
      if(ready&&image.parentNode!==this.robot)this.robot.append(image);
    }
  }
  rest(){this.walkPhase=null;this.showPose();}
  frame(a,b,progress) {
    // Progress belongs exclusively to Playback. Only accepted adjacent states can walk.
    const walking=isAdvance(a,b),p=Math.max(0,Math.min(1,progress));
    this.heading=p===1?b.heading:a.heading;
    this.walkPhase=walking?(p<.5?0:1):null;this.showPose();
    this.robot.querySelector('.arrow').textContent=['↑','→','↓','←'][this.heading];
    this.grid.style.setProperty('--x',walking?a.x+(b.x-a.x)*p:a.x);
    this.grid.style.setProperty('--y',walking?a.y+(b.y-a.y)*p:a.y);
  }
  terrain(t) {
    this.t=t; this.grid.replaceChildren(); this.grid.style.gridTemplateColumns=`repeat(${t.width},1fr)`;
    this.grid.style.setProperty('--cols',t.width); this.grid.style.setProperty('--rows',t.height);
    for(let y=0;y<t.height;y++) for(let x=0;x<t.width;x++) {
      const cell=document.createElement('div'); cell.className='cell';
      if(t.obstacles.some(p=>p[0]===x&&p[1]===y)){cell.classList.add('obstacle');cell.textContent='▧';}
      if(t.goal[0]===x&&t.goal[1]===y){
        cell.classList.add('goal');
        const marker=document.createElement('span');marker.className='goal-marker';marker.textContent='★';cell.append(marker);
      }
      this.grid.append(cell);
    }
    this.robot=document.createElement('div');this.robot.className='duck';this.robot.innerHTML=robot;this.grid.append(this.robot);
    this.state({x:t.start[0],y:t.start[1],heading:t.heading});
  }
  state(s,{walking=false}={}) {
    this.walkPhase=walking?(this.walkPhase??0):null;
    this.heading=s.heading;this.showPose();
    this.grid.style.setProperty('--x',s.x);this.grid.style.setProperty('--y',s.y);
    const dir=['Nord','Est','Sud','Ouest'][s.heading];this.robot.querySelector('.arrow').textContent=['↑','→','↓','←'][s.heading];
    this.position.textContent=`Position (${s.x}, ${s.y}) · ${dir}`;
    this.grid.setAttribute('aria-label',`${this.t.name}. Robot en (${s.x}, ${s.y}), orientation ${dir}. Objectif (${this.t.goal.join(', ')}). Obstacles : ${this.t.obstacles.map(p=>p.join(', ')).join(' ; ') || 'aucun'}.`);
  }
}
