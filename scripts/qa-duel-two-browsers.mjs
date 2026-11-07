import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'classmana-browsers-'));
const backend=spawn(process.execPath,['duel-api/server.mjs'],{
 env:{...process.env,DB_PATH:join(dir,'isolated.sqlite'),PORT:'18767',ALLOWED_ORIGINS:'http://127.0.0.1:8770'},
 stdio:['ignore','pipe','pipe']
});
const site=spawn('python3',['-m','http.server','8770','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
let browser;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){
 for(let i=0;i<70;i++){try{
  const [a,b]=await Promise.all([fetch('http://127.0.0.1:18767/api?action=ping'),fetch('http://127.0.0.1:8770/')]);
  if(a.ok&&b.ok)return;
 }catch{} await wait(100)}
 throw Error('Two-browser test servers failed to start');
}
const configBody="export const ONLINE_API_URL='http://localhost:18767/api';";
async function newPlayer(id){
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 await context.route('**/online-config.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:configBody}));
 await context.route('https://classmana-duel-api-production.up.railway.app/**',route=>route.abort());
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8770/',{waitUntil:'domcontentloaded'});
 await page.evaluate(async id=>{
  const {online}=await import('./online-client.js?v=api10');
  await online.connect();await online.login(id);
 },id);
 return {context,page};
}
async function call(page,method,...args){
 return page.evaluate(async ({method,args})=>{
  const {online}=await import('./online-client.js?v=api10');
  return await online[method](...args);
 },{method,args});
}
const shots=offset=>Array.from({length:5},(_,i)=>({dx:offset+i*.012,dy:offset+i*.008,power:.6,time:.4,bow:'classico'}));
try{
 await ready();
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 const A=await newPlayer('A01'),B=await newPlayer('B01');
 const challenge=await call(A.page,'create','interclasses','B01','iniciante');
 assert.equal(challenge.status,'CRIADOR_JOGANDO');
 const submitted=await call(A.page,'submit',challenge.id,shots(.05));
 assert.equal(submitted.challenge.status,'PENDENTE');
 const received=await call(B.page,'inbox');
 assert(received.some(x=>x.id===challenge.id&&x.status==='PENDENTE'),'Recipient failed to receive online challenge');
 await B.page.locator('#cm-open-challenges').evaluate(el=>el.click());
 await B.page.waitForFunction(()=>document.querySelector('#cm-quick-challenges-count')?.textContent==='1',{timeout:9000});
 assert.equal(await B.page.locator('#cm-quick-challenges-count').textContent(),'1','Challenges bell count not connected');
 const accepted=await call(B.page,'answer',challenge.id,'accept');
 assert.equal(accepted.status,'ACEITO');
 const finished=await call(B.page,'submit',challenge.id,shots(.5));
 assert.equal(finished.challenge.status,'CONCLUIDO');
 const ranking=await call(A.page,'ranking');
 assert.equal(ranking.games,1);
 assert(ranking.players.some(x=>x.id==='A01'&&x.wins===1));
 await A.context.close();await B.context.close();
 console.log('✅ Two independent browser profiles: invitation delivered, bell count 1, accepted, 10 shots, completed and ranking.');
}catch(err){console.error('❌ Two-browser duel QA:',err);process.exitCode=1;
}finally{
 if(browser)await browser.close();
 backend.kill('SIGTERM');site.kill('SIGTERM');
 await wait(200);rmSync(dir,{recursive:true,force:true});
}
