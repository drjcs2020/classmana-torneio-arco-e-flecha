/* Teste de regressão do backend ClassMana SEM acessar a planilha real.
 * Simula Apps Script + abas em memória e cobre desafio assíncrono de ponta a ponta.
 */
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const headers={
 Alunos:['id','apelido','turma','equipe','salt','pin_hash','ativo','criado_em'],
 Desafios:['desafio_id','tipo','criador_id','destinatario_id','status','criado_em','aceito_em','recusado_em','finalizado_em','score_criador','score_destinatario','tiros_criador_json','tiros_destinatario_json','vencedor_id','versao'],
 Disparos:['disparo_id','desafio_id','autor_id','ordem','mira_x','mira_y','forca','vento','distancia','alvo_x','alvo_y','pontuacao','criado_em'],
 Ranking:['id','apelido','turma','equipe','partidas','vitorias','empates','derrotas','pontos_total','pontuacao_media','ultima_partida'],
 Sessoes:['token_hash','aluno_id','expira_em','criado_em'],
 Eventos:['evento_id','criado_em','aluno_id','acao','detalhes'],
 Operacoes:['request_id','token_hash','status','resposta_json','criado_em'],
 Configuracao:['chave','valor'],
 Credenciais_professor:['id','pin_inicial','gerado_em','entregue']
};
class FakeSheet {
 constructor(cols){this.header=cols;this.rows=[];}
 getDataRange(){return {getValues:()=>[this.header,...this.rows.map(x=>[...x])]} }
 appendRow(a){this.rows.push([...a]);}
 getLastRow(){return this.rows.length+1;}
 getRange(row,col,rn=1,cn=1){
  const sh=this;
  return {
   setValue(v){while(sh.rows.length<row-1)sh.rows.push([]);sh.rows[row-2][col-1]=v},
   setValues(values){for(let k=0;k<values.length;k++){while(sh.rows.length<row-1+k)sh.rows.push([]);for(let l=0;l<values[k].length;l++)sh.rows[row-2+k][col-1+l]=values[k][l]}},
   clearContent(){for(let j=0;j<rn;j++){for(let k=0;k<cn;k++){if(sh.rows[row-2+j])sh.rows[row-2+j][col-1+k]=''}}}
  };
 }
}
const sheet=Object.fromEntries(Object.entries(headers).map(([n,h])=>[n,new FakeSheet(h)]));
for(const [id,name,klass,team] of [
 ['A01','Aluno A','4º A','Equipe Sol'],['A02','Aluno B','4º A','Equipe Sol'],
 ['A03','Aluno C','4º A','Equipe Lua'],['B01','Aluno D','4º B','Equipe Sol'],
 ['C01','Aluno E','4º C','Equipe Lua']
])sheet.Alunos.appendRow([id,name,klass,team,'','','TRUE',new Date().toISOString()]);
const app={
 SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheet[n]})},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 Utilities:{
  DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
  computeDigest:(_alg,s)=>[...createHash('sha256').update(String(s)).digest()],
  getUuid:()=>randomUUID()
 },
 HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},
  createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this}})},
 ContentService:{MimeType:{JSON:'application/json',JAVASCRIPT:'application/javascript'},
  createTextOutput:s=>({text:s,setMimeType(){return this}})},
 console,Date,Math,JSON,Number,String,Error,Array,Boolean,RegExp,
};
const context=vm.createContext(app);
vm.runInContext(readFileSync('backend/Code.gs','utf8'),context,{filename:'backend/Code.gs'});
let count=0;
function post(action,token,payload={},extra={}){
 const requestId=(++count).toString(16).padStart(48,'0');
 const p={action,token,requestId,payload:JSON.stringify(payload),...extra};
 return JSON.parse(context.doPost({parameter:p}).text);
}
function get(action,params={}){
 return JSON.parse(context.doGet({parameter:{action,...params}}).text);
}
const sessions={A01:'a'.repeat(48),A02:'b'.repeat(48),A03:'c'.repeat(48),B01:'d'.repeat(48),C01:'e'.repeat(48)};
for(const [id,token] of Object.entries(sessions)){
 const logged=post('login',token,{}, {id});
 assert.equal(logged.ok,true,'login '+id+': '+logged.error);
 assert.equal(logged.user.id,id);
}
assert.equal(get('ping').api,8);
assert.equal(get('roster').players.length,5);
const bridgeId='f'.repeat(48);
const bridgePing=context.doGet({parameter:{action:'ping',bridge:'1',rid:bridgeId}});
assert(bridgePing.html.includes('classmana-html-bridge-v1'));
assert(bridgePing.html.includes('"api":8'));
assert(bridgePing.html.includes('https://drjcs2020.github.io'));
const bridgeParams={action:'login',id:'A01',bridge:'1',rid:bridgeId,token:'a'.repeat(48),requestId:'f'.repeat(48),payload:'{}'};
const bridgePost=context.doPost({parameter:bridgeParams});
assert(bridgePost.html.includes('classmana-html-bridge-v1'));
assert(bridgePost.html.includes('"ok":true'));

