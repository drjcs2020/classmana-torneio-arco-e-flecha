/* ClassMana cinematics — based on the submitted prototype's emberRise / VS /
   WebAudio ideas, adapted to the existing vanilla-JS + Railway game. */
const houses={
 A:{name:'ÁGUIA DOURADA',short:'4º A',color:'#7fc9ff'},
 B:{name:'LEÃO DE FOGO',short:'4º B',color:'#ff9d6c'},
 C:{name:'DRAGÃO DE ESMERALDA',short:'4º C',color:'#80e9aa'}
};
const getHouse=id=>houses[id]?id:'A';
const portrait=(house,gender='m')=>{
 const family={A:'aguia-dourada',B:'leao-de-fogo',C:'dragao-de-esmeralda'}[getHouse(house)];
 const actor=(gender==='f'||gender==='female')?'arqueira':'arqueiro';
 return 'assets/ui/characters/'+actor+'-'+family+'.png';
};
const node=(tag,className,text)=>{
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=String(text);
 return el;
};
function emberLayer(host,house,count=16){
 const layer=node('div','cm-embers');
 layer.setAttribute('aria-hidden','true');
 layer.dataset.house=getHouse(house);
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  const rng=i=>Math.abs(Math.sin(i*19.19+7.713));
  for(let i=0;i<Math.min(100,count);i++){
   const dot=node('span','cm-ember'),v=rng(i+1);
   dot.style.setProperty('--ember-x',(4+92*rng(i+10)).toFixed(1)+'%');
   dot.style.setProperty('--ember-size',(2.8+6.5*v).toFixed(1)+'px');
   dot.style.setProperty('--ember-duration',(3.4+5.4*rng(i+31)).toFixed(2)+'s');
   dot.style.setProperty('--ember-delay',(-9*rng(i+46)).toFixed(2)+'s');
   dot.style.setProperty('--ember-drift',(-72+144*rng(i+64)).toFixed(0)+'px');
   dot.style.setProperty('--ember-opacity',(.65+.35*v).toFixed(2));
   layer.append(dot);
  }
 }
 host.prepend(layer);
 return layer;
}
/** Lightweight continuous atmosphere, using the same emberRise effect as VS.
 * House A: arcane blue sparks; B: glowing fire embers; C: emerald magic.
 * Decorative only: never intercepts clicks, gestures or gameplay physics. */
