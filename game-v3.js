import {initScene} from './scene-v3.js?v=12';
import {online} from './online-client.js?v=3';
const $=id=>document.getElementById(id);
const H={A:{grade:'4º A',name:'Águia Dourada',color:'#78bdff'},B:{grade:'4º B',name:'Leão de Fogo',color:'#ff9778'},C:{grade:'4º C',name:'Dragão de Esmeralda',color:'#8defac'}};
const R=window.CLASSMANA_ROSTER||{A:[],B:[],C:[]};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
let house='A',view='inicio',scene=null,match=null,reticle={x:.50,y:.45},pointerStart=0,holding=false,storage=[];
let incoming=null,scoreTab='players',onlineInbox=[],onlineLoading=false;
const TEAMS=window.CLASSMANA_TEAMS||{};
const CIRCUITS={iniciante:[10,20,30,40,50],avancado:[30,40,50,60,80],lendario:[60,80,100,120,150]};
const rand=(a,b)=>a+Math.random()*(b-a);
function safeRead(){try{const a=JSON.parse(localStorage.getItem('classmana-archery-v2'));return Array.isArray(a)?a.filter(x=>x&&typeof x==='object').slice(-150):[]}catch{return []}}
storage=safeRead();
function persist(row){storage.push({...row,at:new Date().toISOString()});storage=storage.slice(-150);try{localStorage.setItem('classmana-archery-v2',JSON.stringify(storage))}catch{}renderRanking()}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3100)}
function openView(name){if(name!=='arena'&&view==='arena'&&match?.running){match.running=false;match.locked=false;holding=false;$('stage').classList.remove('aiming','firing');scene?.setPower(0);}view=name;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.view===name));window.scrollTo({top:0,behavior:'instant'});if(name==='ranking')renderRanking()}
function choices(h){return (R[h]||[]).map((name,i)=>({id:h+String(i+1).padStart(2,'0'),name}));}
function fillPlayer(wanted){const sel=$('player');sel.innerHTML='<option value="guest">Arqueiro convidado</option>'+choices(house).map(p=>`<option value="${p.id}">${p.id} · ${p.name}</option>`).join('');if(wanted&&choices(house).some(x=>x.id===wanted))sel.value=wanted;fillRivals()}
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
 const availableTeams=[...new Set(choices(enemyHouse).map(p=>TEAMS[p.id]))].filter(t=>t&&t!==myTeam).sort();
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

