/**
 * Decorative canvas layer for the ClassMana arena.
 * Birds, house pennants, spectator terraces, embers and shield obstacles.
 * This layer is transparent, cannot intercept shots and never changes scoring.
 */
import {obstacleAt,targetMotion} from './arena-difficulty.js?v=3';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(seed)=>{const x=Math.sin(seed*127.1+3.11)*43758.5453;return x-Math.floor(x)};
const THEMES={
 A:{flag:'#326cb9',gold:'#ffd476',highlight:'#a7d8ff',dark:'#163b66',ambient:'#dfefff',foliage:'#367b45'},
 B:{flag:'#b93227',gold:'#ffcb79',highlight:'#ffaf68',dark:'#65251f',ambient:'#ffc77a',foliage:'#6f683b'},
 C:{flag:'#238758',gold:'#c3ec98',highlight:'#8ff9cb',dark:'#124a3f',ambient:'#d4fff0',foliage:'#367b56'}
};
export function initAtmosphere(stage,read){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:true});
 canvas.className='arena-atmosphere';canvas.setAttribute('aria-hidden','true');
 Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'3',pointerEvents:'none'});
 stage.appendChild(canvas);
 let active=false,frame=0,house='A',raf=0,lastWidth=0,lastHeight=0;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 const birds=Array.from({length:7},(_,i)=>({phase:rand(i+1)*6.28,y:.10+rand(i+6)*.20,size:4+rand(i+11)*7,speed:.3+rand(i+19)*.38}));
 const particles=Array.from({length:48},(_,i)=>({x:rand(i+77),y:rand(i+83),speed:.008+rand(i+97)*.025,size:1.5+rand(i+109)*3,phase:rand(i+131)*Math.PI*2}));
 function dims(){
  const w=Math.max(stage.clientWidth,1),h=Math.max(stage.clientHeight,1),dpr=Math.min(2,devicePixelRatio||1);
  if(w!==lastWidth||h!==lastHeight){lastWidth=w;lastHeight=h;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);return {w,h};
 }
 function cloud(x,y,r){
  ctx.save();ctx.globalAlpha=.07;ctx.fillStyle='#fff';
  for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(x+i*r*.38,y+(i%2)*r*.08,r*.85,r*.36,0,0,Math.PI*2);ctx.fill()}
  ctx.restore();
 }
 function drawBird(x,y,size,flap,palette){
  ctx.save();ctx.translate(x,y);ctx.scale(size/8,size/8);ctx.globalAlpha=.73;
  ctx.strokeStyle=palette.dark;ctx.lineWidth=1.8;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-9,flap);ctx.quadraticCurveTo(-4,-5-Math.abs(flap),0,0);
  ctx.quadraticCurveTo(4,-5-Math.abs(flap),9,flap);ctx.stroke();
  ctx.restore();
 }
 function pennant(x,y,height,palette,t,side){
  const swing=Math.sin(t*1.5+x*.002)*4;
  ctx.save();ctx.lineCap='round';
  ctx.strokeStyle='#59402c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y+height);ctx.lineTo(x,y-height*.1);ctx.stroke();
  ctx.strokeStyle='#d7ad65';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x+2,y+height);ctx.lineTo(x+2,y-height*.1);ctx.stroke();
  const dir=side<0?1:-1;
  ctx.fillStyle=palette.flag;ctx.strokeStyle=palette.gold;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(x,y-height*.09);
  ctx.quadraticCurveTo(x+dir*33,y-height*.20+swing,x+dir*57,y-height*.08+swing);
  ctx.lineTo(x+dir*43,y+height*.16+swing);ctx.quadraticCurveTo(x+dir*18,y+height*.06,x,y+height*.13);
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=palette.gold;ctx.beginPath();ctx.arc(x,y-height*.13,4.5,0,Math.PI*2);ctx.fill();
  ctx.restore();
 }
 function crowd(w,h,palette,t){
  const stageY=h*.67;ctx.save();
  for(const side of [-1,1]){
   const x=side<0?w*.08:w*.92;
   const width=w*.13;
   // Curved layered spectator terraces sit at the edges, not across the aim line.
   const grad=ctx.createLinearGradient(0,stageY,0,stageY+h*.17);
   grad.addColorStop(0,'rgba(27,42,31,.79)');grad.addColorStop(1,'rgba(13,34,36,.65)');
   ctx.fillStyle=grad;ctx.strokeStyle=palette.gold;ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(x-width*.64,stageY+h*.13);ctx.lineTo(x-width*.76,stageY+h*.03);
   ctx.quadraticCurveTo(x,stageY-h*.02,x+width*.76,stageY+h*.03);
   ctx.lineTo(x+width*.64,stageY+h*.13);ctx.closePath();ctx.fill();ctx.stroke();
   for(let k=0;k<15;k++){
    const row=k%2,px=x+((k%7)-3)*width*.18,py=stageY+h*.019+row*h*.042;
    ctx.fillStyle=(k%4===0)?palette.flag:(k%3===0)?palette.gold:palette.dark;
    ctx.beginPath();ctx.arc(px,py,3.6+row*.7,0,Math.PI*2);ctx.fill();
    ctx.fillRect(px-4,py+3,8,9);
    if(k%5===0){
     const lift=4*Math.sin(t*4.5+k);ctx.strokeStyle=palette.gold;ctx.lineWidth=1.4;
     ctx.beginPath();ctx.moveTo(px+4,py+7);ctx.lineTo(px+10,py-3-lift);ctx.stroke();
    }
   }
   pennant(x+side*width*.74,stageY-h*.04,h*.13,palette,t,side);
  }
  ctx.restore();
 }
 function floaties(w,h,palette,t){
  ctx.save();for(let i=0;i<particles.length;i++){
   const p=particles[i],rise=(p.y-t*p.speed)%1,y=(1+rise)%1*h;
   const x=p.x*w+Math.sin(t*.7+p.phase)*w*.021;
   if(x<w*.16||x>w*.84||y<h*.27){
    ctx.fillStyle=house==='B'?'rgba(255,164,53,.53)':house==='C'?'rgba(118,238,174,.36)':'rgba(255,224,153,.32)';
    ctx.beginPath();ctx.arc(x,y,p.size*(house==='B'?.8:.65),0,Math.PI*2);ctx.fill();
   }
  }ctx.restore();
 }
 function drawRail(w,h,m,palette){
  if(!m||m.r<=0)return;
  const x0=m.x,y=m.y+m.r*1.28,r=m.r,len=3.6*r;
  ctx.save();ctx.lineCap='round';
  ctx.strokeStyle='rgba(15,26,30,.55)';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x0-len,y+2);ctx.lineTo(x0+len,y+2);ctx.stroke();
  ctx.strokeStyle='#b9c0af';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x0-len,y);ctx.lineTo(x0+len,y);ctx.stroke();
  ctx.strokeStyle=palette.gold;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x0-len,y-3);ctx.lineTo(x0+len,y-3);ctx.stroke();
  for(const side of [-1,1]){
   const x=x0+side*len;
   ctx.strokeStyle='#69573d';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+r*.60);ctx.stroke();
  }
  ctx.restore();
 }
 function shield(x,y,r,palette,t){
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*2)*.10);
  const width=r*.57,height=r*1.23;
  ctx.shadowColor=palette.dark;ctx.shadowBlur=14;
  const g=ctx.createLinearGradient(-width,-height,width,height);
  g.addColorStop(0,'#f4ead2');g.addColorStop(.42,palette.flag);g.addColorStop(1,palette.dark);
  ctx.fillStyle=g;ctx.lineWidth=Math.max(2,r*.06);ctx.strokeStyle=palette.gold;
  ctx.beginPath();ctx.moveTo(0,-height*.52);ctx.quadraticCurveTo(width*.53,-height*.50,width*.5,0);
  ctx.lineTo(width*.39,height*.39);ctx.lineTo(0,height*.55);
  ctx.lineTo(-width*.39,height*.39);ctx.lineTo(-width*.5,0);
  ctx.quadraticCurveTo(-width*.53,-height*.5,0,-height*.52);
  ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.strokeStyle='#fff6de';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-height*.34);ctx.lineTo(0,height*.34);ctx.moveTo(-width*.32,0);ctx.lineTo(width*.32,0);ctx.stroke();
  ctx.restore();
 }
 function render(now){
  if(!active||document.hidden){raf=0;return}
  const {w,h}=dims(),t=reduced?0:now/1000,palette=THEMES[house]||THEMES.A;
  ctx.clearRect(0,0,w,h);
  cloud(((w*.1+t*3)%(w*1.5))-w*.2,h*.16,w*.12);
  cloud(((w*.7+t*2)%(w*1.5))-w*.2,h*.1,w*.1);
  for(let j=0;j<birds.length;j++){
   const b=birds[j],x=((t*b.speed*24+b.phase*100)%(w+140))-70,y=h*b.y+Math.sin(t*.9+j)*h*.022;
   drawBird(x,y,b.size,Math.sin(t*7+j*2.3)*3,palette);
  }
  crowd(w,h,palette,t);floaties(w,h,palette,t);
  const data=read?.();
  if(data?.level!=='iniciante'&&data?.metrics){
   const m=data.metrics;
   const shift=targetMotion(data.level,data.index||0,data.seconds||0);
   const baseX=m.x-shift.x*m.r,baseY=m.y-shift.y*m.r;
   if(stage.dataset.sceneEngine!=='playcanvas')drawRail(w,h,{x:baseX,y:baseY,r:m.r},palette);
   if(data.level==='lendario'){
    const o=obstacleAt(data.level,data.index||0,data.seconds||0);
    if(o)shield(m.x+o.x*m.r,m.y+o.y*m.r,m.r,palette,t);
   }
  }
  raf=requestAnimationFrame(render);
 }
 return {
  setHouse(k){house=THEMES[k]?k:'A'},
  setActive(v){active=!!v;if(active&&!raf)raf=requestAnimationFrame(render);if(!active&&raf){cancelAnimationFrame(raf);raf=0;ctx.clearRect(0,0,canvas.width,canvas.height)}},
  destroy(){active=false;if(raf)cancelAnimationFrame(raf);canvas.remove();}
 };
}