function mountAmbient(host,house='A',count=56){
 if(!host)return null;
 const existing=host.querySelector(':scope > .cm-ambient-embers');
 if(existing){
  existing.dataset.house=getHouse(house);
  return existing;
 }
 const layer=emberLayer(host,house,count);
 layer.classList.add('cm-ambient-embers');
 return layer;
}
function setAmbientHouse(house){
 for(const layer of document.querySelectorAll('.cm-ambient-embers')){
  layer.dataset.house=getHouse(house);
 }
}
function fighter(person){
 const house=getHouse(person.house);
 const card=node('article','cm-vs-fighter');
 card.dataset.house=house;
 const img=node('img');
 img.alt='Arqueiro estilo gibi da Casa '+houses[house].name;
 img.src=portrait(house,person.gender);
 const info=node('div','cm-vs-fighter-info');
 info.append(node('strong','',person.name||'Arqueiro'),
             node('small','',houses[house].short+' · '+houses[house].name));
 card.append(img,info);
 return card;
}
let activeDialog=null;
function versus(config){
 // The actual challenge must already be validated/created by the existing API.
 if(activeDialog)return Promise.resolve(false);
 const own={name:config.player,house:config.house,gender:config.gender};
 const rival={name:config.rival,house:config.rivalHouse,gender:config.rivalGender};
 const outer=node('div','cm-vs-overlay');
 outer.id='cm-vs-overlay';
 outer.setAttribute('role','dialog');
 outer.setAttribute('aria-modal','true');
 outer.setAttribute('aria-labelledby','cm-vs-title');
 outer.dataset.house=getHouse(own.house);
 const embers=emberLayer(outer,config.house,52);
 const shell=node('div','cm-vs-shell');
 const title=node('h2','cm-vs-title',config.mode==='bot'?'DESAFIO DE TREINO':'DUELO ENTRE ARQUEIROS');
 title.id='cm-vs-title';
 const sub=node('p','cm-vs-sub','🏹 CINCO FLECHAS • MAIOR PONTUAÇÃO VENCE');
 const fighters=node('div','cm-vs-fighters');
 const versusSign=node('div','cm-vs-mark','VS');
 fighters.append(fighter(own),versusSign,fighter(rival));
 const actions=node('div','cm-vs-actions');
 const start=node('button','cm-vs-start','▶ INICIAR DUELO');
 start.id='cm-vs-start';start.type='button';
 const cancel=node('button','cm-vs-cancel','← VOLTAR');
 cancel.id='cm-vs-cancel';cancel.type='button';
 actions.append(start,cancel);
 shell.append(title,sub,fighters,actions,node('p','cm-vs-note','O convite só é enviado uma vez. O placar permanece vinculado ao jogador.'));
 outer.append(shell);document.body.append(outer);
 const previousFocus=document.activeElement;
 activeDialog=outer;
 try{config.sound?.('banner')}catch{}
 start.focus();
 return new Promise(resolve=>{
  let done=false;
  const complete=bool=>{
   if(done)return;done=true;
   outer.removeEventListener('keydown',keys);
   activeDialog=null;outer.remove();previousFocus?.focus?.();
   if(bool)try{config.sound?.('versus')}catch{}
   else try{config.sound?.('back')}catch{}
   resolve(bool);
  };
  const keys=event=>{
   if(event.key==='Escape'){event.preventDefault();complete(false);}
   if(event.key==='Tab'){
    const target=event.shiftKey?(document.activeElement===start?cancel:start):(document.activeElement===cancel?start:cancel);
    event.preventDefault();target.focus();
   }
  };
  outer.addEventListener('keydown',keys);
  start.addEventListener('click',()=>complete(true),{once:true});
  cancel.addEventListener('click',()=>complete(false),{once:true});
 });
}
function resultView({player,house,rival,rivalHouse,ownShots=[],rivalShots=[],opponent='—'}){
 const finish=document.getElementById('finish');
 if(!finish)return;
 finish.classList.add('cm-cinematic-result');
 const card=finish.querySelector('.finish-card');if(!card)return;
 card.querySelector('.cm-final-duel')?.remove();
 card.querySelector('.cm-embers')?.remove();
 emberLayer(card,house,17);
 const wrap=node('div','cm-final-duel');
 const playerPortrait=document.getElementById('hud-archer-image')?.getAttribute('src');
 const left=resultPerson(player,house,ownShots,undefined,playerPortrait);
 const right=resultPerson(rival||'Adversário',rivalHouse,rivalShots,opponent);
 wrap.append(left,node('div','cm-final-vs','VS'),right);
 const anchor=card.querySelector('#finish-results');
 if(anchor)anchor.before(wrap);else card.append(wrap);
}
function resultPerson(name,house,shots,score,selectedPortrait){
 const article=node('div','cm-final-player'),img=node('img');
 img.src=selectedPortrait||portrait(house);img.alt='Arqueiro da Casa '+houses[getHouse(house)].name;
 article.append(img,node('b','',name),node('small','',houses[getHouse(house)].name));
 if(Array.isArray(shots)&&shots.length){
  const strip=node('div','cm-final-shots');strip.setAttribute('aria-label','Pontuação das cinco flechas');
  for(const item of shots.slice(0,5))strip.append(node('span','',Number(item?.score??item)||0));
  article.append(strip);
 }
 if(score!==undefined&&score!=='—')article.append(node('small','',String(score)+' pontos'));
 return article;
}
function impactSparkle(stage,x,y,score,house){
 if(!stage||score<8||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const area=node('div','cm-impact-sparks');area.style.left=(x*100)+'%';area.style.top=(y*100)+'%';
 area.dataset.house=getHouse(house);
 for(let i=0;i<12;i++){
  const spark=node('span');spark.style.setProperty('--sz',(3+i%3*2)+'px');
  spark.style.setProperty('--tx',(-38+i*7)+'px');
  spark.style.setProperty('--duration',(.55+(i%5)*.12)+'s');
  spark.style.left=(-20+i*4)+'px';
  spark.style.animationDelay=(i%4)*.04+'s';
  area.append(spark);
 }
 stage.append(area);setTimeout(()=>area.remove(),1450);
}
function bindMenuSound(sound){
 document.addEventListener('click',event=>{
  const element=event.target instanceof Element?event.target.closest('button'):null;
  if(!element||element.disabled||element.id==='cm-vs-start'||element.id==='cm-vs-cancel')return;
  if(/sound|som/.test(element.id||''))return;
  try{sound('click')}catch{}
 });
}
export const cinematics={versus,resultView,impactSparkle,bindMenuSound,mountAmbient,setAmbientHouse};