function selectHouse(k){
 house=k;
 document.querySelectorAll('.house').forEach(el=>{
  const selected=el.dataset.house===k;
  el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));
  el.querySelector('.house-check').textContent=selected?'✓ SELECIONADA':'ESCOLHER CASA';
 });
 const stage=$('stage');stage.classList.remove('house-a','house-b','house-c');stage.classList.add('house-'+k.toLowerCase());
 const logo={A:'brasao-4a-transparente.png',B:'arte-028.png',C:'arte-029.png'}[k];
 const badge=$('stage-house-badge');if(badge){badge.dataset.house=k;badge.querySelector('img').src=window.CLASSMANA_HOUSES[k].emblem;badge.querySelector('strong').textContent=H[k].name;}
 const hero={
  A:{portrait:'hero_fada.png',name:'Águia Dourada — 4º A',desc:'O guardião da floresta e dos ventos protege os arqueiros da Casa azul e dourada.'},
  B:{portrait:'hero_chama.png',name:'Leão de Fogo — 4º B',desc:'As chamas do reino acompanham os arqueiros da Casa vermelha e dourada.'},
  C:{portrait:'hero_dragao.png',name:'Dragão de Esmeralda — 4º C',desc:'O dragão protetor acompanha os arqueiros da Casa verde-esmeralda.'}
 }[k];
 const panel=$('hero-preview');if(panel){
  panel.style.animation='none';void panel.offsetWidth;panel.style.animation='';
  $('hero-preview-img').src='assets/characters/'+hero.portrait;
  $('hero-preview-name').textContent=hero.name;
  $('hero-preview-desc').textContent=hero.desc;
 }
 scene?.setHouse(k);
 fillPlayer(incoming?.rivalId?.[0]===k?incoming.rivalId:null);
}
function isDuel(mode){return mode==='challenge'||mode==='challenge_same'||mode==='challenge_team'}
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
 fillRivals();
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
function uiHud(){if(!match)return;$('hud-player').textContent=match.player+' · '+H[match.house].grade;$('hud-bot').textContent=match.mode==='bot'?'🤖 Robô · '+({easy:'Fácil',medium:'Médio',hard:'Difícil'}[match.difficulty]):match.mode==='practice'?'🎯 Treinamento':match.incoming?'⚔️ '+byId(match.incoming.playerId):'⚔️ '+byId(match.rivalId);$('hud-score').textContent=match.scores.reduce((a,b)=>a+b,0);$('hud-rival').textContent=match.onlineReplay?.length?(match.onlineReplayPoints||0):match.incoming?match.incoming.score:match.mode==='bot'?'?':'—';renderWind(match.wind);$('distance').textContent='🎯 ETAPA '+Math.min(match.scores.length+1,5)+'/5 · '+Math.round(match.distance)+' METROS';$('shots').textContent='🏹 FLECHA '+Math.min(match.scores.length+1,5)+' / 5';$('power').textContent='⚡ FORÇA '+(holding?Math.round(clamp((Date.now()-pointerStart)/950,.2,1)*100):0)+'%';}
function worldSettings(){return {distance:match?.distance||10,shift:match?.shift||0,house:match?.house||house}}
function ensureScene(){if(!scene)scene=initScene($('world'),worldSettings);scene.setHouse(house)}
function changeTarget(){
 if(!match)return;
 const cfg=match.online?.settings?.[match.scores.length];
 if(cfg){match.distance=cfg.distance;match.shift=cfg.shift;match.wind=cfg.wind;}
 else{
 match.distance=CIRCUITS[match.level]?.[match.scores.length]||CIRCUITS.iniciante[match.scores.length];
 match.shift=Math.round(rand(-5,5))/100;
 match.wind=Math.round(rand(-4,4)*(.65+Math.pow(match.distance/70,.45)*.55)*10)/10;
}
 scene?.setTargetShift(match.shift);uiHud();
}
async function startMatch(accepted=null){
 if(onlineLoading)return;
 const fromInbox=accepted&&typeof accepted.id==='string'?accepted:null;
 const mode=fromInbox?duelMode(fromInbox.kind):$('mode').value;
 let userId=$('player').value,rivalId=fromInbox?(fromInbox.creator.id===online.user?.id?fromInbox.recipient.id:fromInbox.creator.id):$('rival').value,challenge=null;
 if(isDuel(mode)){
  if(!online.enabled){toast('Para desafios oficiais, o servidor Google Sheets precisa ser ativado.');return}
  if(!online.user||online.user.id!==userId){
    const selected=await loginStudent();
    if(!selected)return;
   }
  userId=online.user.id;
  if(!fromInbox){
   if(!rivalId||!choices(rivalId[0]).some(x=>x.id===rivalId)){toast('Escolha um adversário.');return}
   if(userId===rivalId){toast('Você não pode desafiar a si mesmo.');return}
   if((mode==='challenge_same'&&userId[0]!==rivalId[0])||(mode==='challenge'&&userId[0]===rivalId[0])||
      (mode==='challenge_team'&&TEAMS[userId]===TEAMS[rivalId])){
    toast('Escolha um adversário válido para este tipo de desafio.');return;
   }
  }else if(fromInbox.recipient.id!==userId&&fromInbox.creator.id!==userId){toast('Esse desafio não pertence à sua conta.');return;}
  try{
   onlineLoading=true;$('start-game').disabled=true;$('start-game').textContent='⏳ PREPARANDO DESAFIO ONLINE...';
   challenge=fromInbox||await online.create(duelKind(mode),rivalId,$('challenge-level').value);
  }catch(error){toast('Não foi possível criar o desafio: '+error.message);return}
  finally{onlineLoading=false;$('start-game').disabled=false;$('start-game').innerHTML='🏹 INICIAR PARTIDA <span>➜</span>'}
 }
 if(match?.running){match.running=false;match.locked=false;holding=false;$('stage').classList.remove('aiming','firing');scene?.setPower(0);}
 if(online.user&&isDuel(mode)){userId=online.user.id;selectHouse(userId[0]);$('player').value=userId;}
 match={house:userId==='guest'?house:userId[0],playerId:userId,player:nameOf(userId),mode,difficulty:$('difficulty').value,
  rivalId,scores:[],running:true,locked:false,wind:0,distance:10,level:challenge?.level||$('challenge-level').value,shift:0,incoming:null,
  online:challenge,onlineShots:[],onlineReplay:challenge?.recipient.id===userId?challenge.creatorShots:[],
  onlineReplayPoints:0,seed:Math.floor(rand(100000,999999))};
 reticle={x:.50,y:.45};$('finish').classList.add('hidden');
 $('instruction').textContent='MOVA A MIRA DO ARCO • SEGURE PARA PUXAR • SOLTE PARA ATIRAR';
 openView('arena');ensureScene();changeTarget();updateReticle();uiHud();
}

