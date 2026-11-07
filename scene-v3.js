/**
 * ClassMana • Arena V3 — first-person archery scene.
 * PlayCanvas 2.23+ (WebGL) with visual fallback when CDN/WebGL is unavailable.
 * The scenic backgrounds come from the user's own Batalha dos Monstros V2.5 repository.
 * All interactive entities are actual 3D meshes; bow, string, sight, projectile and target
 * are independent objects so the same arrow can serve the three Houses.
 */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const palettes = {
  A:{body:'#2566bf',trim:'#f4c65d',beam:'#795223',glow:'#b7dbff'},
  B:{body:'#a32218',trim:'#ffd06e',beam:'#543329',glow:'#ff9b45'},
  C:{body:'#107a53',trim:'#bedcce',beam:'#4d4836',glow:'#84ffb3'}
};
const rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16) / 255);

export function initScene(canvas, getSettings) {
  const parent=canvas.parentElement;
  let pc=null, app=null, gl=null, camera=null, bowRoot=null, bowHandle=null, bowString=null, sightAnchor=null,
      arrowLoaded=null, targetRoot=null, impactMarks=[], currentHouse='A', ready=false, destroyed=false,
      aimX=.5, aimY=.46, power=.3, projectile=null, pendingShot=null, animT=0,
      equipment={bow:'classico',arrow:'rubi'},terrainElement=null,ambientProps=[],backdropMode=false,targetStand=null,movingRail=null,targetVisual=null,modelAssets={};
  // O fallback 2D não pode aparecer antes do PlayCanvas: antes ele causava a
  // troca perceptível de arte após alguns segundos.
  const ctx=canvas.getContext('2d', {alpha:true});
  canvas.style.opacity='0';
  parent.dataset.sceneEngine='loading';
  const state={kind:'PlayCanvas + fundo modular',setHouse,setEquipment,setTargetShift,setAim,setPower,setBackdropMode,
    getTargetMetrics, getAimPoint, fire, impact, destroy};
  // Diagnóstico apenas durante testes (?qa=1), sem controles visíveis no jogo.
  if(new URLSearchParams(location.search).has('qa'))parent.cmAimDiagnostic=()=>({
   kind:state.kind,input:{x:aimX,y:aimY},projected:getAimPoint()
  });
  const root=()=>app.root;
  const canvasSize=()=>({w:parent.clientWidth||1050,h:parent.clientHeight||540});

  function targetScale(distance){
    return clamp(Math.pow(30/Math.max(10,distance||30),.65),.31,1.75);
  }
  function getTargetMetrics(){
    const {w,h}=canvasSize(),s=getSettings()||{},distance=s.distance||25,shift=s.shift||0;
    if(ready&&targetRoot)moveTarget();
    if(ready&&camera?.camera&&targetRoot&&gl){
      const scaled=targetRoot.getLocalScale().x;
      const center=targetRoot.getPosition().clone().add(new pc.Vec3(0,0,.052*scaled));
      const a=camera.camera.worldToScreen(center);
      const b=camera.camera.worldToScreen(center.clone().add(new pc.Vec3(1.34*scaled,0,0)));
      // PlayCanvas worldToScreen usa PIXELS CSS do canvas, não o buffer WebGL.
      const kx=w/(gl.clientWidth||w),ky=h/(gl.clientHeight||h),r=Math.abs(b.x-a.x)*kx;
      if(Number.isFinite(a.x)&&Number.isFinite(a.y)&&r>0)return {x:a.x*kx,y:a.y*ky,r};
    }
    const r=Math.min(h*.105,w*.082)*targetScale(distance);
    return {x:w*(.50+shift),y:h*(.45+(s.verticalShift||0)),r};
  }
  function fallbackSightGeometry(){
    const {w,h}=canvasSize(),size=h*.89;
    const bx=w*aimX+115,by=h*aimY+size*.03;
    return {bx,by,size,sightX:bx-115,sightY:by-size*.03};
  }
  function getAimPoint(){
    // Pontuação usa a posição PROJETADA do centro da mira 3D.
    // O ponteiro só comanda o arco: não existe uma segunda mira invisível.
    if(ready&&sightAnchor&&camera?.camera&&app?.graphicsDevice){
      updateBowAim();
      const p=camera.camera.worldToScreen(sightAnchor.getPosition());
      // worldToScreen devolve pixels CSS; width/height do WebGL são pixels
       // físicos e causavam desvios horizontais/verticais com zoom/DPR.
       const width=gl?.clientWidth||canvasSize().w,height=gl?.clientHeight||canvasSize().h;
      if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&width>0&&height>0)
        return {x:clamp(p.x/width,0,1),y:clamp(p.y/height,0,1)};
    }
    return {x:aimX,y:aimY};
  }
  function bowPalette(){
    const base=palettes[currentHouse];
    if(equipment.bow==='real')return {...base,body:'#543527',trim:'#f6c14f'};
    if(equipment.bow==='vento')return {...base,body:'#4d899c',trim:'#d7edf2'};
    return base;
  }
  function arrowPalette(){
    if(equipment.arrow==='esmeralda')return {feather:'#22b78c',secondary:'#b5f9d8'};
    if(equipment.arrow==='solar')return {feather:'#e2a720',secondary:'#fff2a1'};
    return {feather:'#e44037',secondary:'#faf0db'};
  }
  function setEquipment(next={}){
    const bow=['classico','real','vento'].includes(next.bow)?next.bow:'classico',
      arrow=['rubi','esmeralda','solar'].includes(next.arrow)?next.arrow:'rubi';
    if(bow===equipment.bow&&arrow===equipment.arrow)return;
    const rebuild=bow!==equipment.bow;equipment={bow,arrow};
    if(ready&&rebuild&&bowRoot){
      bowRoot.destroy();bowRoot=null;bowString=null;arrowLoaded=null;sightAnchor=null;
      buildBow();
    }
    if(ready)colorBow();
  }
  function setHouse(k){currentHouse=palettes[k]?k:'A';parent.classList.remove('house-a','house-b','house-c');parent.classList.add('house-'+currentHouse.toLowerCase());
    if(ready){colorBow();colorTarget();loadBowModel();}}
  function setTargetShift(){if(ready){moveTarget();for(const old of impactMarks)old.destroy();impactMarks=[];}}
  // Keep the bow, arrow and the bow's own sight fully inside the camera.
  // Moving the mouse to the edge must not push the bow out of the viewport.
  function setAim(x=.5,y=.46){
    aimX=clamp(x,.06,.94);aimY=clamp(y,.08,.92);
    updateBowAim();
  }
  function setPower(value){power=clamp(value,0,1);}
  function setBackdropMode(value){
    backdropMode=Boolean(value);
    if(terrainElement)terrainElement.enabled=!backdropMode;
    for(const prop of ambientProps)prop.enabled=!backdropMode;
  }
  function destroy(){destroyed=true;if(app){app.destroy();app=null;}gl?.remove();}

  // -------- VISUAL FALLBACK: uses art backgrounds, painted metal bow and target. --------
  function roundrect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
  function renderFallback(time){
    if(destroyed||ready)return;
    const {w,h}=canvasSize(),dpr=Math.min(2,devicePixelRatio||1),dw=Math.round(w*dpr),dh=Math.round(h*dpr);
    if(canvas.width!==dw||canvas.height!==dh){canvas.width=dw;canvas.height=dh;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const p=bowPalette(),m=getTargetMetrics();
    // A perspective firing lane, scenic image stays visible around it.
    const grass=ctx.createLinearGradient(0,h*.59,0,h);
    grass.addColorStop(0,'rgba(25,88,45,.10)');grass.addColorStop(.6,'rgba(23,70,35,.29)');grass.addColorStop(1,'rgba(12,46,25,.62)');
    ctx.fillStyle=grass;ctx.beginPath();ctx.moveTo(w*.45,h*.64);ctx.lineTo(w*.55,h*.64);ctx.lineTo(w*.95,h);ctx.lineTo(w*.05,h);ctx.closePath();ctx.fill();
    ctx.save();ctx.strokeStyle='rgba(255,250,188,.51)';ctx.lineWidth=2.5;ctx.setLineDash([14,13]);
    for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(w*.5+s*w*.085,h);ctx.lineTo(w*.5+s*w*.016,h*.65);ctx.stroke();}ctx.restore();
    // Cavaletes apenas no nível inicial, quando o alvo repousa no chão.
    if((getSettings()?.level||'iniciante')==='iniciante'){
      ctx.fillStyle='rgba(12,22,12,.4)';ctx.beginPath();ctx.ellipse(m.x,m.y+m.r*1.9,m.r*.84,m.r*.15,0,0,Math.PI*2);ctx.fill();
      for(const sx of [-.5,.5]){
        const x=m.x+sx*m.r*.85;
        ctx.strokeStyle='#50301d';ctx.lineWidth=m.r*.12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(m.x+sx*m.r*.37,m.y+m.r*.55);ctx.lineTo(x,m.y+m.r*1.86);ctx.stroke();
        ctx.strokeStyle='#ab7e45';ctx.lineWidth=m.r*.045;ctx.beginPath();ctx.moveTo(m.x+sx*m.r*.37-2,m.y+m.r*.55);ctx.lineTo(x-2,m.y+m.r*1.84);ctx.stroke();
      }
    }
    // Straw/woven rim with a ten-ring competition target.
    const shadow=ctx.createRadialGradient(m.x-m.r*.18,m.y-m.r*.18,m.r*.15,m.x,m.y,m.r*1.17);
    shadow.addColorStop(0,'#d5b46c');shadow.addColorStop(.83,'#95622e');shadow.addColorStop(1,'#553c23');
    ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(m.x,m.y,m.r*1.14,0,Math.PI*2);ctx.fill();
    const colors=['#f5f2e3','#191d22','#f5f4e8','#171a20','#168fcb','#1b82b8','#e64033','#cc2d28','#ffcb3c','#ffdd62'];
    colors.forEach((c,i)=>{ctx.beginPath();ctx.arc(m.x,m.y,m.r*(1-i*.097),0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle='rgba(33,28,25,.32)';ctx.lineWidth=.9;ctx.stroke();});
    ctx.beginPath();ctx.arc(m.x,m.y,m.r*.07,0,Math.PI*2);ctx.strokeStyle='#9d682b';ctx.lineWidth=1.4;ctx.stroke();
    ctx.save();ctx.translate(m.x,m.y);for(let i=0;i<64;i++){const a=i*Math.PI*2/64;ctx.strokeStyle=i%3?'rgba(255,212,114,.43)':'rgba(81,46,17,.46)';ctx.lineWidth=i%2?2.2:1.3;ctx.beginPath();ctx.moveTo(Math.cos(a)*m.r*1.03,Math.sin(a)*m.r*1.03);ctx.lineTo(Math.cos(a+.055)*m.r*1.13,Math.sin(a+.055)*m.r*1.13);ctx.stroke();}ctx.restore();
    // Modern recurve bow with metallic grooves, not a wooden longbow.
    const {bx,by,size}=fallbackSightGeometry(),bend=Math.sin(time/1600)*1.3;
    const bladeTop={x:bx-12,y:by-size*.58},bladeBottom={x:bx-10,y:by+size*.58};
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    let metal=ctx.createLinearGradient(bx-35,0,bx+32,0);metal.addColorStop(0,'#17212b');metal.addColorStop(.20,p.body);metal.addColorStop(.43,'#d8e1eb');metal.addColorStop(.62,p.body);metal.addColorStop(1,p.trim);
    ctx.strokeStyle='#141920';ctx.lineWidth=29;ctx.beginPath();ctx.moveTo(bladeTop.x,bladeTop.y);ctx.bezierCurveTo(bx+23,by-size*.3,bx-18,by-size*.13,bx,by);ctx.bezierCurveTo(bx+18,by+size*.16,bx+12,by+size*.35,bladeBottom.x,bladeBottom.y);ctx.stroke();
    ctx.strokeStyle=metal;ctx.lineWidth=22;ctx.stroke();ctx.strokeStyle=p.trim;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(bx+3,by-size*.34);ctx.lineTo(bx+5,by-size*.08);ctx.moveTo(bx+5,by+size*.18);ctx.lineTo(bx+1,by+size*.37);ctx.stroke();
    // Drawn string, rings of an actual circular front sight.
    const pull=power*size*.07;ctx.strokeStyle='#1b1c20';ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(bladeTop.x,bladeTop.y);ctx.lineTo(bx+pull+5,by);ctx.lineTo(bladeBottom.x,bladeBottom.y);ctx.stroke();
    const sightX=bx-115,sightY=by-size*.03,sightR=size*.055;
    ctx.strokeStyle='#25292d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(bx-13,sightY);ctx.lineTo(sightX+sightR,sightY);ctx.stroke();
    ctx.beginPath();ctx.arc(sightX,sightY,sightR,0,Math.PI*2);ctx.strokeStyle='#26292d';ctx.lineWidth=4.2;ctx.stroke();
    ctx.strokeStyle=p.trim;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(sightX,sightY,sightR-3,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(230,239,240,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sightX-sightR+7,sightY);ctx.lineTo(sightX+sightR-7,sightY);ctx.moveTo(sightX,sightY-sightR+7);ctx.lineTo(sightX,sightY+sightR-7);ctx.stroke();
    // Shared black arrow, white/red feathers. Drawn from nocking point toward the target.
    ctx.strokeStyle='#11151d';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(bx+pull+140,by+110);ctx.lineTo(bx-48,by-38);ctx.stroke();
    ctx.strokeStyle='#9baab4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx+pull+135,by+109);ctx.lineTo(bx-48,by-38);ctx.stroke();
    ctx.fillStyle=arrowPalette().feather;ctx.beginPath();ctx.moveTo(bx+pull+140,by+110);ctx.lineTo(bx+pull+118,by+66);ctx.lineTo(bx+pull+100,by+82);ctx.closePath();ctx.fill();
    ctx.fillStyle=arrowPalette().secondary;ctx.beginPath();ctx.moveTo(bx+pull+140,by+110);ctx.lineTo(bx+pull+96,by+91);ctx.lineTo(bx+pull+100,by+112);ctx.closePath();ctx.fill();
    ctx.restore();
    requestAnimationFrame(renderFallback);
  }
  requestAnimationFrame(renderFallback);

  // ----------------- PC SCENE -----------------
  function material(hex,{metal=.0,rough=.55,glow=0,texture=null,transparent=false}={}){
    const c=rgb(hex),m=new pc.StandardMaterial();m.diffuse=new pc.Color(...c);m.metalness=metal;m.gloss=100*(1-rough);
    if(glow)m.emissive=new pc.Color(...c).mulScalar(glow);
    if(texture){m.diffuseMap=texture; m.emissiveMap=texture;m.emissive=new pc.Color(1,1,1);m.useLighting=false;}
    if(transparent){m.blendType=pc.BLEND_NORMAL;m.opacity=.95;m.depthWrite=false;}
    m.update();return m;
  }
  function primitive(type,name,pos,scale,mat,parent=root(),rot){
    const e=new pc.Entity(name);e.addComponent('render',{type,material:mat,castShadows:false,receiveShadows:true});
    e.setLocalPosition(...pos);e.setLocalScale(...scale);if(rot)e.setLocalEulerAngles(...rot);parent.addChild(e);return e;
  }
  function tube(name,points,radii,mat,parent=root(),sides=10){
    // Smooth genuinely curved geometry; tapering sections produce bent composite limbs.
    const pos=[],idx=[],norm=[],up=new pc.Vec3(0,0,1);
    for(let i=0;i<points.length;i++){
      const v=new pc.Vec3(...points[i]),before=new pc.Vec3(...points[Math.max(0,i-1)]),after=new pc.Vec3(...points[Math.min(points.length-1,i+1)]);
      const tangent=after.sub(before).normalize(),aux=Math.abs(tangent.dot(up))>.94?new pc.Vec3(1,0,0):up;
      const u=new pc.Vec3().cross(tangent,aux).normalize(),w=new pc.Vec3().cross(tangent,u).normalize();
      for(let j=0;j<sides;j++){
        const angle=j*Math.PI*2/sides,c=Math.cos(angle),s=Math.sin(angle),normal=new pc.Vec3(u.x*c+w.x*s,u.y*c+w.y*s,u.z*c+w.z*s);
        pos.push(v.x+normal.x*radii[i],v.y+normal.y*radii[i],v.z+normal.z*radii[i]);norm.push(normal.x,normal.y,normal.z);
      }
    }
    for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){
      const a=i*sides+j,b=i*sides+(j+1)%sides;idx.push(a,b,a+sides,b,b+sides,a+sides);
    }
    const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(pos);mesh.setNormals(norm);mesh.setIndices(idx);mesh.update();
    const e=new pc.Entity(name);e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,mat)]});parent.addChild(e);return e;
  }
  function circleMesh(name,radius,depth,mat,parent=root()){
    // Tube around a 2D circular curve, facing towards the player (+Z).
    const pts=[],rs=[];for(let k=0;k<=96;k++){const a=k*Math.PI*2/96;pts.push([Math.cos(a)*radius,Math.sin(a)*radius,0]);rs.push(depth);}return tube(name,pts,rs,mat,parent,8);
  }
  function grainCanvas(kind='target'){
    const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');
    if(kind==='wood'){
      x.fillStyle='#986a3d';x.fillRect(0,0,1024,1024);
      for(let i=0;i<260;i++){x.strokeStyle=i%4?'rgba(58,34,14,.11)':'rgba(245,206,132,.17)';x.lineWidth=1+i%4;
        let yy=(i*53)%1024;x.beginPath();x.moveTo(0,yy);for(let j=0;j<14;j++)x.lineTo(j*80,yy+Math.sin(j*.75+i)*4);x.stroke();}
    }else{
      x.clearRect(0,0,1024,1024);const cx=512,cy=512,r=480;
      const rings=['#eee9d8','#27282b','#f1eee4','#25272b','#109aca','#157fb1','#e34838','#cd3133','#ffd04c','#ffda59'];
      for(let i=0;i<rings.length;i++){x.beginPath();x.arc(cx,cy,r*(1-i*.098),0,7);x.fillStyle=rings[i];x.fill();}
      for(let j=0;j<9;j++){x.beginPath();x.arc(cx,cy,r*(.902-j*.098),0,7);x.strokeStyle='rgba(12,20,19,.32)';x.lineWidth=1.6;x.stroke();}
      for(let i=0;i<4300;i++){
        const a=(i*137.51)*Math.PI/180,rr=Math.sqrt((i*97%4300)/4300)*r*.95,px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;
        x.fillStyle=i%2?'rgba(255,255,255,.06)':'rgba(0,0,0,.045)';x.fillRect(px,py,1.5,1.2);
      }
      x.beginPath();x.arc(cx,cy,r*.045,0,7);x.strokeStyle='#b67b25';x.lineWidth=3;x.stroke();
    }
    const t=new pc.Texture(app.graphicsDevice,{width:1024,height:1024,format:pc.PIXELFORMAT_RGBA8,mipmaps:true});t.setSource(c);return t;
  }
  function terrainTexture(){
    const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
    const colors={A:['#4a7c37','#70a94b','#244d2b'],B:['#66513b','#90764b','#352a28'],C:['#326d52','#579c6a','#203e37']}[currentHouse];
    g.fillStyle=colors[0];g.fillRect(0,0,512,512);
    let seed=14203;
    const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
    for(let i=0;i<8600;i++){
      const x=rand()*512,y=rand()*512,alpha=.08+rand()*.24;
      g.globalAlpha=alpha;g.fillStyle=colors[1+(i%2)];
      if(currentHouse==='B'){g.fillRect(x,y,1+rand()*4,1+rand()*9);}
      else{g.beginPath();g.moveTo(x,y);g.lineTo(x-2+rand()*4,y-3-rand()*10);g.strokeStyle=colors[1+i%2];g.lineWidth=.5+rand()*1.4;g.stroke();}
    }
    if(currentHouse==='B'){
      for(let j=0;j<28;j++){
        let x=rand()*512,y=rand()*512;g.strokeStyle='#2d2421';g.lineWidth=1+rand()*2;g.beginPath();g.moveTo(x,y);
        for(let k=0;k<7;k++)g.lineTo(x+(k+1)*7,y+Math.sin(k*1.3+j)*8);g.stroke();
      }
    }
    g.globalAlpha=1;
    const t=new pc.Texture(app.graphicsDevice,{width:512,height:512,format:pc.PIXELFORMAT_RGBA8,mipmaps:true});t.setSource(c);return t;
  }
  function colorBow(){if(!bowRoot)return;
    const p=bowPalette();const body=material(p.body,{metal:.72,rough:.20}),trim=material(p.trim,{metal:.83,rough:.20}),vane=arrowPalette();
    const arrowPrimary=material(vane.feather,{metal:.07,rough:.38}),arrowSecondary=material(vane.secondary,{metal:.07,rough:.38});
    for(const e of bowRoot.findComponents('render')){
      const name=e.entity.name.toLowerCase();
      const replacement=name.includes('bow-limb')||name.includes('bow-riser')?body:name.includes('bow-trim')||name.includes('bow-crystal')?trim:name.includes('shared arrow vane')?(name.endsWith('1')?arrowSecondary:arrowPrimary):null;
      if(replacement){e.material=replacement;for(const mesh of e.meshInstances)mesh.material=replacement;}
    }
  }
  function colorTarget(){// Base wood changes by House, scoring colors stay standardized.
    if(!targetRoot)return;const p=palettes[currentHouse],m=material(p.beam,{metal:.08,rough:.84});
    targetRoot.findComponents('render').forEach(e=>{if(e.entity.name.includes('wood')){e.material=m;for(const mesh of e.meshInstances)mesh.material=m;}});
  }
  function moveTarget(){
    if(!targetRoot)return;
    const setting=getSettings()||{},camZ=7,targetZ=-9,{w,h}=canvasSize();
    const units=h/(2*Math.tan(41*Math.PI/360)*(camZ-targetZ));
    const x=((setting.shift||0)*w)/units;
    // Real mesh scale changes with the displayed distance (not just an HUD label).
    const scale=targetScale(setting.distance);
    targetRoot.setLocalScale(scale,scale,scale);
    // A base do cavalete acompanha a escala da distância e continua no chão.
    const moving=setting.level==='avancado'||setting.level==='lendario';
    const fixedY=-.28+2.02*scale;
    const suspendedY=2.05-(setting.verticalShift||0)*h/units;
    targetRoot.setLocalPosition(x,moving?suspendedY:fixedY,-9);
    if(targetStand)targetStand.enabled=!moving;
    parent.dataset.targetStand=moving?'suspended':'standing';
    if(movingRail)movingRail.enabled=moving;
  }
  function buildWorld(){
    const metals={wood:material('#634124',{rough:.8}),woodlight:material('#a2703f',{rough:.8}),rope:material('#d5ae64',{rough:.89}),iron:material('#1d2329',{metal:.73,rough:.31}),silver:material('#c8d2d7',{metal:.82,rough:.19}),red:material('#da332d'),white:material('#f4f2e7')};
    targetRoot=new pc.Entity('Target assembly');root().addChild(targetRoot);moveTarget();
    const d=new pc.Entity('Competition target visual');targetRoot.addChild(d);targetVisual=d;
    targetStand=new pc.Entity('Removable target ground stand');
    d.addChild(targetStand);
    // Cavaletes permanecem apenas no alvo FIXO. O alvo suspenso usa trilho,
    // sem pernas de madeira flutuando.
    tube('left wood leg',[[-.50,-1.97,-.28],[-.38,-1.20,-.17],[-.18,-.40,-.12]],[.10,.085,.07],metals.wood,targetStand,12);
    tube('right wood leg',[[.5,-1.97,-.28],[.38,-1.20,-.17],[.18,-.40,-.12]],[.10,.085,.07],metals.wood,targetStand,12);
    tube('cross wood beam',[[-.50,-1.2,-.18],[0,-1.2,-.18],[.5,-1.2,-.18]],[.065,.067,.065],metals.woodlight,targetStand,10);
    tube('rear wood support',[[0,-2.02,-.69],[0,-1.1,-.48],[0,-.15,-.25]],[.065,.064,.058],metals.wood,targetStand,10);
    movingRail=new pc.Entity('Suspended target sliding rail');
    root().addChild(movingRail);
    // Trilho compacto, colocado acima do alvo: sem estrutura gigante cobrindo a paisagem.
    tube('steel horizontal rail',[[-3.25,3.85,-9.5],[0,3.85,-9.5],[3.25,3.85,-9.5]],[.035,.040,.035],metals.iron,movingRail,12);
    for(const dx of [-3.25,3.25]){
      tube('support rail post '+dx,[[dx,-.28,-9.5],[dx,1.7,-9.5],[dx,3.85,-9.5]],[.045,.043,.041],metals.wood,movingRail,10);
    }
    movingRail.enabled=false;
    // Body of compressed hay and thick jute rope; target is genuinely spatial.
    primitive('cylinder','woven straw body',[0,0,-.085],[2.7,.25,2.7],material('#946732',{rough:.95}),d,[90,0,0]);
    circleMesh('rope bevel outline',1.365,.055,metals.rope,d);
    for(let j=0;j<16;j++){
      const a=j*Math.PI*2/16;const x=Math.cos(a)*1.35,y=Math.sin(a)*1.35;
      tube('jute braid '+j,[[x,y,.072],[x*1.011,y*1.011,.12],[Math.cos(a+.05)*1.34,Math.sin(a+.05)*1.34,.18]],[.011,.01,.009],j%3?metals.rope:metals.woodlight,d,6);
    }
    // Competition target texture and registered rings (white / black / blue / red / yellow).
    const tm=material('#ffffff',{texture:grainCanvas(),transparent:true});tm.opacityMap=tm.diffuseMap;tm.opacityMapChannel='a';tm.alphaTest=.08;tm.update();
    primitive('plane','competition target textile',[0,0,.052],[2.68,1,2.68],tm,d,[90,0,0]);
    primitive('cylinder','target center brass pin',[0,0,.085],[.07,.027,.07],metals.rope,d,[90,0,0]);
    // Cast shadow and rich near-field environment, no primitive cube/cone trees.
    // Textured 3D firing ground anchors the camera and target in physical space;
    // the high-detail Kingdom painting remains the distant environment/sky.
    const fieldTexture=terrainTexture();
    const grass=new pc.StandardMaterial();grass.diffuse=new pc.Color(1,1,1);grass.diffuseMap=fieldTexture;
    grass.diffuseMapTiling=new pc.Vec2(3,4);grass.metalness=0;grass.gloss=4;grass.update();
    terrainElement=primitive('plane','procedural textured playing field',[0,-.28,-7],[40,1,36],grass);terrainElement.enabled=!backdropMode;
    const line=material(currentHouse==='B'?'#d48e54':'#dddab4',{rough:.87});
    for(const side of [-1,1]){
      const stripe=tube('range boundary stripe '+side,[[side*2.85,-.245,6],[side*2.0,-.245,-1],[side*1.15,-.245,-11]],
      [.023,.022,.017],line,root(),7);ambientProps.push(stripe);stripe.enabled=!backdropMode;
    }

    const brass=material('#dba84d',{metal:.65,rough:.23});
    const rocks=material('#56574d',{rough:.93});
    for(let side of [-1,1])for(let i=0;i<3;i++){
      const z=-3-i*4.2,x=side*(3.8-i*.36),scale=1.0-i*.14;
      const base=new pc.Entity('Range prop');base.setLocalPosition(x,0,z);root().addChild(base);ambientProps.push(base);base.enabled=!backdropMode;
      tube('wooden fence post',[[0,-.38,0],[0,.32,0],[0,.75,0]],[.12*scale,.105*scale,.09*scale],metals.wood,base);
      primitive('sphere','fence cap bronze',[0,.76,0],[.17,.16,.17],brass,base);
      // Torch glows and slow animated ambient fire sprite.
      if(i===1){primitive('sphere','torch flame',[0,.86,0],[.19,.29,.19],material(currentHouse==='B'?'#ff7b15':'#ffc24b',{glow:.8}),base);}
    }
    for(let i=0;i<16;i++){
      const z=-3-i*.55,x=(i%2?-1:1)*(2.1+(i%5)*.12);
      const stone=primitive('sphere','natural stone '+i,[x,-.19,z],[.20+i%3*.08,.13+i%2*.08,.22],rocks);ambientProps.push(stone);stone.enabled=!backdropMode;
    }
    // Set house color and look immediately.
    buildBow();colorBow();colorTarget();
    loadTargetModel();
  }
  function buildBow(){
    bowRoot=new pc.Entity('Modern competition recurve bow');
    camera.addChild(bowRoot);
    // Modelo proporcional ao enquadramento; não deve ocupar toda a tela.
    bowRoot.setLocalScale(.43,.43,.43);
    bowRoot.setLocalPosition(.46,-.15,-2.7);
    const pp=bowPalette(),body=material(pp.body,{metal:.79,rough:.19}),gold=material(pp.trim,{metal:.9,rough:.18}),
      dark=material('#1b1c20',{metal:.46,rough:.35}),silver=material('#d5e0e7',{metal:.88,rough:.23}),red=material('#dc342a'),ivory=material('#faf0db');
    const p=[[0,-1.52,0],[.045,-1.35,0],[.12,-.99,.035],[.105,-.55,.02],[.055,-.16,0],[.018,.18,0],[.075,.62,.02],[.09,1,.02],[.02,1.37,.02],[0,1.52,0]];
    tube('bow-limb curved compound',p,p.map((_,i)=>(i===4||i===5?.07:.038)*(equipment.bow==='real'?1.32:equipment.bow==='vento'?.73:1)),body,bowRoot,16);
    tube('bow-trim upper line',[[.062,.25,-.028],[.115,.88,-.021],[.05,1.39,.025]],[.01,.011,.007],gold,bowRoot);
    tube('bow-trim lower line',[[.062,-.2,-.028],[.118,-.90,-.021],[.04,-1.36,.025]],[.01,.011,.007],gold,bowRoot);
    const grip=primitive('cylinder','ergonomic dark handgrip',[.03,-.12,-.08],[.17,.43,.13],dark,bowRoot,[0,0,90]);
    // Sight rig: ring placed left of riser, towards player, distinct from 2D crosshair.
    tube('sight bridge',[[-.02,.25,-.08],[-.57,.25,-.08],[-1.12,.25,-.08]],[.013,.012,.009],dark,bowRoot);
    // Visão em primeira pessoa: o corpo do arco fica à direita do alvo,
    // enquanto o anel da mira acompanha exatamente o ponteiro.
    const sight=new pc.Entity('Circle aiming sight');sight.setLocalPosition(-1.15,.25,-.08);bowRoot.addChild(sight);sightAnchor=sight;
    circleMesh('sight black metal ring',.088,.007,dark,sight);
    circleMesh('sight gilded inner rim',.078,.0026,gold,sight);
    tube('sight vertical line',[[0,-.044,.003],[0,0,.003],[0,.044,.003]],[.0009,.0009,.0009],silver,sight,5);
    tube('sight horizontal line',[[-.044,0,.003],[0,0,.003],[.044,0,.003]],[.0009,.0009,.0009],silver,sight,5);
    primitive('sphere','sight central dot',[0,0,.005],[.006,.006,.006],red,sight);
    // A single arrow asset: its colors DO NOT change when changing House.
    arrowLoaded=new pc.Entity('Shared red-and-white arrow');bowRoot.addChild(arrowLoaded);arrowLoaded.setLocalPosition(.02,-.03,-.40);
    tube('black arrow shaft',[[0,0,.53],[0,0,.18],[0,0,-.65]],[.012,.012,.011],dark,arrowLoaded,12);
    primitive('cone','machined arrow point',[0,0,-.70],[.036,.09,.036],silver,arrowLoaded,[90,0,0]);
    const fin=[[.0,.0,.47],[.076,.042,.26],[0,0,.16]],vanes=arrowPalette(),primary=material(vanes.feather),secondary=material(vanes.secondary);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      tube('shared arrow vane '+i,fin.map(([x,y,z])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),z]),[.023,.038,.014],i===1?secondary:primary,arrowLoaded,6);
    }
    // String gets physical tension by shifting central guide while aiming.
    bowString=tube('tensioned carbon cord',[[0,-1.51,.03],[-.11,0,.45],[0,1.51,.03]],[.004,.004,.004],dark,bowRoot,7);
    bowRoot.__fallbacks=[...bowRoot.children];
    loadBowModel();
  }
  // Use the approved GLB assets; keep the procedural geometry only as a WebGL fallback.
  const houseModelNames={A:'aguia_dourada',B:'leao_de_fogo',C:'dragao_de_esmeralda'};
  function loadModel(url,then){
    if(!app||destroyed)return;
    if(modelAssets[url]){then(null,modelAssets[url]);return;}
    app.assets.loadFromUrl(url,'container',(err,asset)=>{
      if(destroyed)return;
      if(!err&&asset?.resource){modelAssets[url]=asset.resource;then(null,asset.resource);}
      else{console.warn('[ClassMana] GLB fallback:',url,err);then(err||new Error('GLB missing'));}
    });
  }
  function loadTargetModel(){
    const holder=targetRoot;
    loadModel('models3d/alvo_suspenso_sem_cavalete.glb',(err,resource)=>{
      if(err||holder!==targetRoot||!targetVisual)return;
      const model=resource.instantiateRenderEntity();
      model.name='Approved floating target GLB';
      model.setLocalScale(1.22,1.22,1.22);
      model.setLocalPosition(0,0,.06);
      holder.addChild(model);
      // The GLB has no stand. Keep the physical wooden tripod as a sibling of
      // the target mesh, so fixed targets never float after model loading.
      if(targetStand&&targetStand.parent===targetVisual){
        holder.addChild(targetStand);
      }
      if(targetStand){
        const moving=setting.level==='avancado'||setting.level==='lendario';
        targetStand.enabled=!moving;
      }
      targetVisual.enabled=false;
      parent.dataset.glbTarget='ready';
      parent.dataset.targetStand=targetStand?.enabled?'standing':'suspended';
    });
  }
  function loadArrowModel(owner){
    const filename='models3d/flecha_'+houseModelNames[currentHouse]+'.glb';
    const identity=currentHouse;
    loadModel(filename,(err,resource)=>{
      if(err||!owner||owner!==bowRoot||identity!==currentHouse||!arrowLoaded)return;
      const arrow=arrowLoaded;
      if(arrow.__mesh3d)arrow.__mesh3d.destroy();
      const entity=resource.instantiateRenderEntity();
      entity.name='Approved House arrow GLB';
      entity.setLocalScale(.42,.42,.42);
      entity.setLocalEulerAngles(0,180,0); // GLB +Z tip becomes in-game -Z tip.
      arrow.addChild(entity);
      for(const child of arrow.children){if(child!==entity)child.enabled=false;}
      arrow.__mesh3d=entity;
      parent.dataset.glbArrow='ready';
    });
  }
  function loadBowModel(){
    const owner=bowRoot,identity=currentHouse;
    if(!owner)return;
    if(owner.__mesh3d){owner.__mesh3d.destroy();owner.__mesh3d=null;}
    for(const child of owner.__fallbacks||[])child.enabled=true;
    parent.dataset.glbBow='loading';
    const filename='models3d/arco_'+houseModelNames[identity]+'.glb';
    loadModel(filename,(err,resource)=>{
      if(err||owner!==bowRoot||identity!==currentHouse)return;
      const model=resource.instantiateRenderEntity();
      model.name='Approved House bow and sight GLB';
      model.setLocalScale(1,1,1);
      model.setLocalPosition(-.54,.19,0);
      model.setLocalEulerAngles(0,180,0);
      owner.addChild(model);
      owner.__mesh3d=model;
      for(const child of owner.__fallbacks||[]){
        if(child!==arrowLoaded)child.enabled=false;
      }
      parent.dataset.glbBow='ready';
      loadArrowModel(owner);
    });
  }

  function updateBowAim(){
    if(!ready||!camera?.camera||!bowRoot)return;
    const {w,h}=canvasSize(),dx=aimX-.5,dy=aimY-.45,t=performance.now()*.001;
    // Converter o PONTEIRO para o mesmo raio da câmera em que o alvo é renderizado:
    // o retículo metálico 3D coincide com o pixel CSS apontado, sem ajuste manual.
    const depth=2.70;
    // screenToWorld EXIGE pixels CSS do canvas (offsetWidth/offsetHeight).
    // Usar width/height do buffer multiplicava a mira pelo DPR da tela.
    const cssW=gl?.clientWidth||w;
    const cssH=gl?.clientHeight||h;
    const sightWorld=camera.camera.screenToWorld(aimX*cssW,aimY*cssH,depth);
    const sightLocal=camera.getWorldTransform().clone().invert().transformPoint(sightWorld);
    bowRoot.setLocalEulerAngles(-dy*2,dx*2,Math.sin(t*1.7)*.1);
    const scale=bowRoot.getLocalScale().x;
    const offset=bowRoot.getLocalRotation().transformVector(new pc.Vec3(-1.15*scale,.25*scale,-.08*scale));
    bowRoot.setLocalPosition(sightLocal.sub(offset));
    if(arrowLoaded)arrowLoaded.setLocalPosition(.02,-.03,-.40+.36*power);
    if(bowString)bowString.setLocalPosition(0,0,.19*power);
  }
  function update3D(dt){if(!ready)return;animT+=dt;
    if(targetRoot)moveTarget();
    updateBowAim();
    if(projectile&&pendingShot){const s=pendingShot;s.elapsed+=dt;const t=clamp(s.elapsed/s.duration,0,1);
      // Ballistic arc with exact launch and impact positions. Height and velocity
      // use the same derivative so the arrow's point rises, levels out and drops.
      const arc=s.arcHeight;
      const pos=new pc.Vec3().lerp(s.start,s.end,t);
      pos.y+=4*arc*t*(1-t);
      projectile.setPosition(pos);
      const direction=new pc.Vec3(
        s.end.x-s.start.x,
        s.end.y-s.start.y+4*arc*(1-2*t),
        s.end.z-s.start.z
      );
      if(direction.lengthSq()>1e-7){
        direction.normalize();
        // The modeled arrow tip points along local -Z, as does PlayCanvas lookAt.
        projectile.lookAt(pos.clone().add(direction));
      }
      if(t>=1){projectile.enabled=false;pendingShot=null;if(arrowLoaded)arrowLoaded.enabled=true;s.done?.();}}
  }
  function impact({x=.5,y=.45,score=0}={}){
    if(!ready||!targetRoot||score<=0)return;
    const {w,h}=canvasSize(),m=getTargetMetrics(),ppu=m.r/1.34;
    const lx=((x*w-m.x)/ppu),ly=-((y*h-m.y)/ppu);
    const e=new pc.Entity('Embedded arrow at impact');targetRoot.addChild(e);e.setLocalPosition(lx,ly,.15);
    const approved=modelAssets['models3d/flecha_'+houseModelNames[currentHouse]+'.glb'];
    if(approved){
      const arrow3d=approved.instantiateRenderEntity();
      arrow3d.name='Approved embedded House arrow GLB';
      arrow3d.setLocalScale(.42,.42,.42);
      arrow3d.setLocalPosition(.10,-.08,.75);
      arrow3d.setLocalEulerAngles(0,180,0);
      e.addChild(arrow3d);impactMarks.push(e);return;
    }
    const dark=material('#1b2228',{metal:.45,rough:.35}),red=material('#e33d31'),white=material('#eee7cf');
    tube('embedded carbon shaft',[[0,0,0],[.11,-.11,.37],[.23,-.18,.76]],[.015,.014,.011],dark,e,8);
    tube('embedded red vane',[[.19,-.15,.65],[.27,-.16,.74],[.23,-.18,.77]],[.024,.026,.012],red,e,6);
    tube('embedded white vane',[[.20,-.18,.64],[.29,-.20,.72],[.23,-.18,.77]],[.024,.027,.012],white,e,6);
    impactMarks.push(e);
  }
  function createArrowProjectile(){
    if(!app)return null;
    const e=new pc.Entity('Flying arrow projectile');
    const shaft=material('#14181d',{metal:.43,rough:.32}),tip=material('#e4e7e8',{metal:.85,rough:.18}),red=material('#df3934'),white=material('#e8dfc9');
    tube('projectile shaft',[[0,0,.36],[0,0,.05],[0,0,-.52]],[.012,.012,.011],shaft,e,10);
    primitive('cone','projectile arrow point',[0,0,-.55],[.038,.08,.038],tip,e,[90,0,0]);
    for(let i=0;i<3;i++){let a=i*Math.PI*2/3;
      tube('projectile feathers '+i,[[0,0,.3],[Math.cos(a)*.09,Math.sin(a)*.09,.21],[0,0,.11]],[.01,.024,.01],i===1?white:red,e,5);
    }
    root().addChild(e);
    const resource=modelAssets['models3d/flecha_'+houseModelNames[currentHouse]+'.glb'];
    if(resource){
      const model=resource.instantiateRenderEntity();
      model.name='Approved flying arrow GLB';
      model.setLocalScale(.42,.42,.42);
      model.setLocalEulerAngles(0,180,0);
      e.addChild(model);
      for(const child of e.children){if(child!==model)child.enabled=false;}
    }
    return e;
  }
  async function fire({x=.5,y=.45,power:shotPower=1}={}){
    if(destroyed)return;
    if(!ready) return new Promise(resolve=>setTimeout(resolve,370));
    if(pendingShot)return;
    if(!projectile) projectile=createArrowProjectile();
    const {w,h}=canvasSize(),target=targetRoot.getPosition().clone(),m=getTargetMetrics();
    const ppu=m.r/1.34;
    const scale=targetRoot.getLocalScale().x;
    const toX=target.x+((x*w-m.x)/ppu)*scale,toY=target.y-((y*h-m.y)/ppu)*scale;
    const start=arrowLoaded?.getPosition().clone()||new pc.Vec3(.52,1.64,5.05);
    const end=new pc.Vec3(toX,toY,target.z+.42*scale);
    if(arrowLoaded)arrowLoaded.enabled=false;
    projectile.enabled=true;projectile.setPosition(start);projectile.setEulerAngles(0,0,0);
    const meters=getSettings()?.distance||30;
    const duration=.43+.42*Math.pow(Math.max(10,meters)/80,.56)+.13*(1-shotPower);
    const trajectory=Math.pow(Math.max(10,meters)/30,.45);
    // Both slopes must be visible even when the target is above the bow.
    const arcHeight=Math.max(.37*trajectory,.28+Math.abs(end.y-start.y)*.42);
    return new Promise(resolve=>{pendingShot={start,end,arcHeight,elapsed:0,duration,done:resolve};});
  }

  (async()=>{
    try{
      pc=await import('https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/+esm');
      if(destroyed)return;
      gl=document.createElement('canvas');gl.className='world3d';
      Object.assign(gl.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1'});
      parent.insertBefore(gl,canvas);canvas.style.position='absolute';canvas.style.inset='0';canvas.style.zIndex='2';
      app=new pc.Application(gl,{graphicsDeviceOptions:{alpha:true,antialias:true,preserveDrawingBuffer:false,preferWebGl2:true}});
      app.setCanvasFillMode(pc.FILLMODE_NONE);app.setCanvasResolution(pc.RESOLUTION_AUTO);
      app.graphicsDevice.maxPixelRatio=Math.min(window.devicePixelRatio||1,1.8);
      app.scene.ambientLight=new pc.Color(.72,.73,.73);
      app.scene.gammaCorrection=pc.GAMMA_SRGB;app.scene.toneMapping=pc.TONEMAP_ACES;
      camera=new pc.Entity('Player first person camera');camera.addComponent('camera',{clearColor:new pc.Color(0,0,0,0),fov:41,nearClip:.04,farClip:100});
      camera.setPosition(0,1.74,7);camera.lookAt(0,1.63,-9);
      root().addChild(camera);
      const sun=new pc.Entity('Soft daylight');sun.addComponent('light',{type:'directional',intensity:2.1,color:new pc.Color(1,.92,.79),castShadows:false});sun.setEulerAngles(35,-28,0);root().addChild(sun);
      const fill=new pc.Entity('Cool bounced light');fill.addComponent('light',{type:'directional',intensity:.55,color:new pc.Color(.56,.78,1)});fill.setEulerAngles(150,30,0);root().addChild(fill);
      buildWorld();app.start();app.resizeCanvas(parent.clientWidth,parent.clientHeight);
      app.on('update',update3D);
      const obs=new ResizeObserver(()=>{if(app)app.resizeCanvas(parent.clientWidth,parent.clientHeight);});obs.observe(parent);
      app.on('destroy',()=>obs.disconnect());
      ready=true;state.kind='PlayCanvas 3D';canvas.style.opacity='0';
      parent.classList.add('engine-ready');
      parent.dataset.sceneEngine='playcanvas';
      parent.dispatchEvent(new CustomEvent('classmana:scene-ready',{detail:{engine:'playcanvas'}}));
      const status=document.querySelector('.arena-status');if(status)status.textContent='✦ ARENA 3D ATIVA';
      console.info('[ClassMana] Arena 3D iniciou com PlayCanvas.');
    }catch(error){
      console.warn('[ClassMana] WebGL indisponível, mantendo cena ilustrada:',error);
      gl?.remove();gl=null;app?.destroy();app=null;ready=false;canvas.style.opacity='1';
      parent.dataset.sceneEngine='fallback';
      parent.dispatchEvent(new CustomEvent('classmana:scene-ready',{detail:{engine:'fallback',error:String(error)}}));
      const status=document.querySelector('.arena-status');if(status)status.textContent='✦ MODO COMPATÍVEL';
    }
  })();
  setHouse('A');
  return state;
}