// Cena original do campo de tiro. Usa PlayCanvas Engine 2.23.3 via CDN quando
// disponível. Se a escola estiver sem internet, há uma cena Canvas 2D local.
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export function initScene(canvas, getSettings) {
  let pcMode=false, app=null, targetEntity=null, pc=null, disposed=false;
  const ctx=canvas.getContext('2d', {alpha:false});
  // Se getContext 2D já foi chamado, WebGL não pode ser criado no mesmo canvas.
  // Usamos dois canvases sobrepostos e alternamos conforme o carregamento.
  let glCanvas=null;
  const parent=canvas.parentElement;
  const scene={kind:'2D',setTargetShift(x){if(targetEntity)targetEntity.setLocalPosition(x*16,3,-7);}, draw(){},destroy(){disposed=true; if(app)app.destroy();}};
  function polygon(c, points, fill) { c.beginPath(); c.moveTo(points[0][0],points[0][1]); for(let i=1;i<points.length;i++) c.lineTo(points[i][0],points[i][1]);c.closePath();c.fillStyle=fill;c.fill(); }
  function draw2D(t){
    if(disposed||pcMode)return;
    const W=parent.clientWidth,H=parent.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
    if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)) {canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const s=getSettings()||{};const cx=W*(.5+(s.shift||0)),cy=H*.45;const r=Math.min(H*.26,W*.16)*Math.pow(24/(s.distance||23),.28);
    const sky=ctx.createLinearGradient(0,0,0,H*.73);sky.addColorStop(0,'#398ebf');sky.addColorStop(.65,'#b0dff0');sky.addColorStop(1,'#dcf3d7');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff5c6';ctx.beginPath();ctx.arc(W*.79,H*.19,26,0,7);ctx.fill();
    for(let i=0;i<7;i++){let x=(i*.2-.05)*W+Math.sin(t/8000+i)*8;ctx.fillStyle='#e7f6f2';ctx.beginPath();ctx.ellipse(x,H*.15+Math.sin(i)*16,55,13,0,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(x+26,H*.13,37,11,0,0,7);ctx.fill();}
    polygon(ctx,[[0,H*.51],[W*.16,H*.35],[W*.31,H*.51],[W*.52,H*.29],[W*.73,H*.51],[W*.92,H*.35],[W,H*.46],[W,H*.68],[0,H*.68]],'#648fa0');
    polygon(ctx,[[0,H*.57],[W*.22,H*.39],[W*.4,H*.58],[W*.59,H*.4],[W*.83,H*.58],[W,H*.43],[W,H*.71],[0,H*.71]],'#77a9a3');
    ctx.fillStyle='#548d55';ctx.fillRect(0,H*.53,W,H*.47);
    polygon(ctx,[[W*.38,H*.53],[W*.63,H*.53],[W*.91,H],[W*.08,H]],'#b8a47c');
    // Castelo de treinamento, com bandeiras das Casas.
    function castle(x,y,z,c){ctx.save();ctx.translate(x,y);ctx.scale(z,z);ctx.fillStyle='#8b91a0';ctx.fillRect(-38,-36,76,67);ctx.fillStyle='#b9bdc1';ctx.fillRect(-30,-56,22,66);ctx.fillRect(13,-56,22,66);ctx.fillStyle='#61758e';ctx.beginPath();ctx.moveTo(-35,-56);ctx.lineTo(-19,-78);ctx.lineTo(-4,-56);ctx.fill();ctx.beginPath();ctx.moveTo(9,-56);ctx.lineTo(24,-78);ctx.lineTo(40,-56);ctx.fill();ctx.fillStyle='#334054';ctx.fillRect(-6,-10,15,35);ctx.fillStyle=c;ctx.fillRect(-18,-81,32,14);ctx.restore();}
    castle(W*.13,H*.55,.8,'#f7cb48');castle(W*.87,H*.57,.75,'#eb5b47');
    ctx.fillStyle='#427d47';for(let i=0;i<25;i++){let x=i*W/24,y=H*.60+Math.sin(i*9)*H*.03;ctx.beginPath();ctx.ellipse(x,y,22,34,0,0,7);ctx.fill();}
    // Poste, suporte e sombra.
    ctx.fillStyle='#2a4836';ctx.beginPath();ctx.ellipse(cx,H*.81,r*1.18,r*.26,0,0,7);ctx.fill();
    ctx.strokeStyle='#805637';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(cx,cy+r*.55);ctx.lineTo(cx-r*.41,H*.86);ctx.moveTo(cx,cy+r*.55);ctx.lineTo(cx+r*.41,H*.86);ctx.stroke();
    const rings=['#202333','#f7f5ea','#243042','#f9f9ee','#de3a39','#f8c64c','#ffe6a4'];
    ctx.beginPath();ctx.arc(cx,cy,r*1.09,0,Math.PI*2);ctx.fillStyle='#715035';ctx.fill();
    rings.forEach((color,i)=>{ctx.beginPath();ctx.arc(cx,cy,r*(1-i*.146),0,Math.PI*2);ctx.fillStyle=color;ctx.fill();});
    ctx.strokeStyle='#f5f1cb65';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r*.85,0,7);ctx.stroke();
    // Grama e pequenas flores para textura.
    for(let i=0;i<90;i++){let x=(i*97+21)%W,y=H*.73+((i*53)%(H*.27));ctx.strokeStyle=i%3===0?'#bad472a0':'#396e3e80';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y-5);ctx.moveTo(x,y);ctx.lineTo(x+3,y-6);ctx.stroke();}
    requestAnimationFrame(draw2D);
  }
  requestAnimationFrame(draw2D);
  // Carregamento progressivo: o jogo continua utilizável sem internet.
  (async()=>{
    try {
      pc=await import('https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/+esm');
      if(disposed)return;
      glCanvas=document.createElement('canvas');glCanvas.className='three-canvas';
      Object.assign(glCanvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
      parent.insertBefore(glCanvas,canvas);canvas.style.position='absolute';canvas.style.inset='0';
      app=new pc.Application(glCanvas,{graphicsDeviceOptions:{alpha:false,antialias:true,preferWebGl2:true}});
      app.setCanvasFillMode(pc.FILLMODE_NONE);app.setCanvasResolution(pc.RESOLUTION_AUTO);
      app.scene.ambientLight=new pc.Color(.62,.68,.72);
      app.scene.gammaCorrection=pc.GAMMA_SRGB;
      app.scene.toneMapping=pc.TONEMAP_ACES;
      const cam=new pc.Entity('Câmera de arqueiro'); cam.addComponent('camera',{clearColor:new pc.Color(.53,.78,.95),fov:55,nearClip:.1,farClip:200});cam.setPosition(0,3.25,9);cam.lookAt(0,3,-7);app.root.addChild(cam);
      const sun=new pc.Entity('Sol');sun.addComponent('light',{type:'directional',color:new pc.Color(1,.95,.83),intensity:1.6,castShadows:false});sun.setEulerAngles(48,35,12);app.root.addChild(sun);
      const materials={};function material(hex){if(materials[hex])return materials[hex];const m=new pc.StandardMaterial();const rgb=parseInt(hex.slice(1),16);m.diffuse=new pc.Color(((rgb>>16)&255)/255,((rgb>>8)&255)/255,(rgb&255)/255);m.metalness=.04;m.shininess=20;m.update();return materials[hex]=m;}
      function obj(type,x,y,z,sx,sy,sz,color,parentEntity=app.root,rotation){const e=new pc.Entity(type);e.addComponent('render',{type,material:material(color)});e.setLocalPosition(x,y,z);e.setLocalScale(sx,sy,sz);if(rotation)e.setLocalEulerAngles(...rotation);parentEntity.addChild(e);return e;}
      obj('box',0,-.45,-17,150,.7,160,'#59965b');obj('box',0,-.05,-7,15,.1,26,'#bdac86');
      // Colinas ao fundo e torres.
      for(let i=0;i<12;i++){let x=(i-5.5)*11;let h=9+(i*37%9);obj('cone',x,2,-46,18,h,18,i%2?'#6e99a0':'#789f97');}
      for(const [x,c] of [[-10,'#ecb950'],[10,'#d56046']]){
        obj('box',x,2,-26,6,4,4,'#89929e');
        for(let j of [-2,2]){obj('cylinder',x+j,3.5,-26,2.1,7,2.1,'#a0a6ae');obj('cone',x+j,7.5,-26,3,3.5,3,c);}
        obj('box',x,1,-23.7,1.8,2.8,.1,'#495563');
      }
      // Alvo em camadas circulares, orientado para o arqueiro.
      targetEntity=new pc.Entity('Alvo móvel');targetEntity.setLocalPosition(0,3,-7);app.root.addChild(targetEntity);
      const colors=['#684b35','#202b38','#f8f4e9','#d83e3b','#f9cf51','#fff1b1'];
      const sizes=[6.1,5.7,4.8,3.7,2.4,.95];
      sizes.forEach((size,i)=>obj('cylinder',0,0,i*.077,size,.14,size,colors[i],targetEntity,[90,0,0]));
      obj('cylinder',-1.45,-2.5,-.3,.18,4.6,.18,'#67432f',targetEntity,[0,0,-15]);
      obj('cylinder',1.45,-2.5,-.3,.18,4.6,.18,'#67432f',targetEntity,[0,0,15]);
      for(let i=0;i<18;i++){let x=((i*67)%150-75)/3;const z=-12-((i*23)%36);const h=1.4+(i%3)*.5;obj('cylinder',x,h/2,z,1.4,h,1.4,'#5c6d41');obj('cone',x,h+1.2,z,3,3,3,'#376d47');}
      app.start();app.resizeCanvas(parent.clientWidth,parent.clientHeight);
      new ResizeObserver(()=>{if(app)app.resizeCanvas(parent.clientWidth,parent.clientHeight);}).observe(parent);
      pcMode=true;canvas.style.opacity='0';scene.kind='PlayCanvas 3D';
      console.info('ClassMana: cena PlayCanvas 3D ativada.');
    }catch(err){
      if(glCanvas)glCanvas.remove();if(canvas)canvas.style.opacity='1';
      console.info('ClassMana: modo gráfico local 2D ativo.',err?.message||err);
    }
  })();
  return scene;
}