function updateReticle(){
  // Mouse/touch drives the bow. There is no second, independent crosshair.
  scene?.setAim(reticle.x,reticle.y);
}
function aim(e){const rect=$('stage').getBoundingClientRect();reticle.x=clamp((e.clientX-rect.left)/rect.width,.08,.95);reticle.y=clamp((e.clientY-rect.top)/rect.height,.11,.91);updateReticle()}
function levelScore(x,y,r){const norm=Math.hypot(x,y)/r;return norm>1?0:Math.max(1,10-Math.floor(norm*10))}
async function fire(power){
 if(!match?.running||match.locked||match.scores.length>=5)return;
 const currentMatch=match,shotIndex=match.scores.length;
 match.locked=true;holding=false;$('stage').classList.remove('aiming');
 const w=$('stage').clientWidth,h=$('stage').clientHeight;
 const t=scene?.getTargetMetrics?.()||{x:w*(.5+match.shift),y:h*.45,r:Math.min(h*.105,w*.082)};
 const sight=scene?.getAimPoint?.();
 if(!sight||!Number.isFinite(sight.x)||!Number.isFinite(sight.y)){match.locked=false;return toast('A mira ainda não está pronta.');}
 const dx=(sight.x*w-t.x)/t.r,dy=(sight.y*h-t.y)/t.r;
 // Round scores online are calculated again by Apps Script using these normalized offsets.
 if(currentMatch.online)currentMatch.onlineShots.push({dx,dy,power});
 const distanceFactor=Math.pow(Math.max(10,match.distance)/30,.55);
 const drift=match.wind*t.r*.040*distanceFactor,fall=(1-power)*t.r*.70*distanceFactor;
 const jitter=match.online?0:(1-power)*t.r*.14*Math.min(2,distanceFactor);
 const ix=sight.x*w+drift+rand(-.08,.08)*jitter;
 const iy=sight.y*h+fall+rand(-.06,.06)*jitter;
 const score=levelScore(ix-t.x,iy-t.y,t.r);
 $('stage').classList.add('firing');
 try{await Promise.race([scene?.fire?.({x:ix/w,y:iy/h,power}),new Promise(resolve=>setTimeout(resolve,1050))]);}
 catch(e){console.warn('Animação da flecha:',e)}
 $('stage').classList.remove('firing');
 if(match!==currentMatch||!currentMatch.running)return;
 scene?.impact?.({x:ix/w,y:iy/h,score});
 match.scores.push(score);$('hud-score').textContent=match.scores.reduce((a,b)=>a+b,0);
 showHit(score,ix/w,iy/h);
 if(score===10)toast('🎯 ACERTO PERFEITO! +10 pontos');
 // Opponent does not need to be present: replay their 5 recorded arrows now.
 const ghost=match.onlineReplay?.[shotIndex];
 if(ghost&&match.online){
  $('instruction').textContent='🏹 DISPARO DO ADVERSÁRIO • RECONSTITUIÇÃO DA RODADA SALVA';
  const px=(t.x+ghost.impactDx*t.r)/w,py=(t.y+ghost.impactDy*t.r)/h;
  try{await Promise.race([scene?.fire?.({x:px,y:py,power:ghost.power||1}),new Promise(resolve=>setTimeout(resolve,950))]);}catch(e){console.warn('Replay:',e)}
  if(match!==currentMatch||!currentMatch.running)return;
  scene?.impact?.({x:px,y:py,score:ghost.score});
  match.onlineReplayPoints+=Number(ghost.score)||0;
  $('hud-rival').textContent=match.onlineReplayPoints;
  toast('⚔️ '+(match.online.creator.name||'Adversário')+' acertou '+ghost.score+' pontos (replay)');
  $('instruction').textContent='SUA VEZ • MIRE COM O ARCO E SOLTE PARA DISPARAR';
 }
 if(match.scores.length>=5){setTimeout(()=>{if(match===currentMatch&&currentMatch.running)finishMatch()},580);}
 else{setTimeout(()=>{if(match===currentMatch&&currentMatch.running){changeTarget();match.locked=false;}},520);}
}

