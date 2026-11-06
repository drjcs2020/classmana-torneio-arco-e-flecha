/**
 * ClassMana Recomeço — API do torneio, isolada da interface.
 * API v8: Apps Script HTMLService; fallback JSONP + POST (idempotência).
 * Nenhum desafio é considerado enviado sem confirmação do backend.
 */
export const API_URL='https://script.google.com/macros/s/AKfycbzJ5MB-NWFLJKyh0kaj2Isaiv2H_KK32v8FNuKVltmKiEwpuEeHHNAJBbNfNlc-0jLkTw/exec';
const MESSAGE_TYPE='classmana-html-bridge-v1';
const TOKEN_KEY='cm_rebuild_token_v1';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
const msg=x=>String(x?.message||x||'Falha desconhecida');
const googleOrigin=o=>/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+\.)*googleusercontent\.com)$/.test(o);

export class TournamentAPI {
 constructor(url=API_URL){
  this.url=url;this.mode='offline';this.apiVersion=0;this.roster=[];
  this.token=sessionStorage.getItem(TOKEN_KEY)||'';this.user=null;
  this.loginQueue=Promise.resolve();
 }
 bridge(method,action,params={},ms=17000){
  const rid=nonce();
  return new Promise((resolve,reject)=>{
   let done=false,frame=document.createElement('iframe'),form=null;
   frame.name=frame.id='tournament_bridge_'+rid.slice(0,16);
   frame.title='Conexão do ClassMana';
   frame.style.cssText='position:absolute;width:0;height:0;opacity:0;pointer-events:none;border:0';
   const clear=(err,data)=>{
    if(done)return;done=true;clearTimeout(timeout);
    window.removeEventListener('message',onMessage);
    if(form)form.remove();frame.remove();
    if(err)reject(err);else resolve(data);
   };
   const onMessage=ev=>{
    if(!googleOrigin(ev.origin))return;
    const data=ev.data;
    if(!data||data.type!==MESSAGE_TYPE||data.rid!==rid)return;
    clear(null,data.data);
   };
   window.addEventListener('message',onMessage);
   const timeout=setTimeout(()=>clear(Error('A comunicação com o Apps Script expirou ('+action+').')),ms);
   const fields={...params,action,bridge:'1',rid};
   document.body.appendChild(frame);
   if(method==='GET'){
    const url=new URL(this.url);
    for(const [k,v] of Object.entries(fields))url.searchParams.set(k,String(v));
    url.searchParams.set('nocache',nonce().slice(0,8));
    frame.src=url.href;
   }else{
    form=document.createElement('form');
    form.action=this.url;form.method='POST';form.target=frame.name;
    form.style.display='none';
    for(const [k,v] of Object.entries(fields)){
     const inp=document.createElement('input');
     inp.type='hidden';inp.name=k;inp.value=String(v);form.appendChild(inp);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();form=null;
   }
  });
 }
 jsonp(action,params={},ms=15000){
  return new Promise((resolve,reject)=>{
   const cb='cm_restart_'+nonce().slice(0,20);
   const script=document.createElement('script');
   let done=false;
   const clean=(err,value)=>{
    if(done)return;done=true;clearTimeout(timer);script.remove();
    try{delete window[cb]}catch{window[cb]=undefined}
    if(err)reject(err);else resolve(value);
   };
   const timer=setTimeout(()=>clean(Error('Consulta ao Apps Script expirou ('+action+').')),ms);
   window[cb]=value=>clean(null,value);
   script.onerror=()=>clean(Error('O Google não entregou a consulta '+action+'.'));
   script.referrerPolicy='no-referrer';
   script.src=this.url+'?'+new URLSearchParams({...params,action,callback:cb,nocache:nonce().slice(0,8)});
   document.head.appendChild(script);
  });
 }
 async read(action,params={}){
  const calls=this.mode==='jsonp'?[()=>this.jsonp(action,params),()=>this.bridge('GET',action,params,11000)]:
   [()=>this.bridge('GET',action,params,13000),()=>this.jsonp(action,params)];
  let last;
  for(const call of calls){
   try{const result=await call();if(!result?.ok)throw Error(result?.error||'Erro ao consultar '+action);return result}
   catch(error){last=error}
  }
  throw Error('Erro de conexão ('+action+'): '+msg(last));
 }
 async connect(){
  let ping,bridgeProblem=null;
  try{ping=await this.bridge('GET','ping',{},14000);this.mode='bridge'}
  catch(e){bridgeProblem=e;ping=await this.jsonp('ping');this.mode='jsonp'}
  if(!ping?.ok)throw Error(ping?.error||'A API não respondeu.');
  if(Number(ping.api)<8)throw Error('Servidor desatualizado: versão '+ping.api+'. É necessário implantar o Code.gs v8.');
  this.apiVersion=Number(ping.api);
  const roster=await this.read('roster');
  this.roster=roster.players||[];
  if(this.token){
   try{this.user=(await this.read('me',{token:this.token})).user||null}
   catch{this.user=null;this.token='';sessionStorage.removeItem(TOKEN_KEY)}
  }
  return {version:this.apiVersion,transport:this.mode,students:this.roster.length,bridgeProblem:bridgeProblem?.message};
 }
 async confirmation(token,requestId,attempts=4){
  let error=null;
  for(let i=0;i<attempts;i++){
   if(i)await sleep(850*(i+1));
   try{
    const res=await this.read('opResult',{token,requestId});
    if(res.pending)continue;
    if(!res.ok)throw Error(res.error||'Operação recusada.');
    return res;
   }catch(e){
    error=e;
    // Erros de regras ou credenciais são respostas definitivas, não de rede.
    if(/(?:não autorizado|inválid|expirad|recusad|não encontrado|limite|Selecione)/i.test(msg(e)))throw e;
   }
  }
  return null;
 }
 submitForm(action,params){
  const name='cm_form_'+nonce().slice(0,20),frame=document.createElement('iframe');
  frame.name=frame.id=name;frame.title='Envio do torneio';frame.style.display='none';
  const form=document.createElement('form');
  form.method='POST';form.action=this.url;form.target=name;form.style.display='none';
  for(const [k,v] of Object.entries({...params,action})){
   const input=document.createElement('input');input.name=k;input.type='hidden';input.value=String(v);form.appendChild(input);
  }
  document.body.append(frame,form);form.submit();form.remove();
  return ()=>frame.remove();
 }
 async write(action,payload={},extra={}){
  if(!this.apiVersion)throw Error('Conexão online indisponível. Tente Reconectar.');
  if(!this.token)this.token=nonce();
  const token=this.token,requestId=nonce();
  const params={token,requestId,payload:JSON.stringify(payload),...extra};
  let initialError=null;
  if(this.mode==='bridge'){
   try{
    const result=await this.bridge('POST',action,params,20000);
    if(!result?.ok)throw Error(result?.error||'Gravação recusada.');
    return result;
   }catch(e){initialError=e}
   const recorded=await this.confirmation(token,requestId,3);
   if(recorded)return recorded;
  }
  // Reenvia O MESMO ID, de modo que operações duplicadas não alterem placares.
  const remove=this.submitForm(action,params);
  try{
   const result=await this.confirmation(token,requestId,10);
   if(result)return result;
   throw Error('Não foi possível confirmar '+action+' na planilha. '+(initialError?msg(initialError):'')+
    ' Antes de tentar de novo, consulte Meus desafios.');
  }finally{remove()}
 }
 login(id){
  this.loginQueue=this.loginQueue.catch(()=>{}).then(async()=>{
   if(!/^[ABC]\d{2}$/.test(id))throw Error('Selecione seu nome na lista.');
   if(this.user?.id===id&&this.token)return this.user;
   const oldToken=this.token,oldUser=this.user;
   this.token=nonce();
   try{
    const result=await this.write('login',{}, {id});
    if(result.user?.id!==id)throw Error('Servidor não confirmou o perfil escolhido.');
    this.user=result.user;sessionStorage.setItem(TOKEN_KEY,this.token);
    return this.user;
   }catch(e){this.token=oldToken;this.user=oldUser;throw e}
  });
  return this.loginQueue;
 }
 logout(){this.user=null;this.token='';sessionStorage.removeItem(TOKEN_KEY)}
 async inbox(){if(!this.user)throw Error('Escolha seu perfil.');return (await this.read('inbox',{token:this.token})).challenges||[]}
 async create(kind,to,level){return (await this.write('challenge',{kind,to,level})).challenge}
 async answer(id,decision){return (await this.write('answer',{id,decision})).challenge}
 async submit(id,shots){return this.write('submit',{id,shots})}
 async detail(id){return (await this.read('challenge',{token:this.token,id})).challenge}
 async ranking(){return this.read('ranking')}
}
export const tournament=new TournamentAPI();
