import {initScene} from './scene-v3.js?v=ground43';
import {CIRCUITS,LEVELS,targetMotion,obstacleBlocks,distanceDifficulty,flightSeconds} from './arena-difficulty.js?v=3';
import {arenaAudio} from './arena-audio.js?v=media38';
import {initAtmosphere} from './arena-atmosphere.js?v=no-crowd15';
import {online} from './online-client.js?v=api10';
import {mountSpriteHUD} from './sprite-hud.js?v=1';
const $=id=>document.getElementById(id);
const H={A:{grade:'4º A',name:'Águia Dourada',color:'#78bdff'},B:{grade:'4º B',name:'Leão de Fogo',color:'#ff9778'},C:{grade:'4º C',name:'Dragão de Esmeralda',color:'#8defac'}};
const R=window.CLASSMANA_ROSTER||{A:[],B:[],C:[]};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
let house='A',view='inicio',scene=null,atmosphere=null,match=null,reticle={x:.50,y:.45},pointerStart=0,holding=false,storage=[],spriteHud=null;
function chargePower(){const t=((Date.now()-pointerStart)/900)%2;return clamp(.28+.72*(t<=1?t:2-t),.28,1)}
const EQUIPMENT={
 bows:{classico:'Arco Clássico',real:'Arco Real',vento:'Arco dos Ventos'},
 arrows:{rubi:'Pena Rubra',esmeralda:'Esmeralda',solar:'Flecha Solar'}
};
const BOW_RULES={
 classico:{wind:1,ring:1,bonus:0,description:'equilibrado: mira estável e pontuação padrão'},
 real:{wind:1,ring:1.12,bonus:1,description:'+1 ponto por acerto (máximo 10), exige maior precisão'},
 vento:{wind:.5,ring:1,bonus:0,description:'reduz o desvio causado pelo vento em 50%'}
};
function readEquipment(){
 try{const x=JSON.parse(localStorage.getItem('classmana-archery-equipment-v1')||'{}');
  return {bow:EQUIPMENT.bows[x.bow]?x.bow:'classico',arrow:'rubi'};}
 catch{return {bow:'classico',arrow:'rubi'}}
}
let equipment=readEquipment();
function applyEquipment(){
 for(const el of document.querySelectorAll('[data-equip-bow]')){
  const choice=el.dataset.equipBow??el.dataset.equipArrow;
  const active=el.dataset.equipBow?choice===equipment.bow:choice===equipment.arrow;
  el.classList.toggle('chosen',active);el.setAttribute('aria-pressed',String(active));
 }
 const status=$('equipment-summary');
 if(status)status.textContent='✓ '+EQUIPMENT.bows[equipment.bow]+' — '+BOW_RULES[equipment.bow].description+'. Flecha oficial igual para todos.';
 scene?.setEquipment?.(equipment);
}
function chooseEquipment(key,value){
 if(match?.running&&view==='arena'){toast('Personalize o equipamento antes de iniciar a próxima rodada.');return}
 if(key!=='bow'||!EQUIPMENT.bows[value])return;
 equipment={bow:value,arrow:'rubi'};
 try{localStorage.setItem('classmana-archery-equipment-v1',JSON.stringify(equipment))}catch{}
 applyEquipment();
}
let incoming=null,scoreTab='players',onlineInbox=[],onlineLoading=false,startMatchPending=false;
let identifiedPlayerId='';
const CM_ACTIVE_STUDENT='cm_active_student_v1';
const CM_INTERNAL_RETURN='cm_internal_duel_return_v1';
function cmMarkInternalReturn(){try{sessionStorage.setItem(CM_INTERNAL_RETURN,'1')}catch{}}
function cmCanContinue(){
 try{
  const nav=performance.getEntriesByType('navigation')[0];
  const internal=sessionStorage.getItem(CM_INTERNAL_RETURN)==='1';
  sessionStorage.removeItem(CM_INTERNAL_RETURN);
  return internal&&nav?.type!=='reload';
 }catch{return false}
}
function cmSessionId(){try{return sessionStorage.getItem(CM_ACTIVE_STUDENT)||''}catch{return ''}}
function cmSaveStudent(id){try{sessionStorage.setItem(CM_ACTIVE_STUDENT,id)}catch{}}
function cmForgetStudent(){try{sessionStorage.removeItem(CM_ACTIVE_STUDENT);sessionStorage.removeItem('cm_active_archery_match_v1')}catch{}}
const TEAMS=window.CLASSMANA_TEAMS||{};
const cmNavigationType=performance.getEntriesByType('navigation')[0]?.type;
const cmIsLobby=document.body.dataset.page==='lobby';
const cmResumeSameStudent=cmIsLobby&&cmCanContinue();
if(cmIsLobby&&!cmResumeSameStudent){online.logout();cmForgetStudent();}
if(document.body.dataset.page==='arena'&&cmNavigationType==='reload'){
 online.logout();cmForgetStudent();location.replace('./');
}

const rand=(a,b)=>a+Math.random()*(b-a);
function safeRead(){try{const a=JSON.parse(localStorage.getItem('classmana-archery-v2'));return Array.isArray(a)?a.filter(x=>x&&typeof x==='object').slice(-150):[]}catch{return []}}
storage=safeRead();
function persist(row){storage.push({...row,at:new Date().toISOString()});storage=storage.slice(-150);try{localStorage.setItem('classmana-archery-v2',JSON.stringify(storage))}catch{}renderRanking()}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3100)}
function openView(name){
 if(name==='inicio'&&document.body.dataset.page==='arena'){
  try{sessionStorage.removeItem('cm_active_archery_match_v1')}catch{}
  cmMarkInternalReturn();window.location.assign('./');return;
 }
 // Two separate HTML pages: lobby and arena. Ranking and rules are overlays.
 if(name!=='arena'&&view==='arena'&&match?.running){
  match.running=false;match.locked=false;holding=false;
  $('stage').classList.remove('aiming','firing');scene?.setPower(0);
 }
 arenaAudio.setActive(name==='arena');atmosphere?.setActive(name==='arena');
 view=name;
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
 document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
 if(name==='ranking')renderRanking();
}
function setLobbyStep(step){
 if(!['perfil','reino','heroi','desafio','partida'].includes(step))return;
 const el=$('view-inicio');if(!el)return;
 el.dataset.step=step;
 cmShowActiveSession();
 document.querySelectorAll('[data-lobby-step]').forEach(button=>{
  const active=button.dataset.lobbyStep===step;
  button.classList.toggle('chosen',active);button.setAttribute('aria-selected',String(active));
 });
}
function cmShowActiveSession(){
 const panel=$('cm-previous-session');if(!panel)return;
 const id=identifiedPlayerId||cmSessionId(),player=id&&choices(id[0]).find(p=>p.id===id);
 const valid=Boolean(player);
 panel.hidden=!valid;
 const label=$('cm-previous-session-name');
 if(label)label.textContent=valid?'Sessão atual: '+player.name+' · 4º '+id[0]:'';
}
function drawCourse(){
 const el=$('lobby-course');if(!el)return;
 const level=$('challenge-level')?.value||'iniciante';
 const path=CIRCUITS[level]||CIRCUITS.iniciante;
 el.innerHTML='<svg class="course-route" viewBox="0 0 900 90" preserveAspectRatio="none" aria-hidden="true"><path d="M36 67 C 140 67 148 18 260 30 S 445 79 515 52 S 705 10 860 50" fill="none" stroke="#764f27" stroke-width="15" stroke-linecap="round"/><path d="M36 67 C 140 67 148 18 260 30 S 445 79 515 52 S 705 10 860 50" fill="none" stroke="#fbe8b0" stroke-width="10" stroke-linecap="round"/></svg>'+
  path.map((d,i)=>'<span class="course-node '+(i===0?'chosen':'')+'">'+(i===4?'🏆':'🎯')+' <b>'+d+'m</b></span>').join('');
 el.setAttribute('aria-label',LEVELS[level].title+': '+path.join(', ')+' metros');
}

function choices(h){return (R[h]||[]).map((name,i)=>({id:h+String(i+1).padStart(2,'0'),name}));}
function fillPlayer(wanted){
 const sel=$('player'),quick=$('cm-quick-player');
 const valid=choices(house),previous=sel.value;
 const selected=[identifiedPlayerId,wanted,previous,online.user?.id].find(id=>valid.some(p=>p.id===id))||'guest';
 sel.innerHTML='<option value="guest">Selecione seu nome</option>'+valid.map(p=>`<option value="${p.id}">${p.name} · ${p.id}</option>`).join('');
 sel.value=selected;
 if(quick){
  quick.innerHTML='<option value="">Selecione seu nome para disputar</option>'+valid.map(p=>`<option value="${p.id}">${p.name} · ${p.id}</option>`).join('');
  quick.value=selected==='guest'?'':selected;
 }
 fillRivals();
}
function fillRivals(){
 const mode=$('mode').value,same=mode==='challenge_same',teams=mode==='challenge_team',myId=$('player').value;
 const myTeam=TEAMS[myId]||'',all=Object.keys(H),scope=$('team-scope').value;
 const rivals=all.filter(h=>h!==house),houses=mode==='challenge'?rivals:teams&&scope==='other'?rivals:[house];
 const houseSelect=$('opponent-house'),priorHouse=houseSelect.value;
 houseSelect.innerHTML=houses.map(h=>`<option value="${h}">${H[h].grade} · ${H[h].name}</option>`).join('');
 if(houses.includes(priorHouse))houseSelect.value=priorHouse;
 const enemyHouse=houseSelect.value||house;
 const ownTeamField=$('my-team'),ownTeams=[...new Set(choices(house).map(p=>TEAMS[p.id]))].filter(Boolean).sort();
 ownTeamField.innerHTML=ownTeams.map(t=>`<option value="${t}">${t}</option>`).join('');
 if(myTeam)ownTeamField.value=myTeam;
 const opposingTeamField=$('opponent-team'),priorTeam=opposingTeamField.value;
 const availableTeams=[...new Set(choices(enemyHouse).map(p=>TEAMS[p.id]))].filter(t=>t&&(enemyHouse!==house||t!==myTeam)).sort();
 opposingTeamField.innerHTML=availableTeams.map(t=>`<option value="${t}">${t}</option>`).join('');
 if(availableTeams.includes(priorTeam))opposingTeamField.value=priorTeam;
 const old=$('rival').value;
 let pool=same?choices(house):teams?choices(enemyHouse).filter(p=>TEAMS[p.id]===opposingTeamField.value):choices(enemyHouse);
 pool=pool.filter(p=>p.id!==myId);
 $('rival').innerHTML=pool.map(p=>`<option value="${p.id}">${p.name} · ${H[p.id[0]].grade}</option>`).join('');
 if(pool.some(p=>p.id===old))$('rival').value=old;
 const lbl=$('rival-label');
 lbl.firstChild.textContent=teams?'4 · Representante da equipe adversária':same?'4 · Colega da mesma turma':'4 · Adversário de outra turma';
 lbl.querySelector('small').textContent='Selecione o nome do colega; não há senha de desafio.';
}