function showHit(score,x,y){const el=$('hit');el.textContent=score?'+'+score+' PONTOS':'FORA DO ALVO';el.style.left=(x*100)+'%';el.style.top=clamp(y*100-12,18,64)+'%';el.classList.remove('show');void el.offsetWidth;el.classList.add('show')}
function chooseRobotScore(difficulty,playerAverage){const base={easy:5.1,medium:6.7,hard:8.15}[difficulty],adjust=clamp((playerAverage-5.5)*.17,-.7,.7);let result=clamp(base+adjust+rand(-3.3,3.3),0,10);return result>=9.25?10:result>=7?8:result>=5?6:result>=3?4:result>=1.5?2:0;}
async function finishMatch(){
 if(!match||match.scores.length<5)return;
 const current=match;match.locked=true;const finish=$('finish');finish.classList.remove('hidden');
 $('share-result').classList.add('hidden');
 if(match.online){
  $('finish-title').textContent='⏳ GRAVANDO RESULTADO NA PLANILHA...';
  $('finish-desc').textContent='Seus disparos estão sendo validados e registrados no placar online.';
  $('finish-results').textContent='🏹 5 / 5 FLECHAS';
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
   $('finish-results').textContent='🎯 VOCÊ '+total+' PTS   ⚔️ ADVERSÁRIO '+(rival===null?'AGUARDANDO':rival+' PTS');
   $('share-help').textContent='✅ Resultado persistido na planilha online. Nenhum link manual é necessário.';
   $('hud-score').textContent=total;$('hud-rival').textContent=rival===null?'—':rival;
   refreshInbox().catch(console.warn);renderRanking().catch(console.warn);
  }catch(error){
   if(match!==current)return;current.onlineSaveFailed=true;current.running=true;
   $('finish-title').textContent='⚠️ RESULTADO AINDA NÃO CONFIRMADO';
   $('finish-desc').textContent='O servidor não confirmou a gravação: '+error.message;
   $('finish-results').textContent='Suas cinco flechas permanecem nesta partida.';
   $('share-help').textContent='Tente salvar novamente antes de sair da arena.';
   $('share-result').classList.remove('hidden');$('share-result').textContent='🔄 TENTAR SALVAR NO PLACAR';
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
 $('finish-results').textContent='🏹 '+total+' PTS   '+(rivalScore===undefined?'TREINO LIVRE':'🤖 ROBÔ '+rivalScore+' PTS');
 $('share-help').textContent='Treino e partidas com robô ficam neste navegador; somente desafios validados entram no ranking oficial.';
 if(match.playerId!=='guest')persist({house:match.house,id:match.playerId,score:total,mode:match.mode,win:rivalScore===undefined?null:total>rivalScore});
 uiHud();
}

function encode(d){const s=JSON.stringify(d),arr=new TextEncoder().encode(s);let bs='';arr.forEach(v=>bs+=String.fromCharCode(v));return btoa(bs).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decode(s){const b=s.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b);return JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0))))}
function createLink(){if(!match)return;const total=match.scores.reduce((a,b)=>a+b,0);let d=match.incoming?{v:2,complete:true,a:{house:match.incoming.house,id:match.incoming.playerId,score:match.incoming.score},b:{house:match.house,id:match.playerId,score:total}}:{v:2,playerId:match.playerId,house:match.house,rivalId:match.rivalId,score:total,seed:match.seed};return `${location.href.split('#')[0]}#duel=${encode(d)}`;}
async function share(){const link=createLink();try{await navigator.clipboard.writeText(link);toast('Link copiado! Envie ao outro arqueiro.')}catch{window.prompt('Copie o link do desafio:',link)}}
function processLink(){try{const h=location.hash;if(!h.startsWith('#duel='))return;const d=decode(h.slice(6));if(d.v!==2)return;if(d.complete){toast('Resultado compartilhado: '+d.a.score+' × '+d.b.score+' pontos.');location.hash='';return}if(typeof d.playerId!=='string'||typeof d.rivalId!=='string'||!H[d.house]||!H[d.rivalId[0]]||d.playerId===d.rivalId||!Number.isInteger(d.score)||d.score<0||d.score>50||!choices(d.house).some(x=>x.id===d.playerId)||!choices(d.rivalId[0]).some(x=>x.id===d.rivalId))return;incoming=d;selectHouse(d.rivalId[0]);$('player').value=d.rivalId;$('mode').value=d.house===d.rivalId[0]?'challenge_same':'challenge';updateMode();$('rival-label').classList.add('hidden');$('difficulty-label').classList.add('hidden');toast('⚔️ Desafio recebido de '+byId(d.playerId)+' — '+d.score+' pontos!');$('hero-play').textContent='⚔️ ACEITAR O DESAFIO';}catch(e){console.warn('Desafio inválido',e)}}
const htmlSafe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function renderRanking(){
 const status=$('ranking-status');
 if(!online.enabled){
  status.textContent='⚠️ A planilha já foi criada, mas a API de classificação ainda não foi publicada. Nenhum resultado local é apresentado como ranking online.';
  $('rank-houses').innerHTML='<div class="empty">Aguardando ativação do serviço online pelo professor.</div>';
  $('rank-players').innerHTML='<div class="empty">Sem classificação online até a publicação da API.</div>';
  return;
 }
 status.textContent='⏳ Consultando os resultados oficiais no Google Sheets...';
 try{
  const data=await online.ranking();
  status.textContent='✅ Placar online — '+data.games+' desafios concluídos. Atualizado: '+new Date().toLocaleTimeString('pt-BR');
  const classes=data.classes||[],teams=data.teams||[],players=data.players||[];
  const groups=scoreTab==='teams'?teams:classes;
  $('rank-houses').innerHTML=groups.map((row,i)=>`<div class="rankline">
   <div><b>${['🥇','🥈','🥉'][i]||'🏹'} ${htmlSafe(H[row.name]?.name||row.name)}</b>
   <small>${row.members||0} integrantes · ${row.plays||0} participações</small></div>
   <span>${row.wins||0} vitórias</span></div>`).join('')||'<div class="empty">Nenhum duelo encerrado.</div>';
  $('rank-players').innerHTML=players.slice(0,25).map((p,i)=>`<div class="rankline">
   <div><b>${i+1}º · ${htmlSafe(p.name)}</b>
   <small>${htmlSafe(H[p.house]?.grade||p.house)} · ${htmlSafe(p.team)} · ${p.plays||0} partidas</small></div>
   <span>${p.wins||0} V · ${p.total||0} pts</span></div>`).join('')||'<div class="empty">Nenhum desafio concluído ainda.</div>';
 }catch(err){
  status.textContent='⚠️ Não foi possível consultar o placar: '+err.message;
  $('rank-houses').innerHTML='<div class="empty">Placar temporariamente indisponível.</div>';
  $('rank-players').innerHTML='<div class="empty">Os resultados permanecem no servidor; tente novamente.</div>';
 }
}

