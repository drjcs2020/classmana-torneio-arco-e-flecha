/**
 * ClassMana — Torneio de Arco e Flecha, API assíncrona v1.
 * Implantar como Google Apps Script Web App: executar como PROPRIETÁRIO,
 * acesso Qualquer pessoa (não compartilhe a planilha). Identificação por nome,
 * SEM PIN: conveniente para a escola, mas NÃO comprova a identidade real.
 *
 * Frontend: POST por form/iframe (evita bloqueio CORS do Apps Script),
 * GET JSONP apenas para respostas/consultas. IDs de operação aleatórios e
 * tokens de sessão randômicos permitem ler o resultado de cada POST.
 */
const CM_DB = '1LLfPMMB7LMmRv8jeHqUHUpj3U-uX0j4Y6kW6lDtmREY';
const CM_V = 7;
const CM_DISTANCES={iniciante:[10,35,65,100,150],avancado:[20,45,75,110,150],lendario:[30,60,90,120,150]};
/** Reproduz a mesma proteção dinâmica da arena no navegador; tempo em segundos. */
function cmObstacle_(level,index,time){
 if(level!=='lendario')return null;
 const t=Math.max(0,Math.min(120,Number(time)||0));
 return {x:.67*Math.sin(t*2.2+index*1.31),y:.17*Math.cos(t*1.37+index*.71),width:.28,height:.60};
}
function cmObstructed_(level,index,time,x,y){
 const o=cmObstacle_(level,index,time);
 return !!o&&Math.abs(x-o.x)<o.width&&Math.abs(y-o.y)<o.height;
}
function cmRules_(challenge){
 const stored=Number(String(challenge[14]||'').split('|')[0]);
 return Number.isInteger(stored)&&stored>=4?stored:4;
}
function cmTargetMotion_(level,index,time){
 const t=Math.max(0,Math.min(120,Number(time)||0));
 if(level==='avancado')return {x:2.05*Math.sin(t*1.35+index*1.11),y:0};
 if(level==='lendario')return {x:2.60*Math.sin(t*1.61+index*1.11),y:.36*Math.sin(t*.83+index*1.14)};
 return {x:0,y:0};
}
function cmFlight_(distance,power){
 return .43+.42*Math.pow(Math.max(10,distance)/80,.56)+.13*(1-power);
}
function cmLevel_(challenge){const v=String(challenge[14]||'');const level=v.split('|')[1];return CM_DISTANCES[level]?level:'iniciante'}
const CM_TTL = 7*24*3600*1000;
const CM_TYPES = ['mesma_turma','entre_equipes','interclasses'];
const CM_STATUS = {CRIADOR:'CRIADOR_JOGANDO',PENDENTE:'PENDENTE',ACEITO:'ACEITO',RECUSADO:'RECUSADO',CONCLUIDO:'CONCLUIDO'};
const CM_COL = {
 Alunos:['id','apelido','turma','equipe','salt','pin_hash','ativo','criado_em'],
 Desafios:['desafio_id','tipo','criador_id','destinatario_id','status','criado_em','aceito_em','recusado_em','finalizado_em','score_criador','score_destinatario','tiros_criador_json','tiros_destinatario_json','vencedor_id','versao'],
 Disparos:['disparo_id','desafio_id','autor_id','ordem','mira_x','mira_y','forca','vento','distancia','alvo_x','alvo_y','pontuacao','criado_em'],
 Ranking:['id','apelido','turma','equipe','partidas','vitorias','empates','derrotas','pontos_total','pontuacao_media','ultima_partida'],
 Credenciais_professor:['id','pin_inicial','gerado_em','entregue'],
 Sessoes:['token_hash','aluno_id','expira_em','criado_em'],
 Configuracao:['chave','valor'], Eventos:['evento_id','criado_em','aluno_id','acao','detalhes'],
 Operacoes:['request_id','token_hash','status','resposta_json','criado_em']
};
function cmBook_(){return SpreadsheetApp.openById(CM_DB)}
function cmSheet_(book,name){const sh=book.getSheetByName(name);if(!sh)throw Error('Falta aba: '+name);return sh}
function cmValues_(sh){const v=sh.getDataRange().getValues();return v.length>1?v.slice(1):[]}
function cmRows_(sh){const v=cmValues_(sh);return v.map((x,i)=>({row:i+2,data:x}))}
function cmNow_(){return new Date().toISOString()}
function cmDigest_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(x=>('0'+(x&255).toString(16)).slice(-2)).join('')}
function cmUuid_(){return Utilities.getUuid().replace(/-/g,'')}
function cmStudent_(db,id){const item=cmRows_(cmSheet_(db,'Alunos')).find(x=>String(x.data[0])===id);if(!item||item.data[6]===false||String(item.data[6]).toLowerCase()==='false')throw Error('Aluno não autorizado');return item}
function cmPublicStudent_(x){return {id:String(x[0]),name:String(x[1]),house:String(x[2]).slice(-1),team:String(x[3])}}
function cmSession_(db,token){if(!/^[0-9a-f]{32,128}$/i.test(token||''))throw Error('Sessão inválida');const hash=cmDigest_(token),now=Date.now();const row=cmRows_(cmSheet_(db,'Sessoes')).find(x=>x.data[0]===hash);if(!row||new Date(row.data[2]).getTime()<now)throw Error('Sessão expirada: entre novamente');return cmStudent_(db,String(row.data[1]))}
function cmWithLock_(work){const lock=LockService.getScriptLock();if(!lock.tryLock(25000))throw Error('Servidor ocupado: tente novamente');try{return work()}finally{lock.releaseLock()}}
function cmReply_(o,callback){const payload=JSON.stringify(o);if(callback && /^[a-zA-Z_$][a-zA-Z0-9_$]{0,70}$/.test(callback))return ContentService.createTextOutput(callback+'('+payload+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON)}
function cmPublicRoster_(db){return cmValues_(cmSheet_(db,'Alunos')).filter(x=>x[6]!==false&&String(x[6]).toLowerCase()!=='false').map(cmPublicStudent_)}
function cmChallenges_(db){return cmValues_(cmSheet_(db,'Desafios')).map((d,i)=>({row:i+2,data:d}))}
function cmFindChallenge_(db,id){const c=cmChallenges_(db).find(x=>String(x.data[0])===id);if(!c)throw Error('Desafio não encontrado');return c}
function cmPerson_(db,id){return cmPublicStudent_(cmStudent_(db,id).data)}
function cmVisible_(db,item,id){const c=item.data; if(c[2]!==id&&c[3]!==id)throw Error('Sem acesso ao desafio');return cmSummary_(db,c,id)}
function cmSummary_(db,c,viewer){let a=cmPerson_(db,String(c[2])),b=cmPerson_(db,String(c[3]));let p=c[11]?JSON.parse(String(c[11])):[],q=c[12]?JSON.parse(String(c[12])):[];
return {id:String(c[0]),kind:String(c[1]),creator:a,recipient:b,status:String(c[4]),created:String(c[5]),accepted:c[6]?String(c[6]):null,finished:c[8]?String(c[8]):null,creatorScore:c[9]===''?null:Number(c[9]),recipientScore:c[10]===''?null:Number(c[10]),creatorShots:p,recipientShots:q,winner:c[13]?String(c[13]):null,rules:cmRules_(c),level:cmLevel_(c),settings:[0,1,2,3,4].map(i=>cmRound_(String(c[0]),i,cmLevel_(c)))}}
function cmRound_(id,index,level='iniciante'){
 const seed=cmDigest_(id+':'+index),u=k=>parseInt(seed.slice(k,k+7),16)/0xfffffff;
 const distance=CM_DISTANCES[level]?.[index]||CM_DISTANCES.iniciante[index];
 const windFactor=.65+Math.pow(distance/70,.45)*.55;
 return {index,wind:Math.round((-4+8*u(0))*windFactor*10)/10,
   shift:Math.round((-.045+.09*u(7))*1000)/1000,distance};
}
function cmScore_(dx,dy,power,wind,distance,level,index,time,rules,bow='classico'){
 let profile={classico:{wind:1,ring:1,bonus:0},real:{wind:1,ring:1.12,bonus:1},vento:{wind:.5,ring:1,bonus:0}}[bow]||{wind:1,ring:1,bonus:0};
 // Regras v6 mantidas para desafios antigos, v7 introduz equipamentos.
 if(rules<7)profile={wind:1,ring:1,bonus:0};
 const difficulty=Math.pow(Math.max(10,distance)/30,.55);
 const flight=cmFlight_(distance,power);
 // Compute movement between release and impact from the same formula as the arena.
 const before=cmTargetMotion_(level,index,time),after=cmTargetMotion_(level,index,time+flight);
 const leadX=rules>=5?after.x-before.x:0,leadY=rules>=5?after.y-before.y:0;
 const ax=dx+wind*profile.wind*.04*difficulty-leadX,ay=dy+(1-power)*.70*difficulty-leadY;
 const obstructionTime=rules>=5?time+flight:time;
 const blocked=cmObstructed_(level,index,obstructionTime,ax,ay),norm=Math.hypot(ax,ay)*profile.ring;
 const base=blocked||norm>1?0:Math.max(1,10-Math.floor(norm*10));
 return {score:base?Math.min(10,base+profile.bonus):0,blocked,impactDx:ax,impactDy:ay};
}
function cmShots_(id,shots,level,rules=CM_V){
 if(!Array.isArray(shots)||shots.length!==5)throw Error('É obrigatório registrar exatamente 5 flechas');
 const bow=['classico','real','vento'].includes(String(shots[0]?.bow||''))?String(shots[0].bow):'classico';
 if(shots.some(x=>String(x.bow||'classico')!==bow))throw Error('Todas as flechas da rodada precisam usar o mesmo arco');
 let sum=0;const rec=shots.map((x,i)=>{
  const dx=Number(x.dx),dy=Number(x.dy),power=Number(x.power),time=Number(x.time??0);
  if(![dx,dy,power,time].every(Number.isFinite)||Math.abs(dx)>9||Math.abs(dy)>9||power<.28||power>1||time<0||time>120)
   throw Error('Disparo inválido: '+(i+1));
  const cfg=cmRound_(id,i,level),score=cmScore_(dx,dy,power,cfg.wind,cfg.distance,level,i,time,rules,bow);
  sum+=score.score;
  return {...cfg,dx,dy,power,time,bow,blocked:score.blocked,score:score.score,impactDx:score.impactDx,impactDy:score.impactDy};
 });return {sum,shots:rec}
}
function cmRate_(db,id){let now=new Date(),today=now.toISOString().slice(0,10);const count=cmChallenges_(db).filter(x=>String(x.data[2])===id&&String(x.data[5]).slice(0,10)===today).length;if(count>=10)throw Error('Limite de 10 novos desafios por dia');}
function cmLog_(db,id,action,details){cmSheet_(db,'Eventos').appendRow([cmUuid_(),cmNow_(),id,action,JSON.stringify(details||{}).slice(0,1000)])}
function cmOp_(db,id,token,result){const body=JSON.stringify(result);cmSheet_(db,'Operacoes').appendRow([id,cmDigest_(token||''),result.ok?'OK':'ERRO',body,cmNow_()]);return result}
function cmDo_(e){const p=e.parameter||{},action=String(p.action||''),token=String(p.token||''),req=String(p.requestId||'');if(!/^[0-9a-f]{32,128}$/i.test(req))throw Error('Operação inválida');if(!/^[0-9a-f]{32,128}$/i.test(token))throw Error('Identificador de sessão inválido');const db=cmBook_();const prior=cmRows_(cmSheet_(db,'Operacoes')).find(x=>x.data[0]===req);if(prior){if(prior.data[1]!==cmDigest_(token))throw Error('Operação de outro usuário');return JSON.parse(prior.data[3])}
let result;
try{
 if(action==='login'){
  const id=String(p.id||'').trim().toUpperCase();
  if(!/^[ABC]\d{2}$/.test(id))throw Error('Selecione um aluno da lista.');
  const student=cmStudent_(db,id).data;
  // A identificação por nome é deliberadamente simples e não equivale a login seguro.
  cmSheet_(db,'Sessoes').appendRow([cmDigest_(token),id,new Date(Date.now()+CM_TTL).toISOString(),cmNow_()]);
  cmLog_(db,id,'selecionou_perfil',{});
  result={ok:true,user:cmPublicStudent_(student),expires:Date.now()+CM_TTL};
 } else {
  const actor=cmPublicStudent_(cmSession_(db,token).data),id=actor.id;
  if(action==='challenge'){
   const data=JSON.parse(String(p.payload||'{}')),kind=String(data.kind||''),to=String(data.to||''),level=String(data.level||'iniciante');if(!CM_DISTANCES[level])throw Error('Nível inválido');if(!CM_TYPES.includes(kind))throw Error('Modo de desafio inválido');if(id===to)throw Error('Não é possível desafiar a si mesmo');const opponent=cmPerson_(db,to);
   if(kind==='mesma_turma'&&actor.house!==opponent.house)throw Error('Escolha um aluno da mesma turma');
   if(kind==='interclasses'&&actor.house===opponent.house)throw Error('Escolha uma Casa rival');
   if(kind==='entre_equipes'&&actor.house===opponent.house&&actor.team===opponent.team)throw Error('Escolha uma equipe adversária');
   cmRate_(db,id);const challengeId=cmUuid_();cmSheet_(db,'Desafios').appendRow([challengeId,kind,id,to,CM_STATUS.CRIADOR,cmNow_(),'','','','','','','','',CM_V+'|'+level]);cmLog_(db,id,'challenge',{challengeId,to,kind});
   result={ok:true,challenge:cmSummary_(db,cmFindChallenge_(db,challengeId).data,id)};
  }else if(action==='answer'){
   const data=JSON.parse(String(p.payload||'{}')),item=cmFindChallenge_(db,String(data.id||'')),c=item.data; if(c[3]!==id)throw Error('Apenas o destinatário pode responder');if(c[4]!==CM_STATUS.PENDENTE)throw Error('Desafio não está pendente');const yes=String(data.decision||'')==='accept';if(!yes&&String(data.decision||'')!=='decline')throw Error('Decisão inválida');
   const status=yes?CM_STATUS.ACEITO:CM_STATUS.RECUSADO;
   const col=yes?7:8;cmSheet_(db,'Desafios').getRange(item.row,5).setValue(status);cmSheet_(db,'Desafios').getRange(item.row,col).setValue(cmNow_());cmLog_(db,id,yes?'accept':'decline',{challengeId:c[0]});
   result={ok:true,challenge:cmSummary_(db,cmFindChallenge_(db,c[0]).data,id)};
  }else if(action==='submit'){
   const data=JSON.parse(String(p.payload||'{}')),item=cmFindChallenge_(db,String(data.id||'')),c=item.data;
   const isCreator=c[2]===id,asReply=c[3]===id;if(!isCreator&&!asReply)throw Error('Desafio de outro aluno');if(isCreator&&c[4]!==CM_STATUS.CRIADOR)throw Error('A primeira rodada já foi registrada');if(asReply&&c[4]!==CM_STATUS.ACEITO)throw Error('Aceite primeiro o desafio');
   const scored=cmShots_(String(c[0]),data.shots,cmLevel_(c),cmRules_(c)),sh=cmSheet_(db,'Desafios');
   sh.getRange(item.row,isCreator?10:11).setValue(scored.sum);
   sh.getRange(item.row,isCreator?12:13).setValue(JSON.stringify(scored.shots));
   if(isCreator){sh.getRange(item.row,5).setValue(CM_STATUS.PENDENTE)}
   else{const a=Number(c[9]),b=scored.sum;sh.getRange(item.row,5).setValue(CM_STATUS.CONCLUIDO);sh.getRange(item.row,9).setValue(cmNow_());sh.getRange(item.row,14).setValue(b>a?id:b===a?'EMPATE':String(c[2]));}
   const rows=scored.shots.map((x,i)=>[cmUuid_(),String(c[0]),id,i+1,x.dx,x.dy,x.power,x.wind,x.distance,x.shift,.45,x.score,cmNow_()]);const dis=cmSheet_(db,'Disparos');dis.getRange(dis.getLastRow()+1,1,5,13).setValues(rows);cmLog_(db,id,'submit',{challengeId:c[0],score:scored.sum});
   if(!isCreator)cmUpdateRank_(db);
   result={ok:true,score:scored.sum,shots:scored.shots,challenge:cmSummary_(db,cmFindChallenge_(db,c[0]).data,id)};
  }else throw Error('Ação inválida');
 }
}catch(error){result={ok:false,error:String(error.message||error)}}
return cmOp_(db,req,token,result)
}
function doPost(e){return cmReply_(cmWithLock_(()=>{try{return cmDo_(e)}catch(err){return{ok:false,error:String(err.message||err)}}}),null)}
function cmRank_(db){
 const students=cmPublicRoster_(db),scoreMap={};
 students.forEach(s=>scoreMap[s.id]={...s,plays:0,wins:0,ties:0,losses:0,total:0,last:''});
 const games=cmChallenges_(db).map(x=>x.data).filter(c=>String(c[4])===CM_STATUS.CONCLUIDO);
 for(const c of games){
  const a=scoreMap[c[2]],b=scoreMap[c[3]],sa=Number(c[9]),sb=Number(c[10]);if(!a||!b)continue;
  for(const [x,s,opp] of [[a,sa,sb],[b,sb,sa]]){
   x.plays++;x.total+=s;x.last=String(c[8]);
   if(s>opp)x.wins++;else if(s===opp)x.ties++;else x.losses++;
  }
 }
 const players=Object.values(scoreMap).filter(x=>x.plays)
  .map(x=>({...x,avg:Math.round(x.total/x.plays*10)/10}))
  .sort((a,b)=>b.wins-a.wins||b.total-a.total);
 // Team standings count only duels BETWEEN teams; class standings only
 // INTERCLASS duels. Same-class duels never artificially boost class totals.
 function modeGroups(type,field){
  const key=s=>field==='team'?s.house+'::'+s.team:s[field];
  const group={};
  students.forEach(s=>{
   const k=key(s),name=field==='team'?'4º '+s.house+' · '+s.team:s[field];
   if(!group[k])group[k]={name,house:s.house,members:0,plays:0,wins:0,ties:0,losses:0,total:0};
   group[k].members++;
  });
  for(const c of games){if(c[1]!==type)continue;
   const a=scoreMap[c[2]],b=scoreMap[c[3]];
   if(!a||!b||key(a)===key(b))continue;
   const sa=Number(c[9]),sb=Number(c[10]);
   for(const [s,pts,opp] of [[a,sa,sb],[b,sb,sa]]){
    const g=group[key(s)];g.plays++;g.total+=pts;
    if(pts>opp)g.wins++;else if(pts===opp)g.ties++;else g.losses++;
   }
  }
  return Object.values(group).sort((a,b)=>b.wins-a.wins||b.total-a.total);
 }
 return {players,teams:modeGroups('entre_equipes','team'),classes:modeGroups('interclasses','house'),games:games.length,updated:cmNow_()};
}
function cmUpdateRank_(db){const rows=cmRank_(db).players;const sh=cmSheet_(db,'Ranking');if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,CM_COL.Ranking.length).clearContent();if(rows.length)sh.getRange(2,1,rows.length,CM_COL.Ranking.length).setValues(rows.map(p=>[p.id,p.name,'4º '+p.house,p.team,p.plays,p.wins,p.ties,p.losses,p.total,p.avg,p.last]));}
function doGet(e){let p=e.parameter||{},o;try{const db=cmBook_(),action=String(p.action||'ranking'),token=String(p.token||'');if(action==='ping')o={ok:true,api:CM_V};
else if(action==='ranking')o={ok:true,...cmRank_(db)};
else if(action==='roster')o={ok:true,players:cmPublicRoster_(db)};
else if(action==='opResult'){
 const id=String(p.requestId||'');if(!/^[0-9a-f]{32,128}$/i.test(id)||!/^[0-9a-f]{32,128}$/i.test(token))throw Error('Identificador inválido');const found=cmRows_(cmSheet_(db,'Operacoes')).find(x=>x.data[0]===id&&x.data[1]===cmDigest_(token));o=found?JSON.parse(found.data[3]):{ok:true,pending:true};
}else{const a=cmPublicStudent_(cmSession_(db,token).data),id=a.id;
 if(action==='me')o={ok:true,user:a};
 else if(action==='inbox'){const relevant=cmChallenges_(db).filter(x=>x.data[2]===id||x.data[3]===id).sort((a,b)=>b.row-a.row).slice(0,60);o={ok:true,user:a,challenges:relevant.map(x=>cmVisible_(db,x,id))}}
 else if(action==='challenge'){o={ok:true,challenge:cmVisible_(db,cmFindChallenge_(db,String(p.id||'')),id)}}
 else throw Error('Consulta inválida');}
}catch(err){o={ok:false,error:String(err.message||err)}}return cmReply_(o,p.callback)}
/** Compatibilidade: a versão por seleção de nome não exige configuração de PIN. */
function setupOnce(){return {message:'Sem PIN: não é necessário executar setupOnce.'}}
