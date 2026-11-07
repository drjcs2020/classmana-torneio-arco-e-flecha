/**
 * ClassMana Arena — MP3 oficial escolhido pelo professor + efeitos 3D leves.
 * The first user gesture unlocks Web Audio. Players may mute at any time.
 */
const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
let ctx=null,bus=null,active=false,timer=null,house='A';
let unlocked=false,musicFade=0;
const MUSIC_FILE='assets/sounds/kulakovka-epic-medieval-614879.mp3';
const bgm=new Audio(MUSIC_FILE);bgm.loop=true;bgm.preload='auto';bgm.volume=0;
const AUDIO_TIME_KEY='classmana-music-position-v1';
bgm.addEventListener('loadedmetadata',()=>{
 try{const time=Number(sessionStorage.getItem(AUDIO_TIME_KEY));if(Number.isFinite(time)&&time>0&&time<bgm.duration)bgm.currentTime=time;}catch{}
});
addEventListener('pagehide',()=>{
 try{if(Number.isFinite(bgm.currentTime))sessionStorage.setItem(AUDIO_TIME_KEY,String(bgm.currentTime));}catch{}
});
let enabled=localStorage.getItem('cm_arena_sound')!=='off';
const clips={};
function soundClip(name){
 if(!enabled)return;
 try{
  const audio=clips[name]||(clips[name]=new Audio('assets/sounds/'+name+'.mp3'));
  audio.pause();audio.currentTime=0;audio.volume=name==='vitoria'?.25:.18;
  audio.play().catch(()=>{});
 }catch{}
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function init(){
 if(!enabled||!AudioContextCtor)return null;
 try{
  if(!ctx){
   ctx=new AudioContextCtor();
   bus=ctx.createGain();bus.gain.value=.52;bus.connect(ctx.destination);
  }
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});
  return ctx;
 }catch(error){console.warn('[ClassMana] Som indisponível:',error);return null;}
}
function tone(freq,endFreq,duration,volume=.12,type='sine',delay=0){
 const c=init();if(!c)return;
 const now=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();
 o.type=type;o.frequency.setValueAtTime(Math.max(50,freq),now);
 o.frequency.exponentialRampToValueAtTime(Math.max(50,endFreq),now+duration);
 g.gain.setValueAtTime(.0001,now);
 g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),now+.015);
 g.gain.exponentialRampToValueAtTime(.0001,now+duration);
 o.connect(g);g.connect(bus);o.start(now);o.stop(now+duration+.04);
}
function noise(duration,volume=.12,cutoff=1200,delay=0){
 const c=init();if(!c)return;
 const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate);
 const values=buffer.getChannelData(0);
 for(let i=0;i<values.length;i++)values[i]=(Math.random()*2-1)*Math.min(1,(i+1)/200);
 const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),now=c.currentTime+delay;
 s.buffer=buffer;f.type='lowpass';f.frequency.value=cutoff;
 g.gain.setValueAtTime(.0001,now);
 g.gain.exponentialRampToValueAtTime(volume,now+.02);
 g.gain.exponentialRampToValueAtTime(.0001,now+duration);
 s.connect(f);f.connect(g);g.connect(bus);s.start(now);s.stop(now+duration+.03);
}
function chirp(){
 if(!active||!enabled||document.hidden)return;
 const base=house==='A'?1050:house==='B'?840:1190;
 for(let i=0;i<3;i++)tone(base+i*90,base*1.45+i*100,.10+i*.02,.022,'sine',i*.12);
}
function ambience(){
 clearInterval(timer);timer=null;
 if(!active||!enabled)return;
 init();chirp();
 timer=setInterval(()=>{if(active&&enabled&&!document.hidden)chirp()},5800);
}