const ARCHER_SKINS={
 A:{m:"arqueiro-aguia-dourada.png",f:"arqueira-aguia-dourada.png",desc:"Armadura azul e dourada, precisão do vento.",mascot:"Águia Dourada"},
 B:{m:"arqueiro-leao-de-fogo.png",f:"arqueira-leao-de-fogo.png",desc:"Armadura vermelha e dourada, coragem do fogo.",mascot:"Leão de Fogo"},
 C:{m:"arqueiro-dragao-de-esmeralda.png",f:"arqueira-dragao-de-esmeralda.png",desc:"Armadura verde-esmeralda e arco dracônico.",mascot:"Dragão de Esmeralda"}
};
let selectedSkins={};
try{selectedSkins=JSON.parse(localStorage.getItem("classmana-archer-skins-v1")||"{}")||{}}catch{}
function archerGender(){return selectedSkins[house]==="f"?"f":"m"}
function archerImage(){return "assets/ui/characters/"+ARCHER_SKINS[house][archerGender()]}
function refreshArcher(){
 const female=archerGender()==='f',title=(female?'Arqueira':'Arqueiro')+' da '+H[house].name;
 const titleEl=$('hero-preview-name'),desc=$('hero-preview-desc'),img=$('hero-preview-img');
 if(titleEl)titleEl.textContent=H[house].name+' · '+H[house].grade;
 if(desc)desc.textContent=ARCHER_SKINS[house].desc+' Mascote: '+ARCHER_SKINS[house].mascot+'.';
 if(img){const file=archerImage();if(!img.src.endsWith(file))img.src=file;img.alt=title+' de corpo inteiro, segurando o arco';}
 const indicator=$('archer-carousel-indicator');
 const heroNames={A:{m:'Auron',f:'Lyra'},B:{m:'Kael',f:'Valéria'},C:{m:'Thalion',f:'Elara'}};
  const heroName=heroNames[house][female?'f':'m'];
  if(indicator)indicator.textContent=heroName+' · '+(female?'Arqueira':'Arqueiro');
  const portrait=$('hero-preview-img');if(portrait)portrait.title=heroName+' da Casa '+H[house].name;
 const frame=$('hero-preview');if(frame)frame.dataset.house=house;
 const hud=$('hud-archer-image');if(hud){hud.src=archerImage();hud.alt=title;}
}

