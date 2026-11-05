/**
 * ClassMana — arte independente do motor de jogo.
 * Não modifica pontuação nem dados dos alunos.
 * Só ativa o visual de sprites quando os PNGs e o cenário estão realmente disponíveis.
 */
const ASSET_ROOT='assets/ui/';
const BACKGROUNDS={A:'assets/scenes/aguia.webp',B:'assets/scenes/leao.webp',C:'assets/scenes/dragao.webp'};
const EMBLEMS={A:'brasao-aguia-dourada.png',B:'brasao-leao-de-fogo.png',C:'brasao-dragao-esmeralda.png'};
const LABELS={A:'4º A · ÁGUIA DOURADA',B:'4º B · LEÃO DE FOGO',C:'4º C · DRAGÃO DE ESMERALDA'};
const load=src=>new Promise(resolve=>{
 const img=new Image();
 img.onload=()=>resolve(true);
 img.onerror=()=>resolve(false);
 img.src=src;
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function mountSpriteHUD({onPowerStart=()=>false,onPowerMove=()=>{},onPowerRelease=()=>{},onPause=()=>{}}={}){
 const stage=document.getElementById('stage');
 if(!stage)return {setHouse(){},setPower(){},setPaused(){}};
 const overlay=document.createElement('div');
 overlay.id='cm-sprite-ui';
 overlay.className='cm-sprite-ui';
 overlay.innerHTML=`
  <img class="cm-visual-logo" src="${ASSET_ROOT}hud/logo-torneio.png" alt="ClassMana — Torneio das Três Casas">
  <div class="cm-house-sign" aria-label="Casa selecionada">
    <img class="cm-house-crest" src="${ASSET_ROOT}hud/brasao-aguia-dourada.png" alt="">
    <span class="cm-house-name">4º A · ÁGUIA DOURADA</span>
  </div>
  <div class="cm-force-meter" role="slider" tabindex="0" aria-label="Força do disparo" aria-valuemin="28" aria-valuemax="100" aria-valuenow="28" aria-valuetext="28 porcento">
    <div class="cm-force-channel">
      <div class="cm-force-spectrum"></div>
      <div class="cm-force-clip"><img class="cm-force-gradient" src="${ASSET_ROOT}hud/forca-preenchimento-extra.png" alt=""></div>
      <img class="cm-force-knob" src="${ASSET_ROOT}hud/forca-botao-metálico-extra.png" alt="">
    </div>
    <img class="cm-force-frame" src="${ASSET_ROOT}hud/forca-01-moldura.png" alt="">
    <span class="cm-force-number">28%</span>
  </div>
  <button type="button" class="cm-pause-btn" aria-label="Pausar partida" aria-pressed="false">
    <img src="${ASSET_ROOT}hud/icone-pausar.png" alt="">
  </button>
  <div class="cm-pause-mask" hidden>
    <div class="cm-pause-dialog"><h2>PARTIDA PAUSADA</h2><p>Seu arco está preparado para continuar.</p><button type="button" class="cm-resume-btn">▶ CONTINUAR</button></div>
  </div>
 `;
 stage.append(overlay);
 const slider=overlay.querySelector('.cm-force-meter');
 const knob=overlay.querySelector('.cm-force-knob');
 const clip=overlay.querySelector('.cm-force-clip');
 const number=overlay.querySelector('.cm-force-number');
 const sign=overlay.querySelector('.cm-house-sign');
 const crest=overlay.querySelector('.cm-house-crest');
 const label=overlay.querySelector('.cm-house-name');
 const pause=overlay.querySelector('.cm-pause-btn');
 const pauseMask=overlay.querySelector('.cm-pause-mask');
 const resume=overlay.querySelector('.cm-resume-btn');
 let power=.28,dragging=false,active=false,house='A';
 const setPower=value=>{
  power=clamp(Number(value)||.28,.28,1);
  const pct=Math.round(power*100);
  clip.style.height=pct+'%';
  knob.style.bottom='calc('+pct+'% - 19px)';
  number.textContent=pct+'%';
  slider.setAttribute('aria-valuenow',String(pct));
  slider.setAttribute('aria-valuetext',pct+' por cento');
 };
 const getPowerFromPointer=event=>{
  const r=slider.querySelector('.cm-force-channel').getBoundingClientRect();
  return clamp(1-(event.clientY-r.top)/r.height,.28,1);
 };
 const start=event=>{
  if(!active||!onPowerStart())return;
  event.preventDefault();
  dragging=true;slider.setPointerCapture(event.pointerId);
  const next=getPowerFromPointer(event);setPower(next);onPowerMove(next);
 };
 const move=event=>{
  if(!dragging)return;
  const next=getPowerFromPointer(event);setPower(next);onPowerMove(next);
 };
 const end=event=>{
  if(!dragging)return;
  event.preventDefault();dragging=false;
  const result=getPowerFromPointer(event);setPower(result);onPowerRelease(result);
 };
 slider.addEventListener('pointerdown',start);
 slider.addEventListener('pointermove',move);
 slider.addEventListener('pointerup',end);
 slider.addEventListener('pointercancel',()=>{dragging=false;});
 slider.addEventListener('keydown',event=>{
  if(!active||!['ArrowUp','ArrowDown','Home','End','Enter','Space'].includes(event.code))return;
  event.preventDefault();
  if(event.code==='Enter'||event.code==='Space'){if(onPowerStart())onPowerRelease(power);return}
  if(event.code==='Home')setPower(.28);
  else if(event.code==='End')setPower(1);
  else setPower(power+(event.code==='ArrowUp'?.04:-.04));
  onPowerMove(power);
 });
 const setPaused=value=>{
  const paused=Boolean(value);
  pauseMask.hidden=!paused;
  pause.classList.toggle('is-paused',paused);
  pause.setAttribute('aria-pressed',String(paused));
  pause.setAttribute('aria-label',paused?'Retomar partida':'Pausar partida');
  pause.querySelector('img').src=ASSET_ROOT+'hud/icone-'+(paused?'play':'pausar')+'.png';
  if(paused)resume.focus();
 };
 pause.addEventListener('click',onPause);
 resume.addEventListener('click',onPause);
 async function setHouse(next='A',onScenery=()=>{}){
  const requested=BACKGROUNDS[next]?next:'A';
  house=requested;
  label.textContent=LABELS[house];
  crest.src=ASSET_ROOT+'hud/'+EMBLEMS[house];
  stage.dataset.classmanaHouse=house;
  const photo=BACKGROUNDS[house];
  const [picture,ui]=await Promise.all([load(photo),load(ASSET_ROOT+'hud/forca-01-moldura.png')]);
  // Ignore stale results if the player selected another House while loading.
  if(house!==requested)return;
  active=picture&&ui;
  stage.classList.toggle('cm-art-ready',active);
  if(active)stage.style.setProperty('--cm-game-background','url("'+photo+'")');
  onScenery(active);
 }
 setPower(.28);
 return {setHouse,setPower,setPaused,getPower:()=>power,isReady:()=>active};
}
