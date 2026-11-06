/* ClassMana recomeço — arena tridimensional PlayCanvas, sem a lógica antiga. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shades={
 A:['#2661b5','#ffcf5e'],
 B:['#a92d24','#ffd065'],
 C:['#1b886c','#c9f5c3']
};
const COL=['#eee9dd','#222329','#ebf3f4','#15191c','#258eb9','#167eb0','#e44539','#bd342f','#ffc34b','#ffe079'];
export class RebuiltArena {
 constructor(stage){
  this.stage=stage;this.canvas=stage.querySelector('canvas');
  this.cursor=stage.querySelector('#aim-cursor');this.charge=stage.querySelector('#draw-charge');
  this.fallback=stage.querySelector('#target-fallback');
  this.aim={x:.50,y:.49};this.power=.35;this.charging=false;
  this.roundStarted=0;this.roundIndex=0;this.cfg={distance:10,wind:0,shift:0};
  this.house='A';this.bowType='classico';this.busy=false;this.started=false;this.engine=null;
  this.targetCenter={x:.5,y:.46,r:.14};this.onShot=null;this.timer=0;
  this.bindControls();
 }
 async initialize(){
  if(this.initialized)return;
  this.initialized=true;
  try{
   const pc=await import('https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/+esm');
   this.pc=pc;
   const app=new pc.Application(this.canvas,{graphicsDeviceOptions:{alpha:true,antialias:true}});
   this.app=app;app.start();
   app.scene.ambientLight=new pc.Color(.75,.83,.85);
   const camera=new pc.Entity('camera');
   camera.addComponent('camera',{clearColor:new pc.Color(.11,.31,.43,0),fov:59,nearClip:.1,farClip:260});
   camera.setPosition(0,2.5,7.5);camera.lookAt(0,2,-13.5);
   app.root.addChild(camera);this.camera=camera;
   const sun=new pc.Entity('sun');sun.addComponent('light',{type:'directional',intensity:2.3,color:new pc.Color(1,.91,.7)});
   sun.setLocalEulerAngles(50,-26,0);app.root.addChild(sun);
   const material=(color)=>{
    const m=new pc.StandardMaterial();m.diffuse=new pc.Color(...[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255));m.metalness=.1;m.gloss=46;m.update();return m;
   };
   this.mat=material;
   const mesh=(name,type,pos,scale,color,parent=app.root,rot=null)=>{
    const e=new pc.Entity(name);e.addComponent('render',{type,material:material(color)});
    e.setLocalPosition(...pos);e.setLocalScale(...scale);
    if(rot)e.setLocalEulerAngles(...rot);parent.addChild(e);return e;
   };
   this.mesh=mesh;
   mesh('grass','box',[0,-.30,-25],[110,.12,105],'#468e3b');
   mesh('shooting lane','box',[0,-.23,-9],[4.4,.012,39],'#a8ab63');
   for(let s of [-1,1]){
    mesh('border','box',[s*2.5,-.19,-9],[.065,.02,39],'#f0d68b');
    for(let i=0;i<10;i++){
     const z=-3-i*8,x=s*(7+i*.9),r=1+(i%4)*.16;
     mesh('tree trunk','cylinder',[x,.55,z],[.23,1.5,.23],'#694427');
     mesh('tree crown','cone',[x,2.1,z],[r,3.4,r],i%3?'#1f643b':'#2f8153');
    }
   }
   const target=new pc.Entity('target');app.root.addChild(target);this.target=target;
   mesh('stand','box',[0,.82,-.35],[.18,1.8,.22],'#70472a',target);
   mesh('cross base','box',[0,.02,-.24],[1.15,.13,.45],'#644020',target);
   mesh('target backing','cylinder',[0,1.95,-.02],[1.15,.20,1.15],'#62442c',target,[90,0,0]);
   for(let i=0;i<COL.length;i++){
    const radius=1.075-i*.103;
    mesh('ring '+i,'cylinder',[0,1.95,.105+i*.013],[radius,.035,radius],COL[i],target,[90,0,0]);
   }
   mesh('bullseye','cylinder',[0,1.95,.245],[.073,.05,.073],'#48351b',target,[90,0,0]);
   // Arco do lado DIREITO, preso à câmera; nunca cruza o alvo central.
   const bow=new pc.Entity('right-hand bow');this.bow=bow;camera.addChild(bow);
   bow.setLocalPosition(2.15,-.72,-3.9);
   const [base,gold]=shades.A;
   const limb=(y,angle)=>{
    const limb=mesh('recurve limb','box',[0,y,0],[.075,.88,.10],base,bow,[0,0,angle]);
    mesh('metal inlay','box',[0,y,.075],[.025,.75,.02],gold,bow,[0,0,angle]);return limb;
   };
   limb(.65,-13);limb(-.65,13);
   mesh('grip','box',[0,0,.075],[.12,.63,.2],'#553622',bow);
   mesh('arrow shaft','cylinder',[-.08,-.02,-.66],[.018,1.43,.018],'#eee5bb',bow,[87,0,-8]);
   const string=mesh('bowstring','cylinder',[-.23,0,-.08],[.009,2.31,.009],'#e9e3d2',bow);this.bowString=string;
   this.fallback.hidden=true;
   app.on('update',dt=>{if(!this.started)return;this.frame(dt)});
   this.engine='PlayCanvas 3D';
   this.resize();
  }catch(e){
   this.engine='2D de segurança';
   this.fallback.hidden=false;
   console.warn('PlayCanvas indisponível, alvo alternativo ativado:',e);
  }
 }
 bindControls(){
  const stage=this.stage;
  const coords=e=>{
   const b=stage.getBoundingClientRect();
   return {x:clamp((e.clientX-b.left)/b.width,.02,.98),y:clamp((e.clientY-b.top)/b.height,.04,.96)};
  };
  stage.addEventListener('pointermove',e=>{
   if(!this.started||this.busy)return;
   const a=coords(e);this.aim=a;this.updateAim();
  });
  stage.addEventListener('pointerdown',e=>{
   if(!this.started||this.busy||e.button!==0)return;
   e.preventDefault();this.charging=true;this.power=.35;this.chargeStart=performance.now();
   try{stage.setPointerCapture(e.pointerId)}catch{}
  });
  const release=e=>{
   if(!this.started||!this.charging)return;
   this.charging=false;
   this.power=clamp(.35+(performance.now()-this.chargeStart)/1400,.35,1);
   this.updateAim();
   this.fire();
  };
  stage.addEventListener('pointerup',release);
  stage.addEventListener('pointercancel',()=>{this.charging=false});
  window.addEventListener('resize',()=>this.resize());
 }
 resize(){
  if(!this.app)return;
  const b=this.stage.getBoundingClientRect();
  if(b.width&&b.height)this.app.resizeCanvas(Math.round(b.width),Math.round(b.height));
 }
 updateAim(){
  const a=this.aim;
  this.cursor.style.left=(a.x*100)+'%';this.cursor.style.top=(a.y*100)+'%';
  this.charge.style.left=(a.x*100)+'%';this.charge.style.top=(a.y*100)+'%';
  this.charge.textContent=this.charging?'FORÇA '+Math.round(this.power*100)+'%':'';
 }
 start({house='A',bow='classico',cfg,index,level,onShot}){
  this.house=house;this.bowType=bow;this.cfg=cfg||this.cfg;this.roundIndex=index||0;
  this.level=level||'iniciante';this.onShot=onShot;this.started=true;this.busy=false;
  this.aim={x:.50,y:.49};this.roundStarted=performance.now();
  this.updateAim();this.stage.classList.add('arena-live');this.resize();
  if(this.bow&&this.mat){
   const [base,trim]=shades[house]||shades.A;
   for(const item of this.bow.children){if(item.name==='recurve limb')item.render.material=this.mat(bow==='real'?'#653d29':bow==='vento'?'#658ba4':base);
    if(item.name==='metal inlay')item.render.material=this.mat(trim);}
  }
  this.frame(0);
 }
 frame(dt){
  if(this.charging){
   this.power=clamp(.35+(performance.now()-this.chargeStart)/1400,.35,1);
   this.updateAim();
  }
  const time=clamp((performance.now()-this.roundStarted)/1000,0,120);
  const level=this.level,index=this.roundIndex;
  const moving=level==='avancado'?2.05*Math.sin(time*1.35+index*1.11):
   level==='lendario'?2.6*Math.sin(time*1.61+index*1.11):0;
  const vertical=level==='lendario'?.36*Math.sin(time*.83+index*1.14):0;
  if(this.target){
   // Distância da rodada determina escala VISUAL, sem mover o ponto de mira.
   const s=clamp(Math.pow(30/(this.cfg.distance||30),.34),.72,1.35);
   this.target.setLocalScale(s,s,s);
   this.target.setLocalPosition(moving*.12+(this.cfg.shift||0)*1.3,vertical*.2, -13.5);
   if(this.camera?.camera){
    const center=this.camera.camera.worldToScreen(this.target.getPosition().clone().add(new this.pc.Vec3(0,1.95*s,.23)));
    const edge=this.camera.camera.worldToScreen(this.target.getPosition().clone().add(new this.pc.Vec3(1.075*s,1.95*s,.23)));
    const bounds=this.stage.getBoundingClientRect();
    const canvasBounds=this.canvas.getBoundingClientRect();
    const sx=bounds.width/(canvasBounds.width||bounds.width),sy=bounds.height/(canvasBounds.height||bounds.height);
    const x=center.x*sx,y=center.y*sy,r=Math.abs(edge.x-center.x)*sx;
    if(Number.isFinite(x)&&Number.isFinite(y)&&r>15){
     this.targetCenter={x:x/bounds.width,y:y/bounds.height,r:r/bounds.width,px:x,py:y,pr:r};
     this.fallback.style.left=(x/bounds.width*100)+'%';
     this.fallback.style.top=(y/bounds.height*100)+'%';
     this.fallback.style.width=(r*2)+'px';
    }
   }
  }else{
   const bounds=this.stage.getBoundingClientRect();
   this.targetCenter={x:.50,y:.46,r:.13,px:bounds.width*.5,py:bounds.height*.46,pr:Math.min(bounds.width,bounds.height)*.13};
  }
 }
 fire(){
  if(this.busy)return;
  const bounds=this.stage.getBoundingClientRect();
  const target=this.targetCenter;
  const x=this.aim.x*bounds.width,y=this.aim.y*bounds.height;
  const radius=target.pr||Math.min(bounds.width,bounds.height)*.13;
  // Posição exata do ponteiro, relativa ao alvo VISÍVEL.
  const dx=(x-(target.px||bounds.width*.50))/radius;
  const dy=(y-(target.py||bounds.height*.46))/radius;
  const time=clamp((performance.now()-this.roundStarted)/1000,0,120);
  const power=this.power;
  this.busy=true;this.stage.classList.add('shot-in-flight');
  const trail=document.createElement('div');trail.className='arrow-flash';
  trail.style.left=this.aim.x*100+'%';trail.style.top=this.aim.y*100+'%';
  this.stage.appendChild(trail);
  setTimeout(()=>{trail.remove();this.stage.classList.remove('shot-in-flight');this.onShot?.({dx,dy,power,time,bow:this.bowType});},390);
 }
 stop(){this.started=false;this.charging=false;this.stage.classList.remove('arena-live')}
 destroy(){this.stop();this.app?.destroy();}
}