function chooseArcher(g){
 if(g!=="m"&&g!=="f")return;
 selectedSkins[house]=g;try{localStorage.setItem("classmana-archer-skins-v1",JSON.stringify(selectedSkins))}catch{}
 refreshArcher();
 const p=$('hero-preview');if(p){p.classList.remove('archer-switch-animation');void p.offsetWidth;p.classList.add('archer-switch-animation');}
}
function selectHouse(k){
 if(!H[k])return;
 
 house=k;arenaAudio.setHouse(k);atmosphere?.setHouse(k);
 const lobby=$('view-inicio');if(lobby)lobby.dataset.house=k;
 document.querySelectorAll('.house').forEach(el=>{
  const active=el.dataset.house===k;
  el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));
  el.querySelector('.house-check').textContent=active?'✓ SELECIONADA':'ESCOLHER CASA';
 });
 const stage=$('stage');stage.classList.remove('house-a','house-b','house-c');stage.classList.add('house-'+k.toLowerCase());
 const badge=$('stage-house-badge');if(badge){badge.dataset.house=k;badge.querySelector('img').src=window.CLASSMANA_HOUSES[k].emblem;badge.querySelector('strong').textContent=H[k].name;}
 refreshArcher();
 scene?.setHouse(k);
 spriteHud?.setHouse(k,ready=>{
  document.body.classList.toggle('cm-art-on',Boolean(ready)&&document.body.dataset.page==='arena');
  scene?.setBackdropMode?.(ready);
  if(match)uiHud();
 });
 fillPlayer(incoming?.rivalId?.[0]===k?incoming.rivalId:null);
 // A Casa escolhida define a turma. A escolha do nome vem antes do arqueiro.
}
function isDuel(mode){return mode==='challenge'||mode==='challenge_same'||mode==='challenge_team'}
function goOnlinePortal(mode=$('mode').value,inbox=false){
 window.location.assign(online.portalUrl({house,mode,player:$('player').value,inbox}));
}
function duelKind(mode){return mode==='challenge_same'?'mesma_turma':mode==='challenge_team'?'entre_equipes':'interclasses'}
function duelMode(kind){return kind==='mesma_turma'?'challenge_same':kind==='entre_equipes'?'challenge_team':'challenge'}
function updateMode(){
 const mode=$('mode').value,team=mode==='challenge_team',otherTeam=team&&$('team-scope').value==='other';
 $('difficulty-label').classList.toggle('hidden',mode!=='bot');
 $('rival-label').classList.toggle('hidden',!isDuel(mode));
 $('team-label').classList.toggle('hidden',!team);
 $('team-scope-label').classList.toggle('hidden',!team);
 $('opponent-house-label').classList.toggle('hidden',!(mode==='challenge'||otherTeam));
 $('opponent-team-label').classList.toggle('hidden',!team);
 fillRivals();drawCourse();
}
function byId(id){return choices(id?.[0]||'A').find(x=>x.id===id)?.name||'Arqueiro '+id}
function nameOf(id){return id==='guest'?'Arqueiro convidado':byId(id)}
function renderWind(wind){
 const widget=$('wind');if(!widget)return;
 const speed=Math.abs(wind),still=speed<0.15,left=wind<0;
 widget.classList.toggle('wind-left',!still&&left);
 widget.classList.toggle('wind-right',!still&&!left);
 widget.classList.toggle('wind-calm',still);
 widget.querySelector('.wind-speed').textContent=speed.toFixed(1).replace('.',',')+' km/h';
 const direction=still?'SEM DESVIO':left?'DESVIA À ESQUERDA':'DESVIA À DIREITA';
 widget.querySelector('.wind-direction-text').textContent=direction;
 widget.setAttribute('aria-label','Vento: '+speed.toFixed(1).replace('.',',')+' quilômetros por hora. '+direction.toLowerCase()+'.');
}
function uiHud(){if(!match)return;
 const progress=$('range-progress'),key=match.level+':'+match.scores.length;
 const title=$('range-trail-title'),info=$('range-mode'),badge=$('arena-mode-badge');
 const levelInfo=LEVELS[match.level]||LEVELS.iniciante;
 if(title)title.textContent=levelInfo.icon+' '+levelInfo.title;
 if(info)info.textContent=levelInfo.feature;
 if(badge){badge.textContent=match.level==='iniciante'?'🎯 ALVO FIXO':match.level==='avancado'?'↔ ALVO EM MOVIMENTO':'🛡️ ALVO MÓVEL + ESCUDOS';badge.dataset.level=match.level;}
 $('stage').dataset.level=match.level;
 if(progress&&progress.dataset.current!==key){
   const distances=CIRCUITS[match.level]||CIRCUITS.iniciante;
   progress.innerHTML=distances.map((meters,i)=>`<span class="range-step ${i<match.scores.length?'done':i===match.scores.length?'current':''}" aria-label="Etapa ${i+1}: ${meters} metros">${i<match.scores.length?'✓':'🎯'} ${meters}m</span>`).join('');
   progress.dataset.current=key;
 }
$('hud-player').textContent=match.player+' · '+H[match.house].grade;$('hud-bot').textContent=match.mode==='bot'?'🤖 Robô · '+({easy:'Fácil',medium:'Médio',hard:'Difícil'}[match.difficulty]):match.mode==='practice'?'🎯 Treinamento':match.incoming?'⚔️ '+byId(match.incoming.playerId):'⚔️ '+byId(match.rivalId);$('hud-score').textContent=match.scores.reduce((a,b)=>a+b,0);$('hud-rival').textContent=match.onlineReplay?.length?(match.onlineReplayPoints||0):match.incoming?match.incoming.score:match.mode==='bot'?'?':'—';renderWind(match.wind);const art=$('stage').classList.contains('cm-art-ready'),n=Math.min(match.scores.length+1,5);
 $('distance').textContent=art?Math.round(match.distance)+' m':'🎯 ETAPA '+n+'/5 · '+Math.round(match.distance)+' METROS';
 $('distance').setAttribute('aria-label','Etapa '+n+' de 5: '+Math.round(match.distance)+' metros');
 $('shots').textContent=art?n+' / 5':'🏹 FLECHA '+n+' / 5';
 $('shots').setAttribute('aria-label','Flecha '+n+' de 5');
 const p=holding?chargePower():.28;$('power').textContent='⚡ FORÇA '+Math.round(p*100)+'%';
 if(holding)spriteHud?.setPower(p);
}
function stageSeconds(){
 if(!match)return 0;
 if(Number.isFinite(match.freezeTime))return match.freezeTime;
 return Math.min(120,Math.max(0,(performance.now()-(match.stageStartedAt||performance.now()))/1000));
}
function worldSettings(){
 const level=match?.level||'iniciante',index=match?.scores?.length||0,seconds=stageSeconds();
 const motion=targetMotion(level,index,seconds);
 const stage=$('stage'),w=stage?.clientWidth||1050,h=stage?.clientHeight||540;
 const distance=match?.distance||10,scale=clamp(Math.pow(30/Math.max(10,distance),.65),.31,1.75);
 const radius=Math.min(h*.105,w*.082)*scale,rules=match?.online?.rules??6;
 return {distance,shift:(match?.shift||0)+(rules>=5?motion.x*radius/w:0),
  verticalShift:rules>=5?motion.y*radius/h:0,
  level,shotIndex:index,seconds,house:match?.house||house};
}
function ensureScene(){
 if(!scene)scene=initScene($('world'),worldSettings);
 scene.setHouse(house);scene?.setEquipment?.(equipment);scene?.setBackdropMode?.(spriteHud?.isReady?.()||false);
 if(!atmosphere){
  atmosphere=initAtmosphere($('stage'),()=>({
   level:match?.level||'iniciante',index:Math.min(4,match?.scores?.length||0),
   seconds:stageSeconds(),metrics:scene?.getTargetMetrics?.()
  }));
 }
 atmosphere.setHouse(house);
 atmosphere.setActive(view==='arena');
}
function changeTarget(){
 if(!match)return;
 const cfg=match.online?.settings?.[match.scores.length];
 if(cfg){match.distance=cfg.distance;match.shift=cfg.shift;match.wind=cfg.wind;}
 else{
 match.distance=CIRCUITS[match.level]?.[match.scores.length]||CIRCUITS.iniciante[match.scores.length];
 match.shift=Math.round(rand(-5,5))/100;
 match.wind=Math.round(rand(-4,4)*(.65+Math.pow(match.distance/70,.45)*.55)*10)/10;
}
 match.stageStartedAt=performance.now();match.freezeTime=null;
 scene?.setTargetShift(match.shift);uiHud();
}
async function startMatch(accepted=null){
 if(onlineLoading||startMatchPending)return;
 startMatchPending=true;
 try{
 const fromInbox=accepted&&typeof accepted.id==='string'?accepted:null;
 const mode=fromInbox?duelMode(fromInbox.kind):$('mode').value;
 if(identifiedPlayerId&&online.user&&identifiedPlayerId!==online.user.id){toast('Sessão inconsistente. Encerre e entre novamente.');return}
 let userId=$('player').value,rivalId=fromInbox?(fromInbox.creator.id===online.user?.id?fromInbox.recipient.id:fromInbox.creator.id):$('rival').value,challenge=null;
 if(isDuel(mode)){
  if(!/^[ABC][0-9]{2}$/.test(userId||'')){
    setLobbyStep('perfil');populateIdentityOptions();
    $('cm-identity-player')?.focus();
    toast('Primeiro escolha seu nome na entrada do torneio.');
    return;
  }
  /* API direta: o duelo acontece no GitHub Pages, sem portal Apps Script. */
  if(!online.enabled||online.state!=='ready'){toast('⚠️ '+(online.lastError||'A Arena Online não conseguiu conectar ao Apps Script.'));return}
  if(!online.user||online.user.id!==userId){
    const selected=await loginStudent();
    if(!selected)return;
   }
  userId=online.user.id;
  if(!fromInbox){
   if(!rivalId||!choices(rivalId[0]).some(x=>x.id===rivalId)){toast('Escolha um adversário.');return}
   if(userId===rivalId){toast('Você não pode desafiar a si mesmo.');return}
   if((mode==='challenge_same'&&userId[0]!==rivalId[0])||(mode==='challenge'&&userId[0]===rivalId[0])||
      (mode==='challenge_team'&&userId[0]===rivalId[0]&&TEAMS[userId]===TEAMS[rivalId])){
    toast('Escolha um adversário válido para este tipo de desafio.');return;
   }
  }else if(fromInbox.recipient.id!==userId&&fromInbox.creator.id!==userId){toast('Esse desafio não pertence à sua conta.');return;}
  const requestedAt=Date.now(),kind=duelKind(mode),level=$('challenge-level').value;
  try{
   onlineLoading=true;
   $('start-game').disabled=true;
   $('start-game').setAttribute('aria-busy','true');
   $('start-game').setAttribute('aria-label','Registrando desafio online...');
   $('online-status').textContent='⏳ Registrando convite na planilha online...';
   challenge=fromInbox||await online.create(kind,rivalId,level);
  }catch(error){
   // Se o servidor gravou mas a confirmação se perdeu, recuperar o convite
   // novo pela caixa de entrada sem criar uma segunda disputa.
   if(!fromInbox){
    $('online-status').textContent='⏳ Verificando se o convite foi salvo...';
    try{
     const recent=await online.inbox();
     challenge=recent.find(c=>c.creator?.id===userId&&c.recipient?.id===rivalId&&
       c.kind===kind&&c.level===level&&c.status==='CRIADOR_JOGANDO'&&
       new Date(c.created).getTime()>=requestedAt-4000)||null;
    }catch(recoveryError){console.warn('Não foi possível recuperar convite online:',recoveryError);}
   }
   if(!challenge){
    $('online-status').textContent='⚠️ Falha ao registrar convite: '+error.message;
    toast('Não foi possível confirmar o desafio: '+error.message);
    return;
   }
   toast('✅ Convite recuperado no servidor. Abrindo a arena...');
  }finally{
   onlineLoading=false;
   $('start-game').disabled=false;
   $('start-game').removeAttribute('aria-busy');
   $('start-game').setAttribute('aria-label','Iniciar partida');
   if(challenge)showOnlineStatus();
  }
 }
 if(match?.running){match.running=false;match.locked=false;holding=false;$('stage').classList.remove('aiming','firing');scene?.setPower(0);}
 if(online.user&&isDuel(mode)){userId=online.user.id;selectHouse(userId[0]);$('player').value=userId;}
 match={house:userId==='guest'?house:userId[0],playerId:userId,player:nameOf(userId),mode,difficulty:$('difficulty').value,
  rivalId,scores:[],running:true,locked:false,bow:equipment.bow,wind:0,distance:10,level:challenge?.level||$('challenge-level').value,shift:0,freezeTime:null,stageStartedAt:performance.now(),incoming:null,
  online:challenge,onlineShots:[],onlineReplay:challenge?.recipient.id===userId?challenge.creatorShots:[],
  onlineReplayPoints:0,seed:Math.floor(rand(100000,999999))};
 reticle={x:.50,y:.45};$('finish').classList.add('hidden');
 $('instruction').textContent='MOVA A MIRA DO ARCO • SEGURE PARA PUXAR • SOLTE PARA ATIRAR';
 if(document.body.dataset.page==='lobby'){
  try{
   sessionStorage.setItem('cm_active_archery_match_v1',JSON.stringify(match));
   window.location.assign('./arena.html');
   return;
  }catch(error){console.warn('Navegação entre páginas indisponível:',error)}
 }
 openView('arena');refreshArcher();ensureScene();changeTarget();updateReticle();uiHud();
 }finally{startMatchPending=false;}
}

