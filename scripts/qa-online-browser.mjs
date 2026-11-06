import {chromium} from 'playwright';
import assert from 'node:assert/strict';

// Teste REAL no Chromium (sem registrar alunos nem gravar desafios).
// Diferente do Node fetch, verifica o caminho JSONP que a interface realmente usa.
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const origin='https://drjcs2020.github.io/classmana-torneio-arco-e-flecha/';
const errors=[],trace=[];
const page=await browser.newPage({viewport:{width:1366,height:768}});
page.on('pageerror',error=>errors.push(error.message));
page.on('requestfailed',request=>{
 const url=request.url();
 if(url.includes('script.google')||url.includes('googleusercontent'))
  trace.push({kind:'requestfailed',host:new URL(url).host,type:request.resourceType(),error:request.failure()?.errorText||'falha'});
});
page.on('response',response=>{
 const url=response.url();
 if(url.includes('script.google')||url.includes('googleusercontent'))
  trace.push({kind:'response',host:new URL(url).host,type:response.request().resourceType(),status:response.status()});
});
try {
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:40000});
 const result=await page.evaluate(async()=>{
  const {online}=await import('./online-client.js?qa=browser-online');
  const out={};
  const start=Date.now();
  for (const action of ['ping','roster','ranking']) {
   const resp=await online.get(action);
   if(!resp.ok)throw Error(action+': '+resp.error);
   out[action]=action==='ping'?{api:resp.api}:action==='roster'?{players:resp.players?.length}:{games:resp.games};
  }
  const requestId='a'.repeat(48),token='b'.repeat(48);
  const op=await online.get('opResult',{requestId,token});
  if(!op.pending)throw Error('opResult deveria retornar pending para ID não utilizado');
  out.opResult={pending:op.pending};
  out.elapsedMs=Date.now()-start;
  return out;
 });
 console.log('BROWSER ONLINE SUCCESS:',JSON.stringify(result));
 console.log('NETWORK:',JSON.stringify(trace));
 assert.equal(result.ping.api,7);
 assert(result.roster.players>=70);
 assert.equal(result.opResult.pending,true);
} catch(error) {
 console.error('BROWSER ONLINE FAILURE:',error.message);
 console.error('NETWORK:',JSON.stringify(trace));
 console.error('PAGE ERRORS:',JSON.stringify(errors));
 process.exitCode=1;
} finally {await browser.close()}