function showOnlineStatus(){
 const active=online.enabled&&online.state==='ready',user=online.user;
 $('online-status').classList.toggle('ok',active);
 $('online-status').classList.toggle('error',!active);
 $('online-account-name').textContent=user?'🏹 '+user.name+' · 4º '+user.house+' · '+user.team:'🏹 Escolha seu nome na lista';
 $('online-banner').textContent=active?'🟢 PLACAR ONLINE':'⚠️ TORNEIO ONLINE INDISPONÍVEL';
 $('online-status').textContent=!online.enabled?'⚠️ Servidor de resultados não configurado.':
  !active?'⏳ Consultando o placar...':user?'✅ Você pode ver seus desafios. Não há senha ou PIN.':'✅ Placar conectado. Escolha seu nome para receber desafios, sem PIN.';
 $('logout').classList.toggle('hidden',!user);
 $('open-inbox').disabled=!active;
 if(user&&($('player').value!==user.id||house!==user.house)){
  selectHouse(user.house);$('player').value=user.id;fillRivals();
 }
}
async function loginStudent(){
 const id=$('player').value;
 if(!id||id==='guest'){toast('Escolha seu nome na lista.');return null;}
 if(!online.enabled){toast('O placar online ainda não está configurado.');return null;}
 if(online.user?.id===id)return online.user;
 try{
  const user=await online.login(id);
  showOnlineStatus();
  const inbox=await refreshInbox();
  const received=inbox.filter(c=>c.recipient.id===user.id&&c.status==='PENDENTE').length;
  if(received){toast('🔔 Você recebeu '+received+' desafio(s)!');await openInbox();}
  else toast('🏹 Arqueiro selecionado: '+user.name);
  return user;
 }catch(error){toast('⚠️ Não foi possível selecionar o perfil: '+error.message);return null;}
}
function renderInbox(){
 const list=$('inbox-list');list.innerHTML='';
 $('inbox-status').textContent=online.user?
  'Os desafios ficam gravados. Você pode aceitar hoje ou em outra data; os cinco disparos do adversário serão reproduzidos.':
  'Entre com seu PIN para ver convites de outros alunos.';
 if(!onlineInbox.length){list.innerHTML='<div class="empty">Nenhum desafio para esta conta.</div>';return;}
 for(const ch of onlineInbox){
  const opponent=ch.creator.id===online.user?.id?ch.recipient:ch.creator;
  const mine=ch.creator.id===online.user?.id,score=mine?ch.creatorScore:ch.creatorScore;
  const item=document.createElement('article');item.className='cm-challenge';
  const title=document.createElement('strong');title.textContent=(mine?'📤 Você desafiou ':'🔔 Você foi desafiado por ')+opponent.name;
  const type={mesma_turma:'Mesma turma',entre_equipes:'Entre equipes',interclasses:'Interclasses'}[ch.kind]||ch.kind;
  const sub=document.createElement('small');sub.textContent=type+' · '+ch.status+' · '+new Date(ch.created).toLocaleDateString('pt-BR');
  const desc=document.createElement('p');desc.textContent=score===null?
    'Pontuação inicial ainda não enviada.':
    'Pontuação do primeiro arqueiro: '+score+' pontos (5 flechas).';
  item.append(title,sub,desc);
  const buttons=document.createElement('div');buttons.className='cm-challenge-actions';
  function action(label,kind,reject=false){
   const b=document.createElement('button');b.type='button';b.className='cm-challenge-btn'+(reject?' reject':'');
   b.textContent=label;b.dataset.id=ch.id;b.dataset.action=kind;buttons.appendChild(b);
  }
  if(!mine&&ch.status==='PENDENTE'){action('✅ ACEITAR DESAFIO','accept');action('❌ RECUSAR','decline',true)}
  else if(!mine&&ch.status==='ACEITO'){action('🏹 JOGAR MINHAS 5 FLECHAS','play')}
  else if(mine&&ch.status==='CRIADOR_JOGANDO'){action('🏹 RETOMAR MINHA RODADA','play')}
  else if(ch.status==='CONCLUIDO'){
   const result=document.createElement('p');
   const own=mine?ch.creatorScore:ch.recipientScore,other=mine?ch.recipientScore:ch.creatorScore;
   result.textContent='🏆 Resultado oficial: '+own+' × '+other+' pontos. '+(own>other?'Vitória!':own===other?'Empate!':'Derrota.');
   item.appendChild(result);
  }else{const state=document.createElement('small');state.textContent=ch.status==='PENDENTE'?'⏳ Aguardando o colega responder.':ch.status==='RECUSADO'?'🚫 Convite recusado.':'⏳ Aguardando a rodada do adversário.';item.appendChild(state)}
  if(buttons.children.length)item.appendChild(buttons);list.appendChild(item);
 }
}
async function refreshInbox(){
 if(!online.enabled||!online.user){onlineInbox=[];$('unread-count').textContent='0';return [];}
 onlineInbox=await online.inbox();
 const pending=onlineInbox.filter(c=>c.recipient.id===online.user.id&&c.status==='PENDENTE').length;
 $('unread-count').textContent=String(pending);
 $('open-inbox').title=pending?'Você recebeu '+pending+' desafio(s)!':'Nenhum desafio pendente';
 renderInbox();return onlineInbox;
}
async function openInbox(){
 if(!online.user){const selected=await loginStudent();if(!selected){toast('Escolha seu nome para abrir seus desafios.');return;}}
 $('online-inbox').classList.remove('hidden');
 $('inbox-status').textContent='⏳ Consultando convites recebidos...';
 try{await refreshInbox()}catch(e){$('inbox-status').textContent='⚠️ Falha ao carregar desafios: '+e.message}
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
 showOnlineStatus();
 if(!online.enabled)return;
 try{
  await online.connect();await online.list();showOnlineStatus();
  const remembered=localStorage.getItem('cm_arco_nome');
  if(!online.user&&/^[ABC]\d{2}$/.test(remembered||'')){
   selectHouse(remembered[0]);$('player').value=remembered;await loginStudent();
  }
  const pendentes=await refreshInbox();renderRanking();
   if(online.user&&pendentes.some(c=>c.recipient.id===online.user.id&&c.status==='PENDENTE')){
     toast('🔔 Você foi desafiado! Aceite ou recuse quando quiser.');await openInbox();
   }
 }catch(error){online.state='error';showOnlineStatus();$('online-status').textContent='⚠️ Serviço online indisponível: '+error.message;}
}