function updateReticle(){
  // Mouse/touch drives the bow. There is no second, independent crosshair.
  scene?.setAim(reticle.x,reticle.y);
}
function aim(e){
 const rect=$('stage').getBoundingClientRect();
 reticle.x=clamp((e.clientX-rect.left)/rect.width,.06,.94);
 reticle.y=clamp((e.clientY-rect.top)/rect.height,.08,.92);
 updateReticle();
}
function levelScore(x,y,r){const norm=Math.hypot(x,y)/r;return norm>1?0:Math.max(1,10-Math.floor(norm*10))}
function showDuelTurn(text,style='opponent'){
 const stage=$('stage');
 let panel=$('cm-duel-turn');
 if(!panel){panel=document.createElement('div');panel.id='cm-duel-turn';panel.className='cm-duel-turn hidden';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');stage.appendChild(panel)}
 panel.textContent=text;panel.dataset.turn=style;panel.classList.remove('hidden');
 return panel;
}
function hideDuelTurn(){const panel=$('cm-duel-turn');if(panel)panel.classList.add('hidden')}
async function duelTurnPause(ms,currentMatch){
 await new Promise(resolve=>setTimeout(resolve,ms));
 return match===currentMatch&&currentMatch.running;
}
async function fire(power){
 if(!match?.running||match.locked||match.scores.length>=5)return;
 const currentMatch=match,shotIndex=match.scores.length;
 match.freezeTime=stageSeconds();
 match.locked=true;holding=false;$('stage').classList.remove('aiming');
 arenaAudio.play('release');
 const w=$('stage').clientWidth,h=$('stage').clientHeight;
 const t=scene?.getTargetMetrics?.()||{x:w*(.5+match.shift),y:h*.45,r:Math.min(h*.105,w*.082)};
 const sight=scene?.getAimPoint?.();
 if(!sight||!Number.isFinite(sight.x)||!Number.isFinite(sight.y)){match.locked=false;return toast('A mira ainda não está pronta.');}
 const dx=(sight.x*w-t.x)/t.r,dy=(sight.y*h-t.y)/t.r;
 // Round scores online are calculated again by Apps Script using these normalized offsets.
 const activeBow=(!match.online||Number(match.online.rules)>=7)?(match.bow||equipment.bow):'classico';
 const tuning=BOW_RULES[activeBow]||BOW_RULES.classico;
 /* Guardar coordenadas do impacto final, não da mira inicial. */
 const distanceFactor=distanceDifficulty(match.distance);
 const drift=match.wind*tuning.wind*t.r*.040*distanceFactor,fall=(1-power)*t.r*.70*distanceFactor;
 const jitter=match.online?0:(1-power)*t.r*.14*Math.min(2,distanceFactor);
 const ix=sight.x*w+drift+rand(-.08,.08)*jitter;
 const iy=sight.y*h+fall+rand(-.06,.06)*jitter;
 const impactDx=(ix-t.x)/t.r,impactDy=(iy-t.y)/t.r;
 const flight=flightSeconds(match.distance,power);
 const before=targetMotion(match.level,shotIndex,match.freezeTime);
 const after=targetMotion(match.level,shotIndex,match.freezeTime+flight);
 const rules=match.online?.rules??6;
 const landingX=impactDx-(rules>=5?after.x-before.x:0);
 const landingY=impactDy-(rules>=5?after.y-before.y:0);
 const blocked=obstacleBlocks(match.level,shotIndex,match.freezeTime+flight,landingX,landingY);
 const norm=Math.hypot(landingX,landingY)*tuning.ring;
 const base=blocked||norm>1?0:Math.max(1,10-Math.floor(norm*10));
 const score=base>0?Math.min(10,base+tuning.bonus):0;
 if(currentMatch.online)currentMatch.onlineShots.push({dx:landingX,dy:landingY,impactDx:landingX,impactDy:landingY,blocked,power,time:match.freezeTime,bow:activeBow});
 match.freezeTime=null; // The target keeps moving while the arrow flies.
 $('stage').classList.add('firing');arenaAudio.play('fly');
 try{await Promise.race([scene?.fire?.({x:ix/w,y:iy/h,power}),new Promise(resolve=>setTimeout(resolve,1700))]);}
 catch(e){console.warn('Animação da flecha:',e)}
 $('stage').classList.remove('firing');
 if(match!==currentMatch||!currentMatch.running)return;
 scene?.impact?.({x:ix/w,y:iy/h,score,blocked});
 match.scores.push(score);$('hud-score').textContent=match.scores.reduce((a,b)=>a+b,0);
 try{if(document.body.dataset.page==='arena')sessionStorage.setItem('cm_active_archery_match_v1',JSON.stringify(match))}catch{}
 showHit(score,ix/w,iy/h,blocked);
 if(blocked){arenaAudio.play('block');toast('🛡️ O ESCUDO DEFENDEU O ALVO!');}
 else if(score>=8){arenaAudio.play('applause');toast(score===10?'🎯 ACERTO PERFEITO! +10 pontos':'👏 A TORCIDA VIBROU!');}
 else if(score===0){arenaAudio.play('boo');toast('📣 A TORCIDA REAGIU! Tente novamente.');}
 else arenaAudio.play('hit',score);
 // The challenger already completed these five shots. Reproduce them one at a time,
 // with a clear turn announcement after the current student's result.
 const ghost=match.onlineReplay?.[shotIndex];
 if(ghost&&match.online){
  // Let the student's own impact/score remain visible before changing turns.
  if(!await duelTurnPause(1150,currentMatch))return;
  const opponentName=match.online.creator?.name||'ADVERSÁRIO';
  const turnPanel=showDuelTurn('⚔️ VEZ DO ADVERSÁRIO','opponent');
  $('instruction').textContent='⚔️ VEZ DO ADVERSÁRIO • AGUARDE A FLECHA';
  if(!await duelTurnPause(1500,currentMatch)){hideDuelTurn();return;}
  turnPanel.classList.add('hidden');
  if(match!==currentMatch||!currentMatch.running)return;
  const px=(t.x+ghost.impactDx*t.r)/w,py=(t.y+ghost.impactDy*t.r)/h;
  try{await Promise.race([scene?.fire?.({x:px,y:py,power:ghost.power||1}),new Promise(resolve=>setTimeout(resolve,1700))]);}
  catch(e){console.warn('Replay:',e)}
  if(match!==currentMatch||!currentMatch.running)return;
  scene?.impact?.({x:px,y:py,score:ghost.score});
  match.onlineReplayPoints+=Number(ghost.score)||0;
  $('hud-rival').textContent=match.onlineReplayPoints;
  $('instruction').textContent='⚔️ '+opponentName+' • '+ghost.score+' PONTOS';
  showDuelTurn('🎯 ADVERSÁRIO: '+ghost.score+' PONTOS','result');
  if(!await duelTurnPause(1050,currentMatch)){hideDuelTurn();return;}
  hideDuelTurn();
  $('instruction').textContent='🏹 SUA VEZ • MIRE COM O ARCO E SOLTE PARA DISPARAR';
 }
 if(match.scores.length>=5){setTimeout(()=>{if(match===currentMatch&&currentMatch.running)finishMatch()},580);}
 else{setTimeout(()=>{if(match===currentMatch&&currentMatch.running){changeTarget();match.locked=false;}},520);}
}

function showHit(score,x,y,blocked=false){const el=$('hit');el.textContent=blocked?'🛡️ ESCUDO!':score?'+'+score+' PONTOS':'FORA DO ALVO';el.style.left=(x*100)+'%';el.style.top=clamp(y*100-12,18,64)+'%';el.classList.remove('show');void el.offsetWidth;el.classList.add('show')}
function chooseRobotScore(difficulty,playerAverage){const base={easy:5.1,medium:6.7,hard:8.15}[difficulty],adjust=clamp((playerAverage-5.5)*.17,-.7,.7);let result=clamp(base+adjust+rand(-3.3,3.3),0,10);return result>=9.25?10:result>=7?8:result>=5?6:result>=3?4:result>=1.5?2:0;}
function renderFinishScore(own,opponent,opponentLabel='ADVERSÁRIO'){
 const area=$('finish-results');if(!area)return;
 area.replaceChildren();
 const make=(label,value,modifier)=>{
  const cell=document.createElement('div');cell.className='cm-score-cell '+modifier;
  const top=document.createElement('span');top.className='cm-score-label';top.textContent=label;
  const big=document.createElement('strong');big.className='cm-score-value';big.textContent=String(value);
  const unit=document.createElement('span');unit.className='cm-score-unit';unit.textContent=value==='—'||value==='AGUARDANDO'?'':'PONTOS';
  cell.append(top,big,unit);return cell;
 };
 area.classList.add('cm-score-grid');
 area.append(make('VOCÊ',own,'cm-score-own'),make(opponentLabel,opponent,'cm-score-other'));
}
async function finishMatch(){
 if(!match||match.scores.length<5)return;
 const current=match;match.locked=true;const finish=$('finish');finish.classList.remove('hidden');
 // Arte dos resultados é composta por personagens separados, sem painel cobrindo o cenário.
 const heroOwn=$('finish-hero-own'),heroRival=$('finish-hero-rival');
 if(heroOwn){heroOwn.src=archerImage();heroOwn.style.display='block';}
 if(heroRival){
  const opponentHouse=isDuel(match.mode)?String(match.rivalId||'').charAt(0):'';
  const crests={A:'aguia-dourada',B:'leao-de-fogo',C:'dragao-esmeralda'};
  heroRival.style.display=crests[opponentHouse]?'block':'none';
  if(crests[opponentHouse])heroRival.src='assets/ui/crests/brasao-'+crests[opponentHouse]+'.png';
 }
 $('share-result').classList.add('hidden');
 $('share-result').classList.remove('cm-retry');
 if(match.online){
  $('finish-title').textContent='⏳ GRAVANDO RESULTADO NA PLANILHA...';
  $('finish-desc').textContent='Seus disparos estão sendo validados e registrados no placar online.';
  $('finish-results').classList.remove('cm-score-grid');$('finish-results').textContent='🏹 5 / 5 FLECHAS';
  try{
   let response;
   try{response=await online.submit(match.online.id,match.onlineShots);}
   catch(err){
    // If the server recorded the request but the connection dropped, read it back.
    const state=await online.challenge(match.online.id);
    const saved=current.playerId===state.creator.id?state.status==='PENDENTE'||state.status==='CONCLUIDO':state.status==='CONCLUIDO';
    if(!saved)throw err;
    response={score:current.playerId===state.creator.id?state.creatorScore:state.recipientScore,
      shots:current.playerId===state.creator.id?state.creatorShots:state.recipientShots,challenge:state};
   }
   if(match!==current)return;
   current.running=false;current.locked=true;current.onlineSaveFailed=false;
   const ch=response.challenge,total=Number(response.score)||0;
   current.scores=(response.shots||[]).map(x=>Number(x.score)||0);
   const isCreator=current.playerId===ch.creator.id;
   const rival=isCreator?ch.recipientScore:ch.creatorScore;
   let title,desc;
   if(isCreator&&rival===null){
    title='🏹 DESAFIO ENVIADO!';
    desc='Você fez '+total+' pontos. '+ch.recipient.name+' verá o convite ao escolher seu nome e poderá aceitar ou recusar.';
   }else{
    title=total>rival?'🏆 VITÓRIA NO DESAFIO!':total===rival?'🤝 EMPATE HONROSO!':'🏹 CONTINUE TREINANDO!';
    desc='Resultado salvo: '+total+' pontos contra '+rival+' pontos de '+(isCreator?ch.recipient.name:ch.creator.name)+'.';
   }
   $('finish-title').textContent=title;$('finish-desc').textContent=desc;
   if(title.includes('VITÓRIA'))arenaAudio.play('victory');
   else if(rival!==null&&total<rival)arenaAudio.play('defeat');
   renderFinishScore(total,rival===null?'AGUARDANDO':rival);
   $('share-help').textContent='✅ Resultado registrado no servidor do torneio.';
   $('hud-score').textContent=total;$('hud-rival').textContent=rival===null?'—':rival;
   refreshInbox().catch(console.warn);renderRanking().catch(console.warn);
  }catch(error){
   if(match!==current)return;current.onlineSaveFailed=true;current.running=true;
   $('finish-title').textContent='⚠️ RESULTADO AINDA NÃO CONFIRMADO';
   $('finish-desc').textContent='O servidor não confirmou a gravação: '+error.message;
   $('finish-results').classList.remove('cm-score-grid');$('finish-results').textContent='Suas cinco flechas permanecem nesta partida.';
   $('share-help').textContent='Tente salvar novamente antes de sair da arena.';
   $('share-result').classList.remove('hidden');$('share-result').classList.add('cm-retry');$('share-result').textContent='🔄 TENTAR SALVAR NO PLACAR';
  }
  return;
 }
 current.running=false;
 const total=match.scores.reduce((a,b)=>a+b,0),
  bot=match.mode==='bot'?Array.from({length:5},()=>chooseRobotScore(match.difficulty,total/5)):[],
  rivalScore=match.mode==='bot'?bot.reduce((a,b)=>a+b,0):undefined;
 const title=match.mode==='practice'?(total>=37?'MIRA LENDÁRIA!':'TREINAMENTO CONCLUÍDO'):
  total>rivalScore?'🏆 VITÓRIA SOBRE O ROBÔ!':total===rivalScore?'🤝 EMPATE!':'🏹 CONTINUE TREINANDO!';
 $('finish-title').textContent=title;
 $('finish-desc').textContent='Sua pontuação: '+total+' de 50 pontos nesta rodada.';
 renderFinishScore(total,rivalScore===undefined?'—':rivalScore,rivalScore===undefined?'TREINO LIVRE':'ROBÔ');
 $('share-help').textContent='Treino e partidas com robô ficam neste navegador; somente desafios validados entram no ranking oficial.';
 if(match.playerId!=='guest')persist({house:match.house,id:match.playerId,score:total,mode:match.mode,win:rivalScore===undefined?null:total>rivalScore});
 uiHud();
}

function encode(d){const s=JSON.stringify(d),arr=new TextEncoder().encode(s);let bs='';arr.forEach(v=>bs+=String.fromCharCode(v));return btoa(bs).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decode(s){const b=s.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b);return JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0))))}
function createLink(){if(!match)return;const total=match.scores.reduce((a,b)=>a+b,0);let d=match.incoming?{v:2,complete:true,a:{house:match.incoming.house,id:match.incoming.playerId,score:match.incoming.score},b:{house:match.house,id:match.playerId,score:total}}:{v:2,playerId:match.playerId,house:match.house,rivalId:match.rivalId,score:total,seed:match.seed};return `${location.href.split('#')[0]}#duel=${encode(d)}`;}
async function share(){const link=createLink();try{await navigator.clipboard.writeText(link);toast('Link copiado! Envie ao outro arqueiro.')}catch{window.prompt('Copie o link do desafio:',link)}}
function processLink(){try{const h=location.hash;if(!h.startsWith('#duel='))return;const d=decode(h.slice(6));if(d.v!==2)return;if(d.complete){toast('Resultado compartilhado: '+d.a.score+' × '+d.b.score+' pontos.');location.hash='';return}if(typeof d.playerId!=='string'||typeof d.rivalId!=='string'||!H[d.house]||!H[d.rivalId[0]]||d.playerId===d.rivalId||!Number.isInteger(d.score)||d.score<0||d.score>50||!choices(d.house).some(x=>x.id===d.playerId)||!choices(d.rivalId[0]).some(x=>x.id===d.rivalId))return;incoming=d;selectHouse(d.rivalId[0]);$('player').value=d.rivalId;$('mode').value=d.house===d.rivalId[0]?'challenge_same':'challenge';updateMode();$('rival-label').classList.add('hidden');$('difficulty-label').classList.add('hidden');toast('⚔️ Desafio recebido de '+byId(d.playerId)+' — '+d.score+' pontos!');setLobbyStep('partida');}catch(e){console.warn('Desafio inválido',e)}}
const htmlSafe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function renderRanking(){
 const status=$('ranking-status'),classesHost=$('rank-houses'),playersHost=$('rank-players');
 if(!online.enabled){
  status.textContent='⚠️ A API de ranking não está configurada.';
  classesHost.innerHTML='<div class="empty">Placar indisponível.</div>';
  playersHost.innerHTML='<div class="empty">Placar indisponível.</div>';return;
 }
 status.textContent='⏳ Consultando o ranking oficial do torneio...';
 try{
  const data=await online.ranking();
  const matches=Number(data.games)||0;
  const allClasses=Array.isArray(data.classes)?data.classes:[];
  const allTeams=Array.isArray(data.teams)?data.teams:[];
  const allPlayers=Array.isArray(data.players)?data.players:[];
  status.textContent='🏆 '+matches+' duelos concluídos · Atualizado às '+new Date().toLocaleTimeString('pt-BR');
  const groupType=scoreTab==='teams'?'teams':'classes';
  const groups=groupType==='teams'?allTeams:allClasses;
  const houseLabel=groupType==='teams'?'🛡️ Classificação das Equipes':'🏰 Classificação das Turmas';
  const groupHeading=classesHost.closest('.ranking-panel')?.querySelector('h2');
  if(groupHeading)groupHeading.textContent=houseLabel;
  const playerHeading=playersHost.closest('.ranking-panel')?.querySelector('h2');
  if(playerHeading)playerHeading.textContent=scoreTab==='players'?'🏹 Ranking dos Arqueiros':'🏹 Arqueiros em Destaque';
  classesHost.innerHTML=groups.map((row,i)=>`<div class="rankline">
    <div><b>${['🥇','🥈','🥉'][i]||'🏹'} ${htmlSafe(groupType==='classes'?(H[row.name]?.name||row.name):row.name)}</b>
    <small>${row.members||0} integrantes · ${row.plays||0} participações · ${row.total||0} pontos</small></div>
    <span>${row.wins||0} vitórias</span></div>`).join('')||'<div class="empty">Nenhum registro para este grupo.</div>';
  playersHost.innerHTML=allPlayers.slice(0,25).map((p,i)=>`<div class="rankline">
    <div><b>${i+1}º · ${htmlSafe(p.name)}</b>
    <small>${htmlSafe(H[p.house]?.grade||p.house)} · ${htmlSafe(p.team||'Sem equipe')} · ${p.plays||0} partidas</small></div>
    <span>${p.wins||0} V · ${p.losses||0} D · ${p.total||0} pts</span></div>`).join('')||'<div class="empty">Ainda não há duelos concluídos.</div>';
 }catch(err){
  status.textContent='⚠️ Falha ao consultar o ranking no servidor: '+err.message;
  classesHost.innerHTML='<div class="empty">Não foi possível atualizar a classificação.</div>';
  playersHost.innerHTML='<div class="empty">Os resultados registrados não foram apagados. Tente novamente.</div>';
 }
}
function showOnlineStatus(){
 const active=online.enabled&&online.state==='ready',user=online.user;
 $('online-status').classList.toggle('ok',active);
 $('online-status').classList.toggle('error',!active);
 $('online-account-name').textContent=user?'🏹 '+user.name+' · 4º '+user.house+' · '+user.team:'🏹 Escolha seu nome na lista';
 if($('player'))$('player').disabled=Boolean(identifiedPlayerId);
 const exitBtn=$('cm-end-session');if(exitBtn)exitBtn.hidden=!Boolean(identifiedPlayerId);
 $('online-banner').textContent=active?'🟢 PLACAR ONLINE':online.state==='portal'?'⚔️ ENTRAR NA ARENA ONLINE':'⚠️ TORNEIO ONLINE INDISPONÍVEL';
 $('online-status').textContent=online.state==='portal'?'⚔️ Escolha um desafio para entrar na Arena Online do ClassMana.':!online.enabled?'⚠️ Desafios online aguardam a configuração do professor.':
  !active&&online.state==='error'?'⚠️ '+(online.lastError||'Não foi possível conectar ao servidor de desafios.'):
  !active?'⏳ Verificando conexão...':user?'✅ Desafios disponíveis. Nenhuma senha ou PIN.':'✅ Placar conectado. Selecione seu nome.';
 $('logout').classList.toggle('hidden',!user);
 $('open-inbox').disabled=!active&&online.state!=='portal';
 const retry=$('retry-online');if(retry){retry.classList.toggle('hidden',active||!online.enabled);retry.textContent=online.state==='portal'?'⚔️ ABRIR ARENA ONLINE':'↻ RECONECTAR';}
 if(user&&(document.body.dataset.page!=='lobby'||(identifiedPlayerId&&identifiedPlayerId===user.id))&&($('player').value!==user.id||house!==user.house)){
  selectHouse(user.house);$('player').value=user.id;fillRivals();
 }
}
async function loginStudent(){
 const id=$('player').value;
 if(identifiedPlayerId&&id!==identifiedPlayerId){toast('Este jogador não é o da sessão atual.');return null;}
 if(!id||id==='guest'){toast('Escolha seu nome na lista.');return null;}
 if(!online.enabled||online.state!=='ready'){toast('⚠️ '+(online.lastError||'Aguardando atualização do servidor de desafios.'));return null;}
 if(online.user?.id===id)return online.user;
 try{
  const user=await online.login(id);
  identifiedPlayerId=user.id;cmSaveStudent(user.id);
  showOnlineStatus();
  // A confirmação do perfil libera imediatamente a partida; a caixa
  // de convites não pode travar o botão Iniciar por demora do Google.
  toast('✅ Perfil confirmado. Você já pode jogar.');
  void refreshInbox().then(rows=>{
   if(online.user?.id!==user.id)return;
   const pending=rows.filter(c=>c.recipient.id===user.id&&c.status==='PENDENTE').length;
   if(pending){
    toast('🔔 Você recebeu '+pending+' desafio(s)!');
    void openInbox().catch(console.warn);
   }
  }).catch(error=>console.warn('Convites temporariamente indisponíveis, mas perfil já confirmado:',error));
  return user;
 }catch(error){toast('⚠️ Não foi possível selecionar o perfil: '+error.message);return null;}
}
function renderInbox(){
 const list=$('inbox-list');if(!list)return;
 list.replaceChildren();
 const id=online.user?.id;
 $('inbox-status').textContent=id?
  'Seus desafios em aberto aparecem primeiro. Resultados anteriores ficam no histórico.':
  'Escolha um jogador para consultar os desafios.';
 if(!id){list.innerHTML='<div class="empty">Selecione seu jogador.</div>';return}
 const rows=onlineInbox.filter(ch=>ch?.id&&ch.creator?.id!==ch.recipient?.id&&
   (ch.creator?.id===id||ch.recipient?.id===id));
 // Use an explicit allow-list: terminal and unknown statuses must never inflate open challenges.
 const statusOf=ch=>String(ch.status||'').trim().toUpperCase();
 const finished=rows.filter(ch=>statusOf(ch)==='CONCLUIDO');
 const archived=rows.filter(ch=>['RECUSADO','RECUSADA','REJEITADO','DECLINED'].includes(statusOf(ch)));
 const open=rows.filter(ch=>['PENDENTE','ACEITO','CRIADOR_JOGANDO'].includes(statusOf(ch)));
 const other=rows.filter(ch=>!['CONCLUIDO','RECUSADO','RECUSADA','REJEITADO','DECLINED','PENDENTE','ACEITO','CRIADOR_JOGANDO'].includes(statusOf(ch)));
 const score=(ch,mine)=>Number(mine?ch.creatorScore:ch.recipientScore);
 const otherScore=(ch,mine)=>Number(mine?ch.recipientScore:ch.creatorScore);
 const wins=finished.filter(ch=>{const mine=ch.creator.id===id;return score(ch,mine)>otherScore(ch,mine)}).length;
 const losses=finished.filter(ch=>{const mine=ch.creator.id===id;return score(ch,mine)<otherScore(ch,mine)}).length;
 const draws=finished.length-wins-losses;
 const summary=document.createElement('div');summary.className='cm-duel-summary';
 for(const [name,count,cls] of [['Em aberto',open.length,'open'],['Recusados',archived.length,'declined'],['Vitórias',wins,'win'],['Derrotas',losses,'loss'],['Empates',draws,'draw']]){
  const cell=document.createElement('div');cell.className='cm-duel-stat cm-stat-'+cls;
  const n=document.createElement('strong');n.textContent=String(count);
  const label=document.createElement('span');label.textContent=name;cell.append(n,label);summary.appendChild(cell);
 }
 list.appendChild(summary);
 const priority={PENDENTE:0,ACEITO:1,CRIADOR_JOGANDO:2};
 const time=ch=>Date.parse(ch.created)||0;
 open.sort((a,b)=>(priority[a.status]??3)-(priority[b.status]??3)||time(b)-time(a));
 finished.sort((a,b)=>time(b)-time(a));archived.sort((a,b)=>time(b)-time(a));
 function card(ch){
  const mine=ch.creator.id===id,opponent=mine?ch.recipient:ch.creator;
  const item=document.createElement('article');item.className='cm-challenge';
  if(statusOf(ch)==='CONCLUIDO'){
   const own=score(ch,mine),other=otherScore(ch,mine);
   item.classList.add(own>other?'cm-duel-win':own<other?'cm-duel-loss':'cm-duel-draw');
  }else if(archived.includes(ch)){item.classList.add('cm-duel-declined')}
  else{item.classList.add('cm-duel-open')}
  if(cmAlertable(ch,id)&&cmNoticeSnapshot[ch.id]!==cmNotificationState(ch))item.classList.add('cm-challenge-new');
  const title=document.createElement('strong');title.textContent=(mine?'📤 Você desafiou ':'🔔 Você foi desafiado por ')+(opponent?.name||'Colega');
  const type={mesma_turma:'Mesma turma',entre_equipes:'Entre equipes',interclasses:'Interclasses'}[ch.kind]||ch.kind;
  const statusLabel={CRIADOR_JOGANDO:mine?'Termine suas 5 flechas':'O desafiante ainda está jogando',PENDENTE:'Aguardando aceite',ACEITO:'Desafio aceito',RECUSADO:'Recusado',RECUSADA:'Recusado',REJEITADO:'Recusado',DECLINED:'Recusado',CONCLUIDO:'Concluído'}[statusOf(ch)]||'Estado indisponível';
  const sub=document.createElement('small');sub.textContent=type+' · '+statusLabel+' · '+new Date(ch.created).toLocaleDateString('pt-BR');
  item.append(title,sub);
  if(statusOf(ch)==='CONCLUIDO'){
   const own=score(ch,mine),other=otherScore(ch,mine);
   const result=document.createElement('p');result.className='cm-duel-result';
   result.textContent=(own>other?'🏆 VITÓRIA':own<other?'⚔️ DERROTA':'🤝 EMPATE')+' · '+own+' × '+other+' pontos';
   item.appendChild(result);
  }else{
   const desc=document.createElement('p');
   const status=statusOf(ch);
   desc.textContent=archived.includes(ch)?'Convite recusado e encerrado.':
     status==='CRIADOR_JOGANDO'&&mine?'Faça suas cinco flechas para enviar o convite.':
     status==='CRIADOR_JOGANDO'?'O desafiante ainda precisa terminar as cinco flechas. Você não precisa agir agora.':
     status==='PENDENTE'&&mine?'Seu colega já pode aceitar o desafio.':
     status==='PENDENTE'?'Você recebeu um convite. Aceite ou recuse.':
     status==='ACEITO'&&mine?'Aguardando a rodada do colega.':
     status==='ACEITO'?'Sua rodada está disponível.':'Status não reconhecido. Consulte novamente mais tarde.';
   item.appendChild(desc);
  }
  const actions=document.createElement('div');actions.className='cm-challenge-actions';
  function action(label,kind,reject=false){
   const button=document.createElement('button');button.type='button';button.className='cm-challenge-btn'+(reject?' reject':'');
   button.textContent=label;button.dataset.id=ch.id;button.dataset.action=kind;actions.appendChild(button);
  }
  if(!mine&&statusOf(ch)==='PENDENTE'){action('✅ ACEITAR','accept');action('❌ RECUSAR','decline',true)}
  else if(!mine&&statusOf(ch)==='ACEITO')action('🏹 JOGAR MINHAS 5 FLECHAS','play');
  else if(mine&&statusOf(ch)==='CRIADOR_JOGANDO')action('🏹 RETOMAR MINHA RODADA','play');
  if(actions.childElementCount)item.appendChild(actions);
  return item;
 }
 function heading(text,count){
  const h=document.createElement('h3');h.className='cm-inbox-group';h.textContent=text+' ('+count+')';return h;
 }
 const openSection=document.createElement('section');openSection.className='cm-inbox-section';
 openSection.appendChild(heading('⚔️ DESAFIOS EM ABERTO',open.length));
 if(!open.length){const note=document.createElement('p');note.className='cm-inbox-empty';note.textContent='Nenhum desafio em aberto.';openSection.appendChild(note)}
 for(const [label,predicate] of [
  ['🔔 Recebidos',ch=>ch.recipient?.id===id],
  ['🏹 Propostos',ch=>ch.creator?.id===id]]){
  const items=open.filter(predicate);
  openSection.appendChild(heading(label,items.length));
  for(const ch of items)openSection.appendChild(card(ch));
 }
 list.appendChild(openSection);
 const history=document.createElement('details');history.className='cm-duel-history';
 const historyTitle=document.createElement('summary');historyTitle.textContent='📜 HISTÓRICO — '+finished.length+' concluídos · '+archived.length+' recusados';
 history.appendChild(historyTitle);
 for(const [label,items] of [['✅ Duelos concluídos',finished],['🚫 Desafios recusados — encerrados',archived],['⚠️ Outros estados — não contabilizados como abertos',other]]){
  history.appendChild(heading(label,items.length));
  for(const ch of items)history.appendChild(card(ch));
 }
 list.appendChild(history);
}
const CM_NOTICES_PREFIX='cm-duel-notices-v2-';
let cmNoticePlayer='',cmNoticeSnapshot={};
function cmNoticeKey(id){return CM_NOTICES_PREFIX+id}
function cmAlertable(ch,id){
 const incoming=ch.recipient?.id===id,own=ch.creator?.id===id;
 return (incoming&&['PENDENTE','ACEITO','CONCLUIDO'].includes(ch.status))||
        (own&&['ACEITO','RECUSADO','CONCLUIDO'].includes(ch.status));
}
function cmNotificationState(ch){
 return [ch.status,ch.creatorScore??'-',ch.recipientScore??'-'].join(':');
}
function cmLoadNoticeSnapshot(id){
 try{return JSON.parse(localStorage.getItem(cmNoticeKey(id))||'{}')||{}}catch{return {}}
}
function cmSaveNoticeSnapshot(id){
 try{localStorage.setItem(cmNoticeKey(id),JSON.stringify(cmNoticeSnapshot))}catch{}
}
function cmUpdateBell(){
 const id=online.user?.id,btn=$('open-inbox'),num=$('unread-count'),quick=$('cm-open-challenges'),quickCount=$('cm-quick-challenges-count');
 if(!btn||!num)return;
 if(!id){
  num.textContent='—';if(quickCount)quickCount.textContent='—';
  btn.classList.remove('cm-bell-alert');if(quick)quick.classList.remove('cm-bell-alert');
  btn.title='Selecione seu perfil para consultar os desafios';return;
 }
 // The main number is the number of actual challenges, not unread notifications.
 const rows=onlineInbox.filter(c=>c?.id&&((c.creator?.id===id&&c.recipient?.id!==id)||(c.recipient?.id===id&&c.creator?.id!==id)));
 const received=rows.filter(c=>c.recipient?.id===id).length;
 const sent=rows.length-received;
 const updates=rows.filter(ch=>cmAlertable(ch,id)&&cmNoticeSnapshot[ch.id]!==cmNotificationState(ch));
 num.textContent=String(rows.length);
 if(quickCount)quickCount.textContent=String(rows.length);
 const description=rows.length+' desafios: '+received+' recebidos, '+sent+' enviados; '+updates.length+' novidade(s) não vistas.';
 btn.title=description;btn.setAttribute('aria-label','Meus desafios. '+description);
 btn.classList.toggle('cm-bell-alert',updates.length>0);
 if(quick){quick.title=description;quick.classList.toggle('cm-bell-alert',updates.length>0)}
}
function cmMarkNoticesRead(){
 const id=online.user?.id;if(!id)return;
 for(const ch of onlineInbox){if(cmAlertable(ch,id))cmNoticeSnapshot[ch.id]=cmNotificationState(ch)}
 cmSaveNoticeSnapshot(id);cmUpdateBell();
}
async function refreshInbox(){
 if(!online.enabled||!online.user){onlineInbox=[];cmNoticePlayer='';cmUpdateBell();return [];}
 const requestedId=online.user.id;
 const counter=$('unread-count');
 if(counter&&cmNoticePlayer!==requestedId)counter.textContent='…';
 let rows;
 try{rows=await online.inbox()}catch(error){
  if(online.user?.id===requestedId){const count=$('unread-count');if(count)count.textContent='!';const q=$('cm-quick-challenges-count');if(q)q.textContent='!'}
  throw error;
 }
 // Ignore delayed results if the student changed profiles while the request ran.
 if(online.user?.id!==requestedId)return [];
 onlineInbox=rows;
 if(cmNoticePlayer!==requestedId){cmNoticePlayer=requestedId;cmNoticeSnapshot=cmLoadNoticeSnapshot(requestedId)}
 cmUpdateBell();renderInbox();return onlineInbox;
}
async function openInbox(){
 /* API direta: caixa de desafios usa o servidor HTTP. */
 if(!online.user){const selected=await loginStudent();if(!selected){toast('Escolha seu nome para abrir seus desafios.');return;}}
 $('online-inbox').classList.remove('hidden');
 $('inbox-status').textContent='⏳ Consultando convites recebidos...';
 try{await refreshInbox();cmMarkNoticesRead()}catch(e){$('inbox-status').textContent='⚠️ Falha ao carregar desafios: '+e.message}
}
async function onInboxAction(e){
 const button=e.target.closest('button[data-action]');if(!button||onlineLoading)return;
 const ch=onlineInbox.find(x=>x.id===button.dataset.id);if(!ch)return;
 button.disabled=true;
 try{
  if(button.dataset.action==='accept'){
   const saved=await online.answer(ch.id,'accept');$('online-inbox').classList.add('hidden');
   toast('✅ Desafio aceito! Veja os disparos do adversário e faça sua rodada.');await startMatch(saved);
  }else if(button.dataset.action==='decline'){
   await online.answer(ch.id,'decline');toast('Desafio recusado.');await refreshInbox();
  }else if(button.dataset.action==='play'){
   $('online-inbox').classList.add('hidden');await startMatch(ch);
  }
 }catch(error){toast('⚠️ '+error.message);button.disabled=false;}
}
async function startOnlineClient(){
 online.lastError=null;
 showOnlineStatus();
 if(!online.enabled)return;
 try{
  const connected=await online.connect();online.lastError=null;showOnlineStatus();
  if(!connected)return;
  try{await online.list()}catch(err){console.warn('Lista online indisponível; usando nomes cadastrados no jogo:',err)}
  const request=new URLSearchParams(location.search);
  // Only a deliberate return from the arena preserves identity.
  // Reloading or reopening the lobby always releases the prior student's account.
  const sessionId=cmResumeSameStudent?cmSessionId():'';
  // Initial identity is already cleared synchronously at module start.
  // Never force the lobby back to Casa after a student has begun choosing a character.
  if(document.body.dataset.page==='lobby'&&/^[ABC][0-9]{2}$/.test(sessionId)&&(!online.user||online.user.id===sessionId)){
   if(!online.user){try{await online.login(sessionId)}catch(err){console.warn('Não foi possível reconectar o aluno:',err);cmForgetStudent();return;}}
   identifiedPlayerId=sessionId;
   selectHouse(sessionId[0]);fillPlayer(sessionId);populateIdentityOptions();
   $('player').value=sessionId;$('player').disabled=true;updateMode();
   setLobbyStep('desafio');
   const endBtn=$('cm-end-session');if(endBtn)endBtn.hidden=false;
  }else if(document.body.dataset.page==='lobby'&&!identifiedPlayerId&&online.user&&sessionId!==online.user.id){
   online.logout();cmForgetStudent();identifiedPlayerId='';
  }
  if(document.body.dataset.page!=='lobby'&&!online.user){
   const remembered=localStorage.getItem('cm_arco_nome');
   if(/^[ABC][0-9]{2}$/.test(remembered||'')){selectHouse(remembered[0]);$('player').value=remembered;await loginStudent();}
  }
  try{
   const pendentes=await refreshInbox();
   if(online.user&&pendentes.some(c=>c.recipient.id===online.user.id&&c.status==='PENDENTE')){
    toast('🔔 Você foi desafiado! Aceite ou recuse quando quiser.');await openInbox();
   }
  }catch(error){console.warn('Convites temporariamente indisponíveis:',error)}
  if(request.get('inbox')==='1'&&online.user){await openInbox()}
  renderRanking();
 }catch(error){
  online.state='error';
  online.lastError=String(error?.message||'Falha de conexão');
  showOnlineStatus();
  $('online-status').title=online.lastError;
  console.warn('ClassMana API:',error);
 }
}