// Real recording supplied by the teacher. The synthetic placeholder is removed.
function musicLevel(){
 const target=enabled&&unlocked&&!document.hidden?(active?.045:.28):0;
 if(musicFade)cancelAnimationFrame(musicFade);
 const initial=bgm.volume,started=performance.now(),duration=700;
 function step(now){
  const t=Math.min(1,(now-started)/duration);
  bgm.volume=clamp(initial+(target-initial)*(t*t*(3-2*t)),0,1);
  if(t<1)musicFade=requestAnimationFrame(step);else musicFade=0;
 }
 musicFade=requestAnimationFrame(step);
}
function unlockMusic(){
 if(!enabled||document.hidden)return;
 init();unlocked=true;
 if(bgm.paused)bgm.play().then(musicLevel).catch(err=>console.warn('[ClassMana] MP3 indisponível:',err.message));
 else musicLevel();
}
function unlockOnGeneralGesture(event){
 // Sound buttons have their own click handler. Avoid starting on pointerdown
 // and then immediately muting from the subsequent click of the same gesture.
 const target=event.target;
 if(target instanceof Element&&target.closest('#cm-lobby-sound,#arena-sound'))return;
 unlockMusic();
}
document.addEventListener('pointerdown',unlockOnGeneralGesture,{passive:true});
document.addEventListener('keydown',unlockOnGeneralGesture);
document.addEventListener('touchstart',unlockOnGeneralGesture,{passive:true});

export const arenaAudio={
 get enabled(){return enabled},
 get playing(){return enabled&&unlocked&&!bgm.paused},
 get musicState(){return {playing:this.playing,readyState:bgm.readyState,volume:bgm.volume,source:bgm.currentSrc||bgm.src}},
 start(){unlockMusic();return this.playing},
 setHouse(k){house=['A','B','C'].includes(k)?k:'A'},
 setActive(value){active=!!value;ambience();musicLevel()},
 toggle(){
  enabled=!enabled;localStorage.setItem('cm_arena_sound',enabled?'on':'off');
  if(!enabled){clearInterval(timer);timer=null;bgm.pause();unlocked=false;for(const clip of Object.values(clips)){clip.pause();clip.currentTime=0;}if(bus&&ctx)bus.gain.setTargetAtTime(0,ctx.currentTime,.03);musicLevel();}
  else{init();if(bus&&ctx)bus.gain.setTargetAtTime(.52,ctx.currentTime,.05);ambience();unlockMusic();musicLevel()}
  return enabled;
 },
 play(effect,score=0){
  if(!enabled||document.hidden)return;
  try{
   if(effect==='draw'){tone(185,260,.34,.035,'triangle');noise(.23,.016,400);}
   if(effect==='release'){noise(.26,.16,2500);tone(410,150,.20,.07,'triangle');}
   if(effect==='fly'){noise(.35,.055,3400);tone(760,360,.24,.018,'sine');}
   if(effect==='hit'){
    soundClip('acerto');noise(.13,.15,340);tone(120,73,.18,.12,'triangle');
    if(score>=8){tone(520,780,.23,.07,'sine',.06);tone(660,990,.28,.05,'sine',.16);}
   }
   if(effect==='miss'){soundClip('erro');noise(.18,.08,650);tone(280,190,.15,.025,'sine');}
   if(effect==='applause'){
    soundClip('acerto');
    for(let i=0;i<9;i++)noise(.075,.036+(i%3)*.007,1400,.02+i*.073);
    [500,580,650].forEach((f,i)=>tone(f,f*1.17,.29,.032,'sine',i*.13));
   }
   if(effect==='boo'){
    soundClip('erro');
    for(let i=0;i<4;i++)tone(165+i*15,90+i*7,.31,.040,'sawtooth',i*.11);
   }
   if(effect==='block'){
    noise(.23,.12,1400);tone(710,240,.32,.075,'triangle');tone(1180,650,.20,.035,'sine',.035);
   }
   if(effect==='victory'){soundClip('vitoria');[523,659,784,1047].forEach((n,i)=>tone(n,n*1.03,.31,.065,'triangle',i*.12));}
   if(effect==='defeat'){[293.66,261.63,220,164.81].forEach((n,i)=>tone(n,n*.94,.36,.045,'triangle',i*.18));}
  }catch(error){console.warn('[ClassMana] Falha ao emitir efeito sonoro:',error)}
 }
};
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(timer);timer=null;bgm.pause()}else{ambience();if(unlocked&&enabled)bgm.play().catch(()=>{})}musicLevel()});
