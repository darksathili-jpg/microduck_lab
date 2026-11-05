import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadKinematics,buildRig,applyPose,setJoint,setJawOpen,groundFullBody,SITTING_POSE} from './vendor/pollen/duck.js';
import {VARIANTS,materialHookFor} from './vendor/pollen/variants.js';

const CELL=.24;
const heading=h=>[Math.PI/2,0,-Math.PI/2,Math.PI][h];
export async function createRenderer(host,onLoss,options={}) {
  const start=performance.now();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  host.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.01,15);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.minDistance=.3;controls.maxDistance=2;controls.maxPolarAngle=Math.PI/2-.02;
  controls.enableDamping=false;controls.enablePan=false;
  scene.add(new THREE.HemisphereLight(0xfffbef,0x6a7a70,2));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(1,2,2);scene.add(key);
  const fill=new THREE.DirectionalLight(0xffe0ac,1);fill.position.set(-1,1,-1);scene.add(fill);
  let k,rig;
  try {
    k=await loadKinematics(new URL('./robot/kinematics.json',import.meta.url).href,options);
    rig=await buildRig(k,{materialForMesh:materialHookFor(VARIANTS.classic),signal:options.signal});
    options.signal?.throwIfAborted();
  } catch (e) { controls.dispose();renderer.dispose();renderer.domElement.remove();throw e; }
  scene.add(rig.placer);
  const standingAngles=[0,-.08726646,-.457924,-.004940,.452984,.34906585,.34906585,0,0,0,.08726646,.457924,.004940,-.452984];
  const standing=Object.fromEntries(k.actuated_joints.map((name,i)=>[name,standingAngles[i]]));
  let current={x:0,y:1,heading:1},serial=0,isSitting=false,lost=false,frameInfo=null;
  const ground=new THREE.Group();scene.add(ground);
  function render(){if(!lost)renderer.render(scene,camera);}
  function pose(sitting){isSitting=sitting;applyPose(rig,sitting?SITTING_POSE:standing);rig.placer.position.y=0;groundFullBody(rig);render();}
  function setState(s){
    frameInfo=null;
    const before=rig.placer.position.clone();current={...s};
    rig.placer.position.x=s.x*CELL;rig.placer.position.z=s.y*CELL;rig.placer.rotation.y=heading(s.heading);
    const delta=rig.placer.position.clone().sub(before);delta.y=0;
    camera.position.add(delta);controls.target.add(delta);controls.update();render();
  }
  function angle(name){
    const offsets={front:[.56,.23,0],quarter:[.42,.23,.38],rear:[-.48,.23,-.2]};
    controls.target.set(rig.placer.position.x,.15,rig.placer.position.z);
    const offset=new THREE.Vector3(...offsets[name]).applyAxisAngle(new THREE.Vector3(0,1,0),heading(current.heading));
    camera.position.copy(controls.target).add(offset);controls.update();render();
  }
  function terrain(t){
    ++serial;
    for(const child of [...ground.children]){ground.remove(child);child.geometry.dispose();child.material.dispose();}
    const lines=[];
    for(let x=0;x<=t.width;x++)lines.push((x-.5)*CELL,0,-.5*CELL,(x-.5)*CELL,0,(t.height-.5)*CELL);
    for(let y=0;y<=t.height;y++)lines.push(-.5*CELL,0,(y-.5)*CELL,(t.width-.5)*CELL,0,(y-.5)*CELL);
    ground.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(lines,3)),new THREE.LineBasicMaterial({color:0x718075,transparent:true,opacity:.55})));
    const goal=new THREE.Mesh(new THREE.RingGeometry(.035,.05,32),new THREE.MeshBasicMaterial({color:0x469562,side:THREE.DoubleSide}));
    goal.rotation.x=-Math.PI/2;goal.position.set(t.goal[0]*CELL,.001,t.goal[1]*CELL);ground.add(goal);
    for(const [x,y] of t.obstacles){const wall=new THREE.Mesh(new THREE.BoxGeometry(.18,.08,.18),new THREE.MeshStandardMaterial({color:0x697a70,roughness:1}));wall.position.set(x*CELL,.04,y*CELL);ground.add(wall);}
    pose(false);setState({x:t.start[0],y:t.start[1],heading:t.heading});angle('quarter');
  }
  function frame(from,to,p){
    if(lost)return;
    const x=(from.x+(to.x-from.x)*p)*CELL,z=(from.y+(to.y-from.y)*p)*CELL;
    const dx=x-rig.placer.position.x,dz=z-rig.placer.position.z;
    camera.position.x+=dx;camera.position.z+=dz;controls.target.x+=dx;controls.target.z+=dz;
    rig.placer.position.x=x;rig.placer.position.z=z;
    const a=heading(from.heading),b=heading(to.heading);
    rig.placer.rotation.y=a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*p;
    applyPose(rig,standing);
    if(from.x!==to.x||from.y!==to.y){
      // Illustrative alternating leg cycle. Official joint limits are enforced by setJoint.
      const swing=Math.sin(p*2*Math.PI),leftLift=Math.max(0,swing),rightLift=Math.max(0,-swing);
      setJoint(rig,'left_hip_pitch',standing.left_hip_pitch+.28*swing);
      setJoint(rig,'right_hip_pitch',standing.right_hip_pitch+.28*swing);
      setJoint(rig,'left_knee',standing.left_knee+.38*leftLift);
      setJoint(rig,'right_knee',standing.right_knee-.38*rightLift);
      setJoint(rig,'left_ankle',standing.left_ankle-.18*leftLift);
      setJoint(rig,'right_ankle',standing.right_ankle+.18*rightLift);
    }
    frameInfo={from:{...from},to:{...to},progress:p};controls.update();render();
  }
  controls.addEventListener('change',render);
  const observer=new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();});observer.observe(host);
  renderer.domElement.addEventListener('webglcontextlost',e=>{if(lost)return;e.preventDefault();lost=true;++serial;observer.disconnect();onLoss('Contexte WebGL perdu : restitution 2D de la même trace.');});
  pose(false);angle('quarter');
  const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {
    terrain,frame,pose,angle,state:setState,
    dispose(){lost=true;++serial;observer.disconnect();controls.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();},
    cancel(){++serial;pose(isSitting);setState(current);},
    head(value){setJoint(rig,'head_yaw',value*Math.PI/180);render();},
    beak(value){setJawOpen(rig,value/100);render();},
    zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();render();},
    snapshot(){return {jointAngles:Object.fromEntries([...rig.joints].map(([name,j])=>{const q=j.baseQuat.clone().invert().multiply(j.body.quaternion);return [name,2*Math.atan2(q.x*j.axis.x+q.y*j.axis.y+q.z*j.axis.z,q.w)];})),jointRanges:Object.fromEntries([...rig.joints].map(([name,j])=>[name,j.range])),frame:frameInfo,rotationY:rig.placer.rotation.y,state:{...current},position:rig.placer.position.toArray(),camera:camera.position.toArray(),target:controls.target.toArray(),bodies:rig.bodies.size,joints:[...rig.joints.keys()],jaw:!!rig.placer.getObjectByName('jaw_pivot'),headQuaternion:rig.joints.get('head_yaw').body.quaternion.toArray(),jawQuaternion:rig.placer.getObjectByName('jaw_pivot')?.quaternion.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},
    metrics:{loadMs:performance.now()-start,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),three:THREE.REVISION,pixelRatio:renderer.getPixelRatio()},
    fallbackImage(){const size=renderer.getSize(new THREE.Vector2()),aspect=camera.aspect;ground.visible=false;renderer.setSize(400,400,false);camera.aspect=1;camera.updateProjectionMatrix();angle('quarter');render();const data=renderer.domElement.toDataURL('image/png');ground.visible=true;renderer.setSize(size.x,size.y,false);camera.aspect=aspect;camera.updateProjectionMatrix();render();return data;},
    async benchmark(frames=90){const intervals=[],submit=[];let last;for(let i=0;i<frames;i++)await new Promise(resolve=>requestAnimationFrame(now=>{if(last!==undefined)intervals.push(now-last);last=now;const start=performance.now();render();gl.finish();submit.push(performance.now()-start);resolve();}));const stat=list=>{list.sort((a,b)=>a-b);return {p50:list[Math.floor(list.length*.5)],p95:list[Math.floor(list.length*.95)],max:list.at(-1)};};return {frames,frameIntervalMs:stat(intervals),renderAndGpuWaitMs:stat(submit),...this.snapshot(),...this.metrics};}
  };
}