// Interações do jogo.
document.querySelectorAll('.nav-link').forEach(el=>el.addEventListener('click',()=>{if(el.dataset.view==='inicio'&&view==='inicio')setLobbyStep('reino');else openView(el.dataset.view)}));
document.querySelectorAll('[data-lobby-step]').forEach(button=>button.addEventListener('click',()=>{if(document.body.dataset.page==='lobby'&&!identifiedPlayerId){setLobbyStep('reino');return}setLobbyStep(button.dataset.lobbyStep)}));
function populateIdentityOptions(){
 const el=$('cm-identity-player');if(!el)return;
 const names=choices(house);
 el.innerHTML='<option value="">Selecione seu nome — 4º '+house+'</option>'+names.map(p=>
  '<option value="'+p.id+'">'+p.name+' · '+p.id+'</option>').join('');
 el.value=identifiedPlayerId?.[0]===house?identifiedPlayerId:'';
 const info=$('cm-identity-info');
 if(info)info.textContent='Turma: 4º '+house+' — '+H[house].name+' · '+names.length+' alunos';
 const label=document.querySelector('label[for="cm-identity-player"]');
 if(label)label.textContent='ALUNOS DO 4º '+house+' — '+H[house].name.toUpperCase();
}
populateIdentityOptions();
$('cm-identity-player')?.addEventListener('change',event=>{
 const id=event.currentTarget.value,found=choices(house).find(p=>p.id===id);
 const info=$('cm-identity-info');
 if(info)info.textContent=found?'✓ '+found.name+' · 4º '+house+' — '+H[house].name:'Selecione seu nome no 4º '+house+'.';
});
$('cm-confirm-identity')?.addEventListener('click',()=>{
 const id=$('cm-identity-player')?.value||'';
 if(!/^[ABC][0-9]{2}$/.test(id)||id[0]!==house){toast('Escolha seu nome no 4º '+house+'.');$('cm-identity-player')?.focus();return;}
 if(identifiedPlayerId&&identifiedPlayerId!==id){toast('Encerre a sessão atual para trocar de jogador.');return;}
 identifiedPlayerId=id;cmSaveStudent(id);cmShowActiveSession();
 $('player').value=id;fillPlayer(id);fillRivals();
 $('player').disabled=true;
 setLobbyStep('heroi');
});