const shots=(bow='classico',dx=0)=>Array.from({length:5},(_,i)=>({dx,dy:0,power:.9,time:1+i,bow}));
function challenge(creator,to,kind){
 const x=post('challenge',sessions[creator],{kind,to,level:'iniciante'});
 assert.equal(x.ok,true,'challenge: '+x.error);return x.challenge;
}
function complete(creator,to,kind){
 const c=challenge(creator,to,kind);
 assert.equal(c.status,'CRIADOR_JOGANDO');
 const first=post('submit',sessions[creator],{id:c.id,shots:shots('classico',.05)});
 assert.equal(first.ok,true,'creator submit: '+first.error);
 assert.equal(first.challenge.status,'PENDENTE');
 assert(get('inbox',{token:sessions[to]}).challenges.some(x=>x.id===c.id));
 const accepted=post('answer',sessions[to],{id:c.id,decision:'accept'});
 assert.equal(accepted.ok,true,'accept '+accepted.error);
 assert.equal(accepted.challenge.status,'ACEITO');
 const second=post('submit',sessions[to],{id:c.id,shots:shots('vento',.15)});
 assert.equal(second.ok,true,'recipient submit: '+second.error);
 assert.equal(second.challenge.status,'CONCLUIDO');
 assert.equal(second.challenge.creatorShots.length,5);
 assert.equal(second.challenge.recipientShots.length,5);
 assert.equal(typeof second.challenge.creatorScore,'number');
 assert.equal(typeof second.challenge.recipientScore,'number');
 return second.challenge;
}
complete('A01','A02','mesma_turma');
complete('A01','A03','entre_equipes');
complete('B01','A01','interclasses');
const refused=challenge('C01','B01','interclasses');
post('submit',sessions.C01,{id:refused.id,shots:shots('real')});
const rejected=post('answer',sessions.B01,{id:refused.id,decision:'decline'});
assert.equal(rejected.challenge.status,'RECUSADO');
const rank=get('ranking');
assert.equal(rank.ok,true);
assert.equal(rank.games,3);
assert(rank.players.length>=4);
assert(rank.teams.some(x=>x.name==='4º A · Equipe Sol'));
assert(rank.teams.some(x=>x.name==='4º B · Equipe Sol'));
assert(rank.classes.some(x=>x.name==='A')&&rank.classes.some(x=>x.name==='B'));
const invalid=post('challenge',sessions.A01,{kind:'interclasses',to:'A02',level:'iniciante'});
assert.equal(invalid.ok,false);
assert(/Casa rival|turma/i.test(invalid.error));
assert.equal(sheet.Desafios.rows.length,4);
assert.equal(sheet.Disparos.rows.length,7*5); // 3 duelos completos (6 rodadas) + criador do duelo recusado
console.log('✅ BACKEND v8: login, convites, aceite/recusa, 5+5 disparos, três tipos de desafio, placar por turmas e equipes.');
