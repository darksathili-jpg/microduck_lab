const robot = `<svg viewBox="0 0 80 90" aria-hidden="true"><path d="M20 62h14v23H14v-8h6m28-15h14v15h6v8H48" fill="#ed9b26" stroke="#142b34" stroke-width="3"/><rect x="15" y="35" width="50" height="35" rx="12" fill="#fbd351" stroke="#142b34" stroke-width="3"/><rect x="13" y="9" width="54" height="35" rx="13" fill="#fbd351" stroke="#142b34" stroke-width="3"/><rect x="20" y="16" width="40" height="15" rx="5" fill="#142b34"/><circle cx="29" cy="23" r="3" fill="#75ead1"/><circle cx="51" cy="23" r="3" fill="#75ead1"/><path d="M32 36h16l-8 10z" fill="#ef7845"/></svg><span class="arrow"></span>`;
export class View {
  constructor(grid, position) { this.grid=grid; this.position=position; }
  terrain(t) {
    this.t=t; this.grid.replaceChildren(); this.grid.style.gridTemplateColumns=`repeat(${t.width},1fr)`;
    this.grid.style.setProperty('--cols',t.width); this.grid.style.setProperty('--rows',t.height);
    for(let y=0;y<t.height;y++) for(let x=0;x<t.width;x++) {
      const cell=document.createElement('div'); cell.className='cell';
      if(t.obstacles.some(p=>p[0]===x&&p[1]===y)){cell.classList.add('obstacle');cell.textContent='▧';}
      if(t.goal[0]===x&&t.goal[1]===y){cell.classList.add('goal');cell.textContent='★';}
      this.grid.append(cell);
    }
    this.robot=document.createElement('div');this.robot.className='duck';this.robot.innerHTML=robot;this.grid.append(this.robot);
    this.state({x:t.start[0],y:t.start[1],heading:t.heading});
  }
  state(s) {
    this.grid.style.setProperty('--x',s.x);this.grid.style.setProperty('--y',s.y);
    const dir=['Nord','Est','Sud','Ouest'][s.heading];this.robot.querySelector('.arrow').textContent=['↑','→','↓','←'][s.heading];
    this.position.textContent=`Position (${s.x}, ${s.y}) · ${dir}`;
    this.grid.setAttribute('aria-label',`${this.t.name}. Robot en (${s.x}, ${s.y}), orientation ${dir}. Objectif (${this.t.goal.join(', ')}). Obstacles : ${this.t.obstacles.map(p=>p.join(', ')).join(' ; ') || 'aucun'}.`);
  }
}