$('confirm-archer').addEventListener('click',()=>setLobbyStep('desafio'));
$('challenge-level').addEventListener('change',drawCourse);
document.querySelectorAll('.house').forEach(el=>el.addEventListener('click',()=>{
 const chosen=el.dataset.house;
 if(identifiedPlayerId&&identifiedPlayerId[0]!==chosen){toast('Encerre a sessão antes de trocar de Casa.');return;}
 selectHouse(chosen);
 populateIdentityOptions();
 setLobbyStep('perfil');
}));
function rotateArcher(){chooseArcher(archerGender()==='m'?'f':'m')}
$('archer-prev').addEventListener('click',rotateArcher);
$('archer-next').addEventListener('click',rotateArcher);
document.querySelector('.studio-carousel')?.addEventListener('keydown',event=>{
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
  event.preventDefault();rotateArcher();
  $(event.key==='ArrowLeft'?'archer-prev':'archer-next').focus();
 }
});
const soundButton=$('arena-sound');
function updateSoundButton(){
 if(!soundButton)return;
 const on=arenaAudio.enabled;
 soundButton.textContent=on?'🔊 Som ligado':'🔇 Som desligado';
 soundButton.setAttribute('aria-pressed',String(on));
 soundButton.setAttribute('aria-label',on?'Desativar sons da arena':'Ativar sons da arena');
}
function updateLobbyAudioButton(){
 const button=$('cm-lobby-sound');if(!button)return;
 button.textContent=!arenaAudio.enabled?'🔇 Som desligado':arenaAudio.playing?'🔊 Música e sons':'▶ Ativar trilha sonora';
 button.setAttribute('aria-pressed',String(arenaAudio.enabled&&arenaAudio.playing));
 button.setAttribute('aria-label',!arenaAudio.enabled?'Ativar música e efeitos':arenaAudio.playing?'Desativar música e efeitos':'Iniciar trilha sonora');
}
function audioControl(){
 if(arenaAudio.enabled&&!arenaAudio.playing)arenaAudio.start();
 else arenaAudio.toggle();
 updateSoundButton();updateLobbyAudioButton();
}
soundButton?.addEventListener('click',audioControl);
$('cm-lobby-sound')?.addEventListener('click',audioControl);
document.addEventListener('pointerdown',()=>queueMicrotask(updateLobbyAudioButton),{passive:true});
updateSoundButton();updateLobbyAudioButton();
document.querySelectorAll('[data-equip-bow]').forEach(el=>el.addEventListener('click',()=>chooseEquipment('bow',el.dataset.equipBow)));
applyEquipment();
$('mode').addEventListener('change',updateMode);
$('player').addEventListener('change',()=>{
 if(identifiedPlayerId&&$('player').value!==identifiedPlayerId){$('player').value=identifiedPlayerId;toast('Para trocar de aluno, encerre a sessão.');return;}
 const quick=$('cm-quick-player');if(quick)quick.value=$('player').value==='guest'?'':$('player').value;
 fillRivals();if(online.state==='ready'&&$('player').value!=='guest')loginStudent().catch(console.warn);
});