// Interações do jogo.
document.querySelectorAll('.nav-link').forEach(el=>el.addEventListener('click',()=>openView(el.dataset.view)));
document.querySelectorAll('.house').forEach(el=>el.addEventListener('click',()=>selectHouse(el.dataset.house)));
$('hero-play').addEventListener('click',()=>{
 $('setup').scrollIntoView({behavior:'smooth',block:'center'});
 $('player').focus();
 toast('Escolha seu nome e o circuito de distância para jogar.');
});
$('mode').addEventListener('change',updateMode);
$('player').addEventListener('change',()=>{fillRivals();if($('player').value!=='guest')loginStudent().catch(console.warn)});
$('team-scope').addEventListener('change',updateMode);
$('opponent-house').addEventListener('change',fillRivals);
$('opponent-team').addEventListener('change',fillRivals);
$('my-team').addEventListener('change',()=>{
 const mate=choices(house).find(p=>TEAMS[p.id]===$('my-team').value);
 if(mate){$('player').value=mate.id;loginStudent().catch(console.warn)}
 fillRivals();
});$('start-game').addEventListener('click',startMatch);$('rank-play').addEventListener('click',()=>openView('inicio'));$('rules-play').addEventListener('click',()=>openView('inicio'));$('leave-arena').addEventListener('click',()=>{if(match?.running&&!confirm('Abandonar a rodada atual e começar uma nova depois?'))return;openView('inicio')});$('play-again').addEventListener('click',()=>{match.running=false;startMatch()});$('share-result').addEventListener('click',()=>{if(match?.onlineSaveFailed)finishMatch();else if(!match?.online)share()});
const world=$('world');world.addEventListener('pointerdown',e=>{if(!match?.running||match.locked)return;e.preventDefault();world.setPointerCapture(e.pointerId);holding=true;pointerStart=Date.now();aim(e);scene?.setPower(.28);$('stage').classList.add('aiming');$('instruction').textContent='ARRASTE PARA MOVER O ARCO • SOLTE PARA ATIRAR'});world.addEventListener('pointermove',e=>{if(!match?.running||match.locked)return;if(holding||e.pointerType==='mouse')aim(e);if(holding)scene?.setPower(clamp((Date.now()-pointerStart)/950,.28,1))});world.addEventListener('pointerup',e=>{if(!holding)return;e.preventDefault();aim(e);holding=false;$('stage').classList.remove('aiming');$('instruction').textContent='MOVA OU ARRASTE PARA MIRAR • SEGURE PARA PUXAR • SOLTE PARA ATIRAR';const p=clamp((Date.now()-pointerStart)/950,.28,1);scene?.setPower(p);fire(p);uiHud()});world.addEventListener('pointercancel',()=>{holding=false;$('stage').classList.remove('aiming');scene?.setPower(0)});
document.addEventListener('keydown',e=>{if(view!=='arena'||!match?.running||match.locked)return;let action=true;const step=e.shiftKey?.022:.008;switch(e.code){case'ArrowUp':reticle.y=clamp(reticle.y-step,.1,.9);break;case'ArrowDown':reticle.y=clamp(reticle.y+step,.1,.9);break;case'ArrowLeft':reticle.x=clamp(reticle.x-step,.08,.92);break;case'ArrowRight':reticle.x=clamp(reticle.x+step,.08,.92);break;case'Space':fire(1);break;default:action=false}if(action){e.preventDefault();updateReticle()}});
setInterval(()=>{if(holding){scene?.setPower(clamp((Date.now()-pointerStart)/950,.28,1));uiHud()}},90);

