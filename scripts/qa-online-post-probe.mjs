import {chromium} from 'playwright';
import assert from 'node:assert/strict';
// Diagnóstico pontual: um identificador inexistente causa SOMENTE uma
// operação de erro na aba Operacoes. Nunca grava placar, desafio ou sessão.
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage();
const trace=[];
page.on('requestfailed',request=>{
 const u=new URL(request.url());
 if(u.host.includes('google'))trace.push({host:u.host,type:request.resourceType(),error:request.failure()?.errorText});
});
page.on('response',response=>{
 const u=new URL(response.url());
 if(u.host.includes('google')&&response.status()>=400)trace.push({host:u.host,status:response.status(),type:response.request().resourceType()});
});
try{
 await page.goto('https://drjcs2020.github.io/classmana-torneio-arco-e-flecha/',{waitUntil:'domcontentloaded',timeout:40000});
 const result=await page.evaluate(async()=>{
  const {online}=await import('./online-client.js?v=4&probe='+Date.now());
  await online.connect();
  const roster=await online.list();
  if(roster.some(p=>p.id==='A99'))throw Error('A99 já está cadastrado; não testar');
  const t=Date.now();
  try{
   await online.login('A99');
   throw Error('PROBE FAILED: servidor autorizou perfil inexistente');
  }catch(e){
   if(!/Aluno não autorizado/i.test(String(e?.message)))throw Error('POST ou confirmação falhou: '+e.message);
  }
  return {ok:true,expected:'Aluno não autorizado',latencyMs:Date.now()-t};
 });
 assert(result.ok);
 console.log('BROWSER POST/JSONP CONFIRMATION SUCCESS:',JSON.stringify(result));
}catch(e){
 console.error('BROWSER POST/JSONP FAILURE:',e.message);
 console.error('NETWORK:',JSON.stringify(trace));
 process.exitCode=1;
}finally{await browser.close()}