$('team-scope').addEventListener('change',updateMode);
$('opponent-house').addEventListener('change',fillRivals);
$('opponent-team').addEventListener('change',fillRivals);
$('my-team').addEventListener('change',()=>{
 const mate=choices(house).find(p=>TEAMS[p.id]===$('my-team').value);
 if(mate&&identifiedPlayerId&&mate.id!==identifiedPlayerId){toast('Sua equipe está vinculada ao jogador da sessão.');$('my-team').value=TEAMS[identifiedPlayerId]||'';return;}
 if(mate){$('player').value=mate.id;if(online.state==='ready')loginStudent().catch(console.warn)}
 fillRivals();
});$('start-game').addEventListener('click',startMatch);$('rank-play').addEventListener('click',()=>openView('inicio'));$('rules-play').addEventListener('click',()=>openView('inicio'));$('leave-arena').addEventListener('click',()=>{if(match?.running&&!confirm('Abandonar a rodada atual e começar uma nova depois?'))return;openView('inicio')});$('play-again').addEventListener('click',()=>{
 if(document.body.dataset.page==='arena'){
  try{sessionStorage.removeItem('cm_active_archery_match_v1')}catch{}
  cmMarkInternalReturn();window.location.assign('./?continuar=1');return;
 }
 if(match)match.running=false;
 setLobbyStep('desafio');
});$('share-result').addEventListener('click',()=>{if(match?.onlineSaveFailed)finishMatch();else if(!match?.online)share()});
const world=$('world');world.addEventListener('pointerdown',e=>{if(!match?.running||match.locked||match.paused)return;e.preventDefault();world.setPointerCapture(e.pointerId);holding=true;pointerStart=Date.now();aim(e);scene?.setPower(.28);$('stage').classList.add('aiming');arenaAudio.play('draw');$('instruction').textContent='ARRASTE PARA MOVER O ARCO • SOLTE PARA ATIRAR'});world.addEventListener('pointermove',e=>{if(!match?.running||match.locked||match.paused)return;if(holding||e.pointerType==='mouse')aim(e);if(holding)scene?.setPower(chargePower())});world.addEventListener('pointerup',e=>{if(!holding)return;e.preventDefault();aim(e);holding=false;$('stage').classList.remove('aiming');$('instruction').textContent='MOVA OU ARRASTE PARA MIRAR • SEGURE PARA PUXAR • SOLTE PARA ATIRAR';const p=chargePower();scene?.setPower(p);spriteHud?.setPower(p);fire(p);uiHud()});world.addEventListener('pointercancel',()=>{holding=false;$('stage').classList.remove('aiming');scene?.setPower(0)});
document.addEventListener('keydown',e=>{if(view!=='arena'||!match?.running||match.locked)return;let action=true;const step=e.shiftKey?.022:.008;switch(e.code){case'ArrowUp':reticle.y=clamp(reticle.y-step,.08,.92);break;case'ArrowDown':reticle.y=clamp(reticle.y+step,.08,.92);break;case'ArrowLeft':reticle.x=clamp(reticle.x-step,.06,.94);break;case'ArrowRight':reticle.x=clamp(reticle.x+step,.06,.94);break;case'Space':fire(1);break;default:action=false}if(action){e.preventDefault();updateReticle()}});
setInterval(()=>{if(holding&&!match?.paused){scene?.setPower(chargePower());uiHud()}},60);