$('open-inbox').addEventListener('click',openInbox);
$('close-inbox').addEventListener('click',()=>$('online-inbox').classList.add('hidden'));
$('online-inbox').addEventListener('click',e=>{if(e.target===$('online-inbox'))$('online-inbox').classList.add('hidden')});
$('inbox-list').addEventListener('click',onInboxAction);
$('logout').addEventListener('click',()=>{if(match?.running){toast('Termine ou abandone esta rodada antes de sair da conta.');return;}online.logout();onlineInbox=[];$('player').value='guest';fillRivals();showOnlineStatus();$('unread-count').textContent='0';toast('Selecione outro arqueiro na lista.')});
document.querySelectorAll('[data-rank]').forEach(btn=>btn.addEventListener('click',()=>{
 scoreTab=btn.dataset.rank;document.querySelectorAll('[data-rank]').forEach(x=>x.classList.toggle('active',x===btn));renderRanking();
}));
selectHouse('A');updateMode();processLink();renderRanking();
startOnlineClient();
setInterval(async()=>{if(!online.user)return;try{const prev=Number($('unread-count').textContent)||0;const rows=await refreshInbox();const unread=rows.filter(c=>c.recipient.id===online.user.id&&c.status==='PENDENTE').length;if(unread>prev){toast('🔔 Novo desafio recebido!');await openInbox()}}catch(error){console.warn('Convites online:',error)}},120000);