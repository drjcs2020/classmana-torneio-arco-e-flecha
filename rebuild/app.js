
import {tournament} from './api.js?v=rebuild1';
import {RebuiltArena} from './arena.js?v=rebuild1';

const $=id=>document.getElementById(id);
const HOUSE={
 A:{name:'Águia Dourada',grade:'4º A',archers:['Auron','Lyra'],images:['arqueiro-aguia-dourada.png','arqueira-aguia-dourada.png']},
 B:{name:'Leão de Fogo',grade:'4º B',archers:['Kael','Valéria'],images:['arqueiro-leao-de-fogo.png','arqueira-leao-de-fogo.png']},
 C:{name:'Dragão de Esmeralda',grade:'4º C',archers:['Thalion','Elara'],images:['arqueiro-dragao-de-esmeralda.png','arqueira-dragao-de-esmeralda.png']}
};
const DISTANCE={iniciante:[10,35,65,100,150],avancado:[20,45,75,110,150],lendario:[30,60,90,120,150]};
const MODE={bot:'Contra robô',practice:'Treino livre',challenge_same:'Colega da mesma turma',challenge:'Duelo interclasses',challenge_team:'Entre equipes'};
const KINDS={challenge_same:'mesma_turma',challenge:'interclasses',challenge_team:'entre_equipes'};
const ROSTER=window.CLASSMANA_ROSTER||{};
const TEAMS=window.CLASSMANA_TEAMS||{};
let house='A',heroIndex=0,bow='classico',mode='bot',screen='houses',onlineError='',match=null,arena=null,busy=false,lastScreen='houses';
let roster=[];
let rankTab='players',toastTimer=null;
const allScreens=[...document.querySelectorAll('.screen')];
const urlParams=new URLSearchParams(location.search);
if(urlParams.has('qa'))window.classmanaQA={getScreen:()=>screen,getMatch:()=>match,getTransport:()=>tournament.mode};
function show(name){
 if(!allScreens.find(x=>x.dataset.view===name))throw Error('Tela inválida: '+name);
 if(name!==screen&&name!=='arena'&&name!=='results')lastScreen=screen;
 screen=name;
 for(const s of allScreens)s.classList.toggle('active',s.dataset.view===name);
 document.body.dataset.screen=name;
 $('route-text').textContent=({houses:'ESCOLHA SUA CASA',hero:'SELEÇÃO DO ARQUEIRO',modes:'ESCOLHA O DESAFIO',setup:'PREPARE A PARTIDA',arena:'ARENA DOS CAMPEÕES',results:'RESULTADO DA PARTIDA',inbox:'MEUS DESAFIOS',ranking:'SALÃO DOS CAMPEÕES'})[name]||'CLASSMANA';
 if(name==='inbox')loadInboxView();
 if(name==='ranking')loadRanking();
 window.scrollTo?.(0,0);
}
function notice(text,ms=6500){
 const el=$('message');el.textContent=text;el.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,ms);
}
function setStatus(text,good=false){
 $('connection').textContent=(good?'● ':'⚠ ')+text;
 $('connection').style.color=good?'#d0ffbc':'#ffe5b3';
}
function nameOf(id){
 const p=roster.find(x=>x.id===id);
 if(p)return p.name;
 const group=ROSTER[id?.[0]]||[],idx=Number(id?.slice(1))-1;
 return group[idx]||id;
}
function teamOf(id){return roster.find(x=>x.id===id)?.team||TEAMS[id]||'Sem equipe';}
function availableList(){
 if(roster.length)return roster;
 return Object.entries(ROSTER).flatMap(([h,arr])=>arr.map((n,i)=>({id:h+String(i+1).padStart(2,'0'),name:n,house:h,team:TEAMS[h+String(i+1).padStart(2,'0')]||''})));
}
function selectValues(select,items,preferred=''){
 const current=preferred||select.value;
 select.replaceChildren();
 for(const item of items){
  const option=document.createElement('option');
  option.value=String(item.id);option.textContent=item.text;
  select.appendChild(option);
 }
 if(items.some(item=>String(item.id)===current))select.value=current;
}
function studentOptions(list){return list.map(p=>({id:p.id,text:p.id+' · '+p.name+' · '+HOUSE[p.id[0]].grade}));}
function refreshRoster(){
 roster=tournament.roster;
 const players=availableList().filter(p=>p.id[0]===house);
 const chosen=tournament.user?.id?.[0]===house?tournament.user.id:players[0]?.id||'';
 selectValues($('player'),studentOptions(players),chosen);
 selectValues($('inbox-player'),studentOptions(availableList()),tournament.user?.id||chosen);
 refreshRivals();
}
async function connect(force=false){
 if(busy&&!force)return;
 setStatus('Verificando servidor de desafios...');
 try{
  const r=await tournament.connect();
  onlineError='';
  setStatus('Competições online disponíveis · '+r.students+' arqueiros',true);
  refreshRoster();
  if(tournament.user)await refreshUnread();
 }catch(e){
  onlineError=e.message;
  setStatus('Desafios online indisponíveis');
  refreshRoster();
  console.error('ClassMana torneio:',e);
 }
}
function heroArt(){
 const data=HOUSE[house],image=data.images[heroIndex];
 $('selected-hero').src='../assets/ui/characters/'+image;
 $('selected-hero').alt=data.archers[heroIndex]+' da Casa '+data.name;
 $('hero-caption').textContent=data.archers[heroIndex]+' · '+data.name;
 $('result-hero').src=$('selected-hero').src;
}
function selectHouse(h){
 house=h;document.body.dataset.house=h;heroIndex=0;heroArt();refreshRoster();
 show('hero');
}
function selectMode(next){
 mode=next;$('mode').value=next;
 show('setup');refreshRivals();
 $('setup-helper').textContent=KINDS[next]?'O convite é salvo antes dos cinco disparos. O adversário pode responder depois.':'Escolha seu nome e comece a jogar.';
}
function refreshRivals(){
 const m=$('mode').value;
 $('bot-level-row').hidden=m!=='bot';
 const official=Boolean(KINDS[m]);
 const isTeams=m==='challenge_team';
 $('team-scope-row').hidden=!isTeams;
 const isOther=m==='challenge'||(isTeams&&$('team-scope').value==='other');
 $('enemy-house-row').hidden=!isOther;
 $('enemy-team-row').hidden=!isTeams;
 $('enemy-row').hidden=!official;
 if(!official)return;
 const me=$('player').value;
 const people=availableList();
 const otherHouses=['A','B','C'].filter(x=>x!==house);
 selectValues($('enemy-house'),otherHouses.map(h=>({id:h,text:HOUSE[h].grade+' · '+HOUSE[h].name})));
 const opponentHouse=isOther?$('enemy-house').value:house;
 const teams=[...new Set(people.filter(p=>p.id[0]===opponentHouse).map(p=>p.team||teamOf(p.id)))].sort();
 let filteredTeams=teams;
 if(isTeams&&!isOther)filteredTeams=teams.filter(t=>t!==teamOf(me));
 selectValues($('enemy-team'),filteredTeams.map(t=>({id:t,text:t})));
 let rivals=people.filter(p=>p.id!==me&&p.id[0]===opponentHouse);
 if(isTeams)rivals=rivals.filter(p=>(p.team||teamOf(p.id))===$('enemy-team').value);
 selectValues($('enemy'),studentOptions(rivals));
}
function guessLocal(shot,cfg,level,bowType,index){
 const options={classico:{wind:1,ring:1,bonus:0},real:{wind:1,ring:1.12,bonus:1},vento:{wind:.5,ring:1,bonus:0}}[bowType]||{wind:1,ring:1,bonus:0};
 const difficulty=Math.pow(Math.max(10,cfg.distance)/30,.55);
 const flight=.43+.42*Math.pow(Math.max(10,cfg.distance)/80,.56)+.13*(1-shot.power);
 const moving=(t)=>{
  if(level==='avancado')return {x:2.05*Math.sin(t*1.35+index*1.11),y:0};
  if(level==='lendario')return {x:2.6*Math.sin(t*1.61+index*1.11),y:.36*Math.sin(t*.83+index*1.14)};
  return {x:0,y:0};
 };
 const before=moving(shot.time),after=moving(shot.time+flight);
 const dx=shot.dx+cfg.wind*options.wind*.04*difficulty-(after.x-before.x);
 const dy=shot.dy+(1-shot.power)*.70*difficulty-(after.y-before.y);
 const blocked=level==='lendario'&&Math.abs(dx-.67*Math.sin((shot.time+flight)*2.2+index*1.31))<.28&&Math.abs(dy-.17*Math.cos((shot.time+flight)*1.37+index*.71))<.60;
 const r=Math.hypot(dx,dy)*options.ring;
 const pts=blocked||r>1?0:Math.max(1,10-Math.floor(r*10));
 return pts?Math.min(10,pts+options.bonus):0;
}
function roundConfig(index){
 return match.challenge?.settings?.[index]||{index,distance:DISTANCE[match.level]?.[index]||DISTANCE.iniciante[index],wind:Math.round((Math.random()*8-4)*10)/10,shift:0};
}
function startRound(index){
 match.index=index;
 const cfg=roundConfig(index);match.currentConfig=cfg;
 $('arena-stage-title').textContent='🏹 FLECHA '+(index+1)+' / 5';
 $('arena-distance').textContent='🎯 '+cfg.distance+' METROS';
 $('arena-wind').textContent='🌬 Vento '+Number(cfg.wind).toFixed(1)+' km/h';
 $('arena-points').textContent='PONTOS: '+match.scores.reduce((a,b)=>a+b,0);
 $('arena-tip').textContent='MOVA PARA MIRAR • SEGURE PARA PUXAR • SOLTE PARA DISPARAR';
 arena.start({house,bow:match.bow,cfg,index,level:match.level,onShot:receiveShot});
}
async function receiveShot(shot){
 if(!match||match.scores.length>=5)return;
 match.shots.push(shot);
 const pts=guessLocal(shot,match.currentConfig,match.level,match.bow,match.index);
 match.scores.push(pts);
 $('arena-points').textContent='PONTOS: '+match.scores.reduce((a,b)=>a+b,0);
 $('arena-tip').textContent=(pts?'🎯 ACERTO! +'+pts+' PONTOS':'FLECHA DISPARADA • '+pts+' PONTOS');
 if(match.scores.length===5){
  arena.stop();await finishMatch();
 }else setTimeout(()=>{if(match&&screen==='arena')startRound(match.scores.length)},680);
}
async function beginMatch(challenge=null){
 if(busy)return;
 busy=true;
 $('start-match').disabled=true;
 let created=null;
 try{
  const kind=challenge?.kind||KINDS[$('mode').value];
  let id=challenge?.recipient?.id||$('player').value;
  if(kind){
   if(!tournament.apiVersion)throw Error('O servidor online ainda não está disponível. '+onlineError);
   if(challenge){
    id=tournament.user?.id;
    const ownReply=challenge.recipient?.id===id&&challenge.status==='ACEITO';
    const ownCreator=challenge.creator?.id===id&&challenge.status==='CRIADOR_JOGANDO';
    if(!ownReply&&!ownCreator)throw Error('Este desafio não está disponível para iniciar com este aluno.');
    created=challenge;
   }else{
    await tournament.login(id);
    const rival=$('enemy').value;
    if(!rival)throw Error('Escolha um adversário disponível.');
    if(id===rival)throw Error('Você não pode desafiar seu próprio perfil.');
    $('setup-helper').textContent='⏳ Registrando convite na planilha...';
    created=await tournament.create(kind,rival,$('level').value);
    // O servidor precisa devolver o identificador e registrar o desafio.
    if(!created?.id)throw Error('O servidor não confirmou o convite.');
   }
  }
  const level=created?.level||$('level').value;
  const selected=created?created.creator?.id===id?'creator':'recipient':'none';
  match={
   id,mode:kind?'online':$('mode').value,kind,challenge:created,role:selected,
   bow,level,shots:[],scores:[],index:0,botLevel:$('bot-level').value
  };
  show('arena');
  if(!arena)arena=new RebuiltArena($('arena-stage'));
  await arena.initialize();
  // O desafiante joga primeiro; o convidado vê uma reconstituição das
  // cinco flechas já gravadas, sem precisar estar conectado simultaneamente.
  if(selected==='recipient'&&created?.creatorShots?.length){
   $('arena-tip').textContent='⚔️ Revendo as cinco flechas do adversário...';
   for(let k=0;k<created.creatorShots.length;k++){
    $('arena-stage-title').textContent='FLECHAS DO DESAFIANTE '+(k+1)+' / 5';
    $('arena-distance').textContent='🎯 '+(created.creatorShots[k].distance||DISTANCE[level]?.[k]||10)+' METROS';
    $('arena-points').textContent='PONTOS DO ADVERSÁRIO: '+created.creatorShots.slice(0,k+1).reduce((a,s)=>a+(Number(s.score)||0),0);
    await new Promise(resolve=>setTimeout(resolve,460));
   }
  }
  startRound(0);
 }catch(e){
  if(match&&screen==='arena')show('setup');
  notice('⚠️ '+e.message,9500);
  console.error('Falha ao iniciar o torneio:',e);
 }finally{
  busy=false;$('start-match').disabled=false;
 }
}
async function finishMatch(){
 if(!match)return;
 const m=match,local=m.scores.reduce((a,b)=>a+b,0);
 $('result-score').textContent=local;
 $('result-title').textContent='FIM DE PARTIDA';
 $('result-subtitle').textContent=m.mode==='online'?'Confirmando os cinco disparos no servidor...':'Treinamento encerrado';
 $('result-rival').textContent=m.mode==='online'?'Não feche a partida antes da confirmação.':m.mode==='practice'?'Pontuação de treino • sem ranking':'Resultado contra o robô';
 show('results');
 if(m.mode==='online'){
  try{
   const response=await tournament.submit(m.challenge.id,m.shots);
   if(!response?.challenge)throw Error('O servidor não confirmou o resultado.');
   $('result-score').textContent=String(response.score);
   const done=response.challenge.status==='CONCLUIDO';
   const a=response.challenge.creatorScore,b=response.challenge.recipientScore;
   if(done){
    const mine=m.role==='creator'?a:b,theirs=m.role==='creator'?b:a;
    $('result-title').textContent=mine>theirs?'🏆 VITÓRIA!':mine<theirs?'⚔️ DERROTA':'🤝 EMPATE';
    $('result-subtitle').textContent='Desafio oficial concluído e salvo na planilha.';
    $('result-rival').textContent=nameOf(m.role==='creator'?m.challenge.recipient.id:m.challenge.creator.id)+' · '+theirs+' pontos';
   }else{
    $('result-title').textContent='🏹 DESAFIO ENVIADO!';
    $('result-subtitle').textContent='Seus cinco disparos foram salvos.';
    $('result-rival').textContent=nameOf(m.challenge.recipient.id)+' receberá o convite quando entrar, mesmo em outro dia.';
   }
   await refreshUnread();
  }catch(e){
   $('result-title').textContent='⚠️ PONTUAÇÃO NÃO CONFIRMADA';
   $('result-subtitle').textContent='Não é seguro dizer que o resultado foi salvo.';
   $('result-rival').textContent=e.message+' · Consulte Meus desafios antes de tentar novamente.';
  }
 }else if(m.mode==='bot'){
  const baseline={easy:19,medium:28,hard:38}[m.botLevel]||28;
  const botScore=Math.max(0,Math.min(50,baseline+Math.round((Math.random()-.5)*17)));
  $('result-title').textContent=local>botScore?'🏆 VITÓRIA!':local<botScore?'⚔️ DERROTA':'🤝 EMPATE';
  $('result-subtitle').textContent='Partida contra o robô • sem pontos oficiais';
  $('result-rival').textContent='ROBÔ · '+botScore+' PONTOS';
 }
}
async function refreshUnread(){
 if(!tournament.user)return;
 try{
  const inbox=await tournament.inbox();
  $('pending-count').textContent=inbox.filter(c=>c.recipient.id===tournament.user.id&&c.status==='PENDENTE').length;
 }catch(e){console.warn('Avisos de desafios:',e.message)}
}
async function loadInboxView(){
 const select=$('inbox-player');
 const pref=tournament.user?.id||$('player').value;
 selectValues(select,studentOptions(availableList()),pref);
 if(tournament.user)await loadInbox(false);
}
function inviteCard(challenge){
 const root=document.createElement('article');root.className='invite';
 const own=tournament.user?.id||'';
 const from=challenge.creator.id===own;
 const opponent=from?challenge.recipient:challenge.creator;
 const state=challenge.status;
 const left=document.createElement('div');
 const title=document.createElement('strong');
 title.textContent=(from?'Você desafiou: ':'Você foi desafiado por: ')+opponent.name;
 const sub=document.createElement('small');
 sub.textContent=(challenge.kind==='interclasses'?'🏰 Interclasses':challenge.kind==='entre_equipes'?'🛡️ Equipes':'🏹 Colegas')+
  ' · '+challenge.level+' · '+state.replaceAll('_',' ');
 left.append(title,sub);
 const actions=document.createElement('div');actions.className='invite-actions';
 const add=(label,fn)=>{
  const button=document.createElement('button');
  button.className='rune-button';button.textContent=label;
  button.addEventListener('click',async()=>{button.disabled=true;try{await fn()}catch(e){notice(e.message)}finally{button.disabled=false}});
  actions.appendChild(button);
 };
 if(!from&&state==='PENDENTE'){
  add('✓ ACEITAR',async()=>{
   const accepted=await tournament.answer(challenge.id,'accept');
   await beginMatch(accepted);
  });
  add('✕ RECUSAR',async()=>{await tournament.answer(challenge.id,'decline');await loadInbox(false)});
 }else if(!from&&state==='ACEITO')add('🏹 JOGAR AGORA',()=>beginMatch(challenge));
 else if(from&&state==='CRIADOR_JOGANDO')add('↻ REINICIAR MINHA RODADA',()=>beginMatch(challenge));
 else if(state==='CONCLUIDO')add('🏆 VER RESULTADO',()=>{
  notice('Placar: '+challenge.creator.name+' '+challenge.creatorScore+' × '+challenge.recipientScore+' '+challenge.recipient.name,8000);
 });
 root.append(left,actions);return root;
}
async function loadInbox(shouldLogin=true){
 const select=$('inbox-player'),id=select.value;
 if(!id){notice('Escolha seu nome.');return}
 $('challenge-list').textContent='⏳ Consultando convites na planilha...';
 try{
  if(!tournament.apiVersion)throw Error('Servidor offline: '+onlineError);
  if(shouldLogin||tournament.user?.id!==id)await tournament.login(id);
  const items=await tournament.inbox();
  const list=$('challenge-list');list.replaceChildren();
  if(!items.length){const p=document.createElement('p');p.textContent='Nenhum desafio recebido. Seus convites aparecerão aqui quando outro colega jogar.';list.appendChild(p)}
  else for(const item of items)list.appendChild(inviteCard(item));
  $('inbox-hint').textContent='Arqueiro: '+nameOf(id)+' · '+items.length+' desafios encontrados.';
  refreshUnread();
 }catch(e){
  $('challenge-list').textContent='⚠️ Não foi possível carregar os desafios: '+e.message;
 }
}
async function loadRanking(){
 const el=$('rank-content');el.textContent='⏳ Carregando resultados oficiais...';
 try{
  const data=await tournament.ranking(),arr=data[rankTab]||[];
  el.replaceChildren();
  if(!arr.length){el.textContent='Ainda não há desafios oficiais concluídos nesta categoria.';return}
  for(let i=0;i<arr.length;i++){
   const p=arr[i],row=document.createElement('div');row.className='rank-entry';
   const pos=document.createElement('span');pos.textContent=(i+1)+'º';
   const label=document.createElement('div');const main=document.createElement('strong');
   main.textContent=p.name;const more=document.createElement('small');
   more.textContent=(p.plays||0)+' partidas · '+(p.wins||0)+' vitórias · '+(p.ties||0)+' empates';
   label.append(main,more);const score=document.createElement('strong');
   score.textContent=(p.total||0)+' PTS';row.append(pos,label,score);el.appendChild(row);
  }
 }catch(e){el.textContent='⚠️ Ranking indisponível: '+e.message}
}
async function handleStart(){
 if(KINDS[$('mode').value]&&!tournament.apiVersion){notice('Competição online indisponível: '+onlineError,9000);return}
 await beginMatch();
}
function back(){
 if(screen==='arena'){arena?.stop();match=null;show('setup');return}
 if(screen==='results'){show('modes');return}
 if(screen==='inbox'||screen==='ranking'){show(lastScreen==='inbox'||lastScreen==='ranking'?'houses':lastScreen);return}
 show(({setup:'modes',modes:'hero',hero:'houses'})[screen]||'houses');
}
for(const el of document.querySelectorAll('[data-pick-house]'))el.addEventListener('click',()=>selectHouse(el.dataset.pickHouse));
$('hero-prev').addEventListener('click',()=>{heroIndex=heroIndex===0?1:0;heroArt()});
$('hero-next').addEventListener('click',()=>{heroIndex=heroIndex===0?1:0;heroArt()});
for(const el of document.querySelectorAll('[data-bow]'))el.addEventListener('click',()=>{bow=el.dataset.bow;document.querySelectorAll('[data-bow]').forEach(x=>x.classList.toggle('chosen',x===el))});
$('hero-confirm').addEventListener('click',()=>show('modes'));
for(const el of document.querySelectorAll('[data-mode]'))el.addEventListener('click',()=>selectMode(el.dataset.mode));
$('player').addEventListener('change',refreshRivals);
$('mode').addEventListener('change',()=>{mode=$('mode').value;refreshRivals()});
$('enemy-house').addEventListener('change',refreshRivals);
$('enemy-team').addEventListener('change',refreshRivals);
$('team-scope').addEventListener('change',refreshRivals);
$('start-match').addEventListener('click',handleStart);
$('reconnect').addEventListener('click',()=>connect(true));
$('open-ranks').addEventListener('click',()=>show('ranking'));
$('open-challenges').addEventListener('click',()=>show('inbox'));
$('inbox-load').addEventListener('click',()=>loadInbox());
$('result-continue').addEventListener('click',()=>{match=null;show('modes')});
$('result-inbox').addEventListener('click',()=>show('inbox'));
$('nav-back').addEventListener('click',back);
for(const b of document.querySelectorAll('[data-rank]'))b.addEventListener('click',()=>{
 rankTab=b.dataset.rank;document.querySelectorAll('[data-rank]').forEach(x=>x.classList.toggle('chosen',x===b));loadRanking();
});
refreshRoster();heroArt();connect();