$('retry-online')?.addEventListener('click',async()=>{
 
 const button=$('retry-online');button.disabled=true;
 try{await startOnlineClient()}
 finally{button.disabled=false}
});
$('open-inbox').addEventListener('click',openInbox);
$('close-inbox').addEventListener('click',()=>$('online-inbox').classList.add('hidden'));
$('online-inbox').addEventListener('click',e=>{if(e.target===$('online-inbox'))$('online-inbox').classList.add('hidden')});
$('inbox-list').addEventListener('click',onInboxAction);
function cmEndSession(){
 if(match?.running){toast('Finalize ou abandone a partida antes de encerrar a sessão.');return}
 const person=choices(identifiedPlayerId?.[0]||house).find(p=>p.id===identifiedPlayerId);
 if(!confirm('Encerrar a sessão de '+(person?.name||online.user?.name||'jogador atual')+'?'))return;
 online.logout();cmForgetStudent();identifiedPlayerId='';onlineInbox=[];cmNoticePlayer='';
 $('player').disabled=false;$('player').value='guest';cmShowActiveSession();
 if($('cm-identity-player'))$('cm-identity-player').value='';
 fillRivals();cmUpdateBell();showOnlineStatus();
 const endBtn=$('cm-end-session');if(endBtn)endBtn.hidden=true;
 setLobbyStep('reino');toast('Sessão encerrada. Escolha a Casa para começar.');
}
$('logout').addEventListener('click',cmEndSession);
$('cm-end-session')?.addEventListener('click',cmEndSession);
$('cm-previous-session-exit')?.addEventListener('click',cmEndSession);
$('cm-ranking-choice')?.addEventListener('click',()=>openView('ranking'));
$('cm-open-challenges')?.addEventListener('click',()=>openInbox());
document.querySelectorAll('[data-rank]').forEach(btn=>btn.addEventListener('click',()=>{
 scoreTab=btn.dataset.rank;document.querySelectorAll('[data-rank]').forEach(x=>x.classList.toggle('active',x===btn));renderRanking();
}));
function toggleArenaPause(){
 if(!match?.running||match.locked||view!=='arena')return;
 const now=performance.now();
 if(!match.paused){match.freezeTime=stageSeconds();match.pauseSince=now;match.paused=true;}
 else{match.stageStartedAt+=now-(match.pauseSince||now);match.freezeTime=null;match.paused=false;}
 spriteHud?.setPaused(match.paused);arenaAudio.setActive(!match.paused);
}
spriteHud=mountSpriteHUD({
 onPowerStart:()=>{if(!match?.running||match.locked||match.paused||view!=='arena')return false;
   $('stage').classList.add('aiming');arenaAudio.play('draw');return true;},
 onPowerMove:p=>{if(match?.running&&!match.paused)scene?.setPower(p);},
 onPowerRelease:p=>{if(!match?.running||match.locked||match.paused)return;
  $('stage').classList.remove('aiming');scene?.setPower(p);fire(p);uiHud();},
 onPause:toggleArenaPause
});
selectHouse('A');updateMode();drawCourse();setLobbyStep('reino');
const hostedParams=new URLSearchParams(location.search);
if(hostedParams.get('hosted')==='1'&&document.body.dataset.page!=='arena'){
 const hostHouse=hostedParams.get('house'),hostMode=hostedParams.get('mode'),hostPlayer=hostedParams.get('player');
 if(['A','B','C'].includes(hostHouse))selectHouse(hostHouse);
 if(['challenge_same','challenge_team','challenge'].includes(hostMode)){$('mode').value=hostMode;updateMode()}
 if(/^[ABC]\d{2}$/.test(hostPlayer||'')&&hostPlayer[0]===house){$('player').value=hostPlayer;fillRivals()}
 setLobbyStep('partida');
}
// A seleção de jogador sempre pode voltar à escolha da Casa.
$('cm-identity-back')?.addEventListener('click',()=>setLobbyStep('reino'));
// A abertura duplicada foi removida. O fluxo começa na escolha da Casa.
$('cm-lobby-back')?.addEventListener('click',()=>{
 const step=$('view-inicio')?.dataset.step;
 setLobbyStep(step==='partida'?'desafio':step==='desafio'?'heroi':step==='heroi'?'perfil':'reino');
});
document.querySelectorAll('[data-play-mode]').forEach(button=>{
 button.addEventListener('click',()=>{
  const chosen=button.dataset.playMode;
  if(!['practice','bot','challenge_same','challenge_team','challenge'].includes(chosen))return;
  if(isDuel(chosen)&&!(/^[ABC][0-9]{2}$/.test($('player').value))){
    setLobbyStep('perfil');populateIdentityOptions();$('cm-identity-player')?.focus();
    toast('🏹 Escolha seu nome antes de iniciar o duelo.');return;
  }
  $('mode').value=chosen;updateMode();
  setLobbyStep('partida');
 });
});
function restoreArena(){
 if(document.body.dataset.page!=='arena')return;
 let saved=null;
 try{saved=JSON.parse(sessionStorage.getItem('cm_active_archery_match_v1')||'null')}catch{}
 if(!saved||!['A','B','C'].includes(saved.house)||!Array.isArray(saved.scores)||saved.scores.length>5){
  window.location.replace('./');return;
 }
 match=saved;
 identifiedPlayerId=saved.playerId||online.user?.id||cmSessionId();
 match.stageStartedAt=performance.now();match.freezeTime=null;match.locked=false;
 match.running=match.scores.length<5||!!match.onlineSaveFailed;
 selectHouse(match.house);
 $('player').value=match.playerId||'guest';
 $('mode').value=match.mode||'practice';
 $('challenge-level').value=match.level||'iniciante';
 $('difficulty').value=match.difficulty||'medium';
 reticle={x:.50,y:.45};
 $('finish').classList.add('hidden');
 $('instruction').textContent='MOVA O ARCO PARA MIRAR · SEGURE PARA PUXAR · SOLTE PARA DISPARAR';
 openView('arena');refreshArcher();ensureScene();changeTarget();updateReticle();uiHud();
 if(match.scores.length===5)finishMatch();
}
if(document.body.dataset.page==='arena')restoreArena();
else processLink();
renderRanking();
startOnlineClient();
setInterval(async()=>{
 if(!online.user||online.state!=='ready'||document.visibilityState==='hidden')return;
 try{
  const id=online.user.id;
  const before=onlineInbox.filter(ch=>cmAlertable(ch,id)&&cmNoticeSnapshot[ch.id]!==cmNotificationState(ch)).length;
  await refreshInbox();
  const after=onlineInbox.filter(ch=>cmAlertable(ch,id)&&cmNoticeSnapshot[ch.id]!==cmNotificationState(ch)).length;
  if(after>before)toast('🔔 Novidade no torneio! Abra Meus desafios para ver.');
 }catch(error){console.warn('Atualização dos convites:',error)}
},20000);