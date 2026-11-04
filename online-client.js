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
 constructor(){this.url=ONLINE_API_URL;this.enabled=apiIsConfigured();this.token=sessionStorage.getItem(TOKEN_KEY)||'';this.user=null;this.roster=[];this.state='off';this.seq=0;}
 async get(action,params={}){
  if(!this.enabled)throw Error('Servidor online ainda não publicado.');
  const name='cmArcApi_'+(++this.seq)+'_'+randomId().slice(0,10);
  return await new Promise((resolve,reject)=>{
   let settled=false,script=document.createElement('script');
   const close=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);script.remove();try{delete window[name]}catch{window[name]=undefined};if(error)reject(error);else resolve(data)};
   const timer=setTimeout(()=>close(Error('A consulta ao placar online demorou demais.')),18000);
   window[name]=(data)=>close(null,data);
   script.onerror=()=>close(Error('Não foi possível consultar o serviço online.'));
   script.src=this.url+'?'+new URLSearchParams({action,callback:name,...params,_:Date.now()});
   document.head.appendChild(script);
  });
 }
 async post(action,payload={},extra={}){
  if(!this.enabled)throw Error('Servidor online ainda não publicado.');
  if(!this.token)this.token=randomId();
  const requestId=randomId(),frameName='cm_arc_post_iframe';
  let frame=document.getElementById(frameName);
  if(!frame){frame=document.createElement('iframe');frame.name=frame.id=frameName;frame.style.display='none';frame.setAttribute('title','Envio seguro ClassMana');document.body.appendChild(frame)}
  const form=document.createElement('form');form.action=this.url;form.method='POST';form.target=frameName;form.style.display='none';
  const data={action,token:this.token,requestId,payload:JSON.stringify(payload),...extra};
  for(const [key,value] of Object.entries(data)){
   const input=document.createElement('input');input.type='hidden';input.name=key;input.value=String(value);form.appendChild(input);
  }
  document.body.appendChild(form);form.submit();form.remove();
  const deadline=Date.now()+32000;
  while(Date.now()<deadline){
   await wait(1400);
   const res=await this.get('opResult',{requestId,token:this.token});
   if(res.pending)continue;
   if(!res.ok)throw Error(res.error||'Operação recusada pelo servidor.');
   return res;
  }
  throw Error('O servidor não confirmou a gravação. Consulte seus desafios antes de tentar novamente.');
 }
 async connect(){if(!this.enabled){this.state='off';return false}const ping=await this.get('ping');if(!ping.ok)throw Error(ping.error||'Servidor desconectado');
  if(Number(ping.api)<3)throw Error('Apps Script antigo: atualize o Code.gs e publique uma nova versão (sem PIN e com circuitos até 150m).');
  this.state='ready';
  try{if(this.token){const resp=await this.get('me',{token:this.token});if(resp.ok)this.user=resp.user;else{this.token='';sessionStorage.removeItem(TOKEN_KEY)}}}catch{this.token='';sessionStorage.removeItem(TOKEN_KEY)}return true;
 }
 async login(id){
  if(!/^[ABC]\d{2}$/.test(id||''))throw Error('Escolha seu nome na lista.');
  if(this.user?.id===id&&this.token)return this.user;
  const old=this.token,previous=this.user;this.token=randomId();this.user=null;
  try{
    const r=await this.post('login',{}, {id});
    this.user=r.user;sessionStorage.setItem(TOKEN_KEY,this.token);this.state='ready';
    localStorage.setItem('cm_arco_nome',id);
    return r.user;
  }catch(e){this.token=old;this.user=previous;throw e}
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