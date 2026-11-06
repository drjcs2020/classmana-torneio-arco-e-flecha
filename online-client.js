/** ClassMana Arena — cliente seguro de API Google Sheets / Apps Script.
 * Escritas por formulário POST de um iframe isolado; respostas por consultas
 * JSONP por requestId aleatório. O aluno seleciona o nome; não há PIN.
 */
import {ONLINE_API_URL} from './online-config.js';
const TOKEN_KEY='cm_arc_session_v1';
const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function apiIsConfigured(){return /^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(ONLINE_API_URL)}
class ArcheryOnline {
 constructor(){this.url=ONLINE_API_URL;this.enabled=apiIsConfigured();this.token=sessionStorage.getItem(TOKEN_KEY)||'';this.user=null;this.roster=[];this.state='off';this.seq=0;this.loginPending=null;this.lastError=null;}
 async get(action,params={}){
  if(!this.enabled)throw Error('Servidor online ainda não publicado.');
  // Rotas equivalentes do Google podem falhar independentemente no salto
  // ContentService (/exec) -> script.googleusercontent.com.
  // GET é somente leitura; repetir não cria convites nem duplica resultados.
  const alternate=this.url.replace('https://script.google.com/macros/s/','https://script.google.com/a/~/macros/s/');
  const routes=[this.url,alternate,this.url,alternate,this.url];
  const delays=[0,650,1800,3800,7000];
  let last=null;
  for(let attempt=0;attempt<routes.length;attempt++){
   if(delays[attempt])await wait(delays[attempt]);
   try{
    const result=await this.getOnce(action,params,routes[attempt]);
    this.lastNetworkRoute=routes[attempt]===this.url?'principal':'alternativa';
    return result;
   }catch(error){
    last=error;
    // A resposta real do Google é eventualmente 404 após um 302.
    // Alternar a rota fornece uma nova URL de resposta sem alterar o backend.
    console.warn('ClassMana: tentativa de leitura '+(attempt+1)+'/'+routes.length+' falhou ('+(routes[attempt]===this.url?'principal':'alternativa')+').',error?.message||error);
   }
  }
  throw Error('Falha ao consultar '+action+' em '+routes.length+' tentativas. O Google não entregou a resposta ao navegador após o redirecionamento; tente RECONETAR ou outra rede. '+(last?.message||''));
 }
 async getOnce(action,params={},route=this.url){
  const name='cmArcApi_'+(++this.seq)+'_'+randomId().slice(0,10);
  return await new Promise((resolve,reject)=>{
   let settled=false,script=document.createElement('script');
   const close=(error,data)=>{
    if(settled)return;settled=true;clearTimeout(timer);script.remove();
    try{delete window[name]}catch{window[name]=undefined}
    if(error)reject(error);else resolve(data);
   };
   const timer=setTimeout(()=>close(Error('Tempo limite de 15 segundos para o Google responder.')),15000);
   window[name]=(data)=>close(null,data);
   script.onerror=()=>close(Error('Falha ao carregar resposta JSONP do Google (possível erro 404 no redirecionamento, bloqueio de rede ou navegador).'));
   script.referrerPolicy='no-referrer';
   script.src=route+'?'+new URLSearchParams({action,callback:name,...params,_:Date.now()});
   document.head.appendChild(script);
  });
 }
 async post(action,payload={},extra={}){
  if(!this.enabled)throw Error('Servidor online ainda não publicado.');
  if(!this.token)this.token=randomId();
  // Cada POST mantém o token original até confirmar a operação.
  // Não ler this.token durante a espera: a troca de perfil poderia alterá-lo.
  const token=this.token;
  const requestId=randomId(),frameName='cm_arc_post_'+requestId.slice(0,16);
  // Um iframe por operação: não misturar respostas de duas gravações simultâneas.
  const frame=document.createElement('iframe');
  frame.name=frame.id=frameName;frame.style.display='none';
  frame.setAttribute('title','Envio ClassMana');
  document.body.appendChild(frame);
  const form=document.createElement('form');form.action=this.url;form.method='POST';form.target=frameName;form.style.display='none';
  const data={action,token,requestId,payload:JSON.stringify(payload),...extra};
  for(const [key,value] of Object.entries(data)){
   const input=document.createElement('input');input.type='hidden';input.name=key;input.value=String(value);form.appendChild(input);
  }
  document.body.appendChild(form);form.submit();form.remove();
  const deadline=Date.now()+80000;
  let lastNetworkError=null;
  try{
   while(Date.now()<deadline){
    await wait(1100);
    let res;
    try{res=await this.get('opResult',{requestId,token});}
    catch(error){lastNetworkError=error;continue;}
    if(res.pending)continue;
    // Um erro de regras/perfil retornado pelo servidor é definitivo,
    // independentemente do texto da mensagem. Não ficar aguardando 80 segundos.
    if(!res.ok)throw Error(res.error||'Operação recusada pelo servidor.');
    return res;
   }
   throw Error('O servidor não confirmou a gravação. Não repita a partida antes de consultar Meus Desafios. '+(lastNetworkError?.message||''));
  }finally{frame.remove();}
 }
 async connect(){if(!this.enabled){this.state='off';return false}const ping=await this.get('ping');if(!ping.ok)throw Error(ping.error||'Servidor desconectado');
  if(Number(ping.api)<7)throw Error('SERVIDOR DESATUALIZADO: API v'+(ping.api??'?')+' publicada; é necessário publicar o backend/Code.gs v7 no Apps Script (Implantar → Gerenciar implantações → Editar → Nova versão).');
  this.apiVersion=Number(ping.api)||0;
  this.state='ready';
  try{if(this.token){const resp=await this.get('me',{token:this.token});if(resp.ok)this.user=resp.user;else{this.token='';sessionStorage.removeItem(TOKEN_KEY)}}}catch{this.token='';sessionStorage.removeItem(TOKEN_KEY)}return true;
 }
 login(id){
  if(!/^[ABC]\d{2}$/.test(id||''))return Promise.reject(Error('Escolha seu nome na lista.'));
  if(this.loginPending){
   // Mesmo perfil selecionado e clique em Jogar durante o login:
   // compartilham a mesma requisição, sem gerar tokens concorrentes.
   return this.loginPending.then(()=>this.user?.id===id?this.user:this.login(id));
  }
  if(this.user?.id===id&&this.token)return Promise.resolve(this.user);
  const operation=this.loginOnce(id);
  this.loginPending=operation;
  operation.finally(()=>{if(this.loginPending===operation)this.loginPending=null}).catch(()=>{});
  return operation;
 }
 async loginOnce(id){
  const previousToken=this.token,previousUser=this.user;
  const attemptToken=randomId();this.token=attemptToken;this.user=null;
  try{
    const r=await this.post('login',{}, {id});
    if(!r.ok||r.user?.id!==id)throw Error(r.error||'Perfil não confirmado pelo servidor.');
    this.user=r.user;sessionStorage.setItem(TOKEN_KEY,attemptToken);this.state='ready';
    localStorage.setItem('cm_arco_nome',id);
    return r.user;
  }catch(e){this.token=previousToken;this.user=previousUser;throw e}
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
export const online = new ArcheryOnline();