/**
 * ClassMana Arena — transporte v9.
 * O Apps Script hospeda uma página principal (?play=1) contendo o jogo
 * GitHub Pages em iframe. O próprio HTMLService usa google.script.run;
 * o jogo envia mensagens apenas ao pai conhecido, com nonce por operação.
 * Sem ContentService, redirecionamentos /macros/echo, JSONP ou iframe
 * cross-origin de Apps Script dentro do GitHub Pages.
 */
import {ONLINE_API_URL} from './online-config.js';
const TOKEN_KEY='cm_arc_session_v1';
const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const googleOrigin=origin=>/^https:\/\/(?:script\.google\.com|(?:[a-z\d-]+\.)*googleusercontent\.com)$/.test(origin);
class ArcheryOnline{
 constructor(){
  this.url=ONLINE_API_URL;
  this.enabled=/^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(this.url);
  this.token=sessionStorage.getItem(TOKEN_KEY)||'';
  this.user=null;this.roster=[];this.state='off';this.gatewayReady=false;
  this.loginPending=null;this.lastError=null;this.apiVersion=0;
 }
 portalUrl({house='A',mode='challenge_same',player='',inbox=false}={}){
  const url=new URL(this.url);
  url.searchParams.set('play','1');
  url.searchParams.set('house',/^[ABC]$/.test(house)?house:'A');
  url.searchParams.set('mode',['challenge_same','challenge_team','challenge'].includes(mode)?mode:'challenge_same');
  if(/^[ABC]\d{2}$/.test(player))url.searchParams.set('player',player);
  if(inbox)url.searchParams.set('inbox','1');
  return url.href;
 }
 /** A arena do Apps Script deve ser a página PRINCIPAL, nunca iframe. */
 async probeGateway(timeoutMs=6000){
  if(window.parent===window)return false;
  if(this.gatewayReady)return true;
  return new Promise(resolve=>{
   let done=false;
   const finish=ok=>{if(done)return;done=true;clearInterval(ticker);clearTimeout(timer);window.removeEventListener('message',listener);if(ok)this.gatewayReady=true;resolve(ok)};
   const listener=event=>{
    if(event.source!==window.parent||!googleOrigin(event.origin))return;
    const data=event.data;
    if(data?.type==='cm-gateway-ready-v1'&&Number(data.version)>=9)finish(true);
   };
   const hello=()=>window.parent.postMessage({type:'cm-gateway-hello-v1'},'*');
   window.addEventListener('message',listener);
   const ticker=setInterval(hello,350);
   const timer=setTimeout(()=>finish(false),timeoutMs);
   hello();
  });
 }
 gatewayRequest(verb,action,params={},timeoutMs=30000){
  if(!this.gatewayReady)return Promise.reject(Error('Abra a Arena Online para conectar os competidores.'));
  const rid=randomId();
  return new Promise((resolve,reject)=>{
   let settled=false;
   const finish=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('message',listener);if(error)reject(error);else resolve(data)};
   const listener=event=>{
    if(event.source!==window.parent||!googleOrigin(event.origin))return;
    const msg=event.data;
    if(!msg||msg.type!=='cm-gateway-response-v1'||msg.rid!==rid)return;
    finish(null,msg.data);
   };
   const timer=setTimeout(()=>finish(Error('O servidor não respondeu a '+action+'. Confira sua conexão.')),timeoutMs);
   window.addEventListener('message',listener);
   window.parent.postMessage({type:'cm-gateway-request-v1',rid,verb,action,params},'*');
  });
 }
 async get(action,params={}){
  if(!this.enabled)throw Error('URL da arena online não configurada.');
  const data=await this.gatewayRequest('GET',action,params);
  if(!data||typeof data!=='object')throw Error('Resposta inesperada do servidor.');
  return data;
 }
 async post(action,payload={},extra={}){
  if(!this.enabled)throw Error('URL da arena online não configurada.');
  if(!this.token)this.token=randomId();
  const token=this.token,requestId=randomId();
  const params={token,requestId,payload:JSON.stringify(payload),...extra};
  try{
   const answer=await this.gatewayRequest('POST',action,params,45000);
   if(!answer?.ok)throw Error(answer?.error||'Operação recusada pelo servidor.');
   return answer;
  }catch(error){
   // Se a gravação ocorreu mas a resposta falhou, nunca refaça o POST.
   // Verifique a mesma operação, pelo mesmo token/requestId.
   if(/Operação recusada|Aluno não autorizado|Selecione um aluno|Desafio não|inválid|expirada|limite|Primeira rodada|Aceite primeiro/i.test(String(error.message)))throw error;
   let failure=error;
   for(let attempt=0;attempt<3;attempt++){
    try{
     const reply=await this.get('opResult',{token,requestId});
     if(reply?.pending){await wait(800*(attempt+1));continue}
     if(!reply?.ok)throw Error(reply?.error||'Operação recusada.');
     return reply;
    }catch(e){failure=e}
   }
   throw Error('Não foi possível confirmar a gravação: '+failure.message);
  }
 }
 async connect(){
  if(!this.enabled){this.state='off';this.lastError='URL online não configurada.';return false}
  if(window.parent===window){
   this.state='portal';this.lastError=null;
   // Um site estático não pode realizar escrita autenticada no Apps Script
   // quando JSONP/redirect está com 404 e HTMLService é bloqueado em iframe.
   return false;
  }
  this.state='connecting';
  if(!await this.probeGateway()){
   this.state='error';
   this.lastError='A Arena Online do Apps Script não respondeu. Abra o endereço /exec?play=1 como página principal e publique o Code.gs v9.';
   throw Error(this.lastError);
  }
  const ping=await this.get('ping');
  if(!ping.ok||Number(ping.api)<9){
   this.state='error';
   this.lastError='Servidor desatualizado: a Arena Online exige API v9. Atualize a implantação do Code.gs no Google Apps Script.';
   throw Error(this.lastError);
  }
  this.apiVersion=Number(ping.api);
  this.state='ready';this.lastError=null;
  if(this.token){
   try{
    const resp=await this.get('me',{token:this.token});
    if(resp.ok)this.user=resp.user;
    else{this.token='';sessionStorage.removeItem(TOKEN_KEY)}
   }catch{this.token='';sessionStorage.removeItem(TOKEN_KEY)}
  }
  return true;
 }
 login(id){
  if(!/^[ABC]\d{2}$/.test(id||''))return Promise.reject(Error('Escolha seu nome na lista.'));
  if(this.loginPending)return this.loginPending.then(()=>this.user?.id===id?this.user:this.login(id));
  if(this.user?.id===id&&this.token)return Promise.resolve(this.user);
  const op=this.loginOnce(id);
  this.loginPending=op;
  op.finally(()=>{if(this.loginPending===op)this.loginPending=null}).catch(()=>{});
  return op;
 }
 async loginOnce(id){
  const oldToken=this.token,oldUser=this.user,attemptToken=randomId();
  this.token=attemptToken;this.user=null;
  try{
   const answer=await this.post('login',{}, {id});
   if(!answer.ok||answer.user?.id!==id)throw Error(answer.error||'Perfil não confirmado pelo servidor.');
   this.user=answer.user;sessionStorage.setItem(TOKEN_KEY,attemptToken);
   localStorage.setItem('cm_arco_nome',id);this.state='ready';
   return answer.user;
  }catch(error){this.token=oldToken;this.user=oldUser;throw error}
 }
 logout(){this.token='';this.user=null;sessionStorage.removeItem(TOKEN_KEY);localStorage.removeItem('cm_arco_nome')}
 async list(){const r=await this.get('roster');if(!r.ok)throw Error(r.error);this.roster=r.players||[];return this.roster}
 async inbox(){if(!this.user)throw Error('Escolha seu nome na lista.');const r=await this.get('inbox',{token:this.token});if(!r.ok)throw Error(r.error);return r.challenges||[]}
 async ranking(){const r=await this.get('ranking');if(!r.ok)throw Error(r.error);return r}
 async create(kind,to,level='iniciante'){return (await this.post('challenge',{kind,to,level})).challenge}
 async answer(id,decision){return (await this.post('answer',{id,decision})).challenge}
 async submit(id,shots){return this.post('submit',{id,shots})}
 async challenge(id){const r=await this.get('challenge',{token:this.token,id});if(!r.ok)throw Error(r.error);return r.challenge}
}
export const online=new ArcheryOnline();
