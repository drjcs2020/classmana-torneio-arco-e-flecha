/* Teste do novo transporte HTML sem alterar dados reais dos alunos.
 * Reproduz o browser cross-origin: GET/POST para script.google.com, resposta
 * HtmlService entregue em iframe, confirmada por postMessage.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1024,height:768}});
const calls=[];
try{
 await page.route('https://script.google.com/**',async route=>{
  const req=route.request(),method=req.method();
  const data=method==='POST'?new URLSearchParams(req.postData()||''):
   new URL(req.url()).searchParams;
  const rid=data.get('rid')||'',action=data.get('action')||'';
  calls.push({method,action,bridge:data.get('bridge')});
  let payload;
  if(action==='ping')payload={ok:true,api:8};
  else if(action==='login')payload={ok:true,user:{id:data.get('id'),name:'Aluno de teste'}};
  else if(action==='roster')payload={ok:true,players:[{id:'A01',name:'Aluno de teste'}]};
  else if(action==='opResult')payload={ok:true,pending:true};
  else payload={ok:false,error:'Rota de teste inexistente'};
  const message=JSON.stringify({type:'classmana-html-bridge-v1',rid,data:payload}).replace(/</g,'\\u003c');
  const body='<html><body><script>window.top.postMessage('+message+',"https://drjcs2020.github.io");</script></body></html>';
  await route.fulfill({status:200,contentType:'text/html',body});
 });
 await page.goto('https://drjcs2020.github.io/classmana-torneio-arco-e-flecha/',{waitUntil:'domcontentloaded',timeout:45000});
 const answer=await page.evaluate(async()=>{
  const {online}=await import('./online-client.js?qa=bridge-mock');
  online.bridgeReady=true;
  const ping=await online.get('ping');
  const roster=await online.get('roster');
  const token=online.token;
  const login=await online.post('login',{}, {id:'A01'});
  return {ping,roster,login,hasToken:Boolean(token||online.token)};
 });
 assert.equal(answer.ping.api,8);
 assert.equal(answer.roster.players?.length,1);
 assert.equal(answer.login.user.id,'A01');
 assert.equal(answer.hasToken,true);
 assert(calls.some(x=>x.method==='GET'&&x.action==='ping'&&x.bridge==='1'));
 assert(calls.some(x=>x.method==='POST'&&x.action==='login'&&x.bridge==='1'));
 console.log('HTML BRIDGE MOCK PASS:',JSON.stringify({ping:answer.ping.api,roster:answer.roster.players.length,login:answer.login.user.id,calls}));
}catch(err){
 console.error('HTML BRIDGE MOCK FAIL:',err?.stack||err);
 process.exitCode=1;
}finally{await browser.close();}
