
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

// Fluxo simulado de dois alunos usando interface real do recomeço.
// Não grava nada na planilha da escola nem exige PIN.
const students=[
 {id:'A01',name:'Aluno Teste A',house:'A',team:'Equipe 1'},
 {id:'A02',name:'Aluna Teste B',house:'A',team:'Equipe 2'},
 {id:'B01',name:'Aluno Teste C',house:'B',team:'Equipe 3'}
];
const sessions=new Map(),challenges=[],operations=new Map(),errors=[],events=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('pageerror',e=>errors.push(e.message));

function response(action,params){
 const token=params.get('token')||'';
 const actor=sessions.get(token);
 const fail=error=>({ok:false,error});
 if(action==='ping')return {ok:true,api:8};
 if(action==='roster')return {ok:true,players:students};
 if(action==='ranking')return {ok:true,players:[],teams:[],classes:[],games:challenges.filter(x=>x.status==='CONCLUIDO').length};
 if(action==='me')return actor?{ok:true,user:actor}:fail('Sessão expirada');
 if(action==='opResult')return operations.get(params.get('requestId'))||{ok:true,pending:true};
 if(action==='inbox')return actor?{ok:true,challenges:challenges.filter(x=>x.creator.id===actor.id||x.recipient.id===actor.id)}:fail('Sessão inválida');
 if(action==='challenge'&&params.get('id')){
  const c=challenges.find(x=>x.id===params.get('id'));
  return c?{ok:true,challenge:c}:fail('Desafio não encontrado');
 }
 const requestId=params.get('requestId');
 if(requestId&&operations.has(requestId))return operations.get(requestId);
 let result;
 if(action==='login'){
  const id=params.get('id'),user=students.find(x=>x.id===id);
  if(!user)result=fail('Aluno não autorizado');
  else{sessions.set(token,user);result={ok:true,user}}
 }else if(!actor)result=fail('Sessão inválida');
 else if(action==='challenge'){
  const data=JSON.parse(params.get('payload')||'{}'),recipient=students.find(x=>x.id===data.to);
  if(!recipient)result=fail('Aluno não autorizado');
  else{
   const c={id:'test_'+String(challenges.length+1),creator:actor,recipient,kind:data.kind,
    status:'CRIADOR_JOGANDO',level:data.level,creatorShots:[],recipientShots:[],
    creatorScore:null,recipientScore:null,rules:8,settings:[10,35,65,100,150].map((distance,index)=>({index,distance,wind:0,shift:0}))};
   challenges.push(c);events.push('challenge');result={ok:true,challenge:c};
  }
 }else if(action==='answer'){
  const data=JSON.parse(params.get('payload')||'{}'),c=challenges.find(x=>x.id===data.id);
  if(!c||c.recipient.id!==actor.id||c.status!=='PENDENTE')result=fail('Desafio não está pendente');
  else{c.status=data.decision==='accept'?'ACEITO':'RECUSADO';events.push(c.status);result={ok:true,challenge:c};}
 }else if(action==='submit'){
  const data=JSON.parse(params.get('payload')||'{}'),c=challenges.find(x=>x.id===data.id);
  if(!c)result=fail('Desafio não encontrado');
  else if(!Array.isArray(data.shots)||data.shots.length!==5)result=fail('São necessárias 5 flechas');
  else{
   const score=data.shots.reduce((sum,s)=>sum+(Math.abs(s.dx)<1&&Math.abs(s.dy)<1?8:0),0);
   const shots=data.shots.map((s,i)=>({...s,score:i<4?8:score-32,distance:c.settings[i].distance}));
   if(actor.id===c.creator.id&&c.status==='CRIADOR_JOGANDO'){
    c.creatorShots=shots;c.creatorScore=score;c.status='PENDENTE';events.push('creator_submit');
   }else if(actor.id===c.recipient.id&&c.status==='ACEITO'){
    c.recipientShots=shots;c.recipientScore=score;c.status='CONCLUIDO';events.push('recipient_submit');
   }else result=fail('Estado inválido');
   if(!result)result={ok:true,score,shots,challenge:c};
  }
 }else result=fail('Rota desconhecida');
 if(requestId)operations.set(requestId,result);
 return result;
}
try{
 await page.route('https://script.google.com/**',async route=>{
  const request=route.request();
  const params=request.method()==='POST'?new URLSearchParams(request.postData()||''):new URL(request.url()).searchParams;
  const action=params.get('action')||'',rid=params.get('rid')||'';
  const result=response(action,params);
  const message=JSON.stringify({type:'classmana-html-bridge-v1',rid,data:result}).replace(/</g,'\\u003c');
  await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><script>window.top.postMessage('+message+', "*");</script>'});
 });
 await page.goto('http://127.0.0.1:8769/rebuild/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.getElementById('connection').textContent.includes('3 arqueiros'),{timeout:18000});
 await page.locator('[data-pick-house="A"]').click();
 await page.locator('#hero-confirm').click();
 await page.locator('[data-mode="challenge_same"]').click();
 await page.selectOption('#player','A01');
 await page.selectOption('#enemy','A02');
 await page.locator('#start-match').click();
 await page.waitForFunction(()=>document.body.dataset.screen==='arena',{timeout:25000});
 const shoot=async()=>{
  for(let i=0;i<5;i++){
   await page.waitForFunction(index=>document.getElementById('arena-stage-title').textContent.includes('FLECHA '+(index+1)+' / 5'),i,{timeout:13000});
   const b=await page.locator('#arena-stage').boundingBox();
   await page.mouse.move(b.x+b.width*.50,b.y+b.height*.49);
   await page.mouse.down();await page.waitForTimeout(160);await page.mouse.up();
  }
  await page.waitForFunction(()=>document.body.dataset.screen==='results',{timeout:25000});
 };
 await shoot();
 await page.waitForFunction(()=>document.getElementById('result-title').textContent.includes('ENVIADO'),{timeout:15000});
 assert.equal(challenges.length,1,'Um convite, sem duplicações');
 assert.equal(challenges[0].status,'PENDENTE');
 assert.equal(challenges[0].creatorShots.length,5);
 await page.locator('#result-inbox').click();
 await page.selectOption('#inbox-player','A02');
 await page.locator('#inbox-load').click();
 await page.waitForFunction(()=>document.querySelector('#challenge-list').textContent.includes('Aluno Teste A'),{timeout:15000});
 await page.locator('.invite-actions button').filter({hasText:'ACEITAR'}).click();
 await page.waitForFunction(()=>document.body.dataset.screen==='arena',{timeout:25000});
 await shoot();
 await page.waitForFunction(()=>document.getElementById('result-subtitle').textContent.includes('planilha'),{timeout:15000});
 assert.equal(challenges[0].status,'CONCLUIDO');
 assert.equal(challenges[0].recipientShots.length,5);
 assert.deepEqual(events,['challenge','creator_submit','ACEITO','recipient_submit']);
 assert.deepEqual(errors,[],'Console errors');
 console.log('REBUILD E2E MOCK PASS:',JSON.stringify({noPIN:true,students:2,challenges:challenges.length,shots:10,status:challenges[0].status,events}));
}catch(e){
 console.error('REBUILD E2E MOCK FAIL:',e.stack||e);
 console.error('EVENTS:',JSON.stringify(events));
 console.error('PAGE ERRORS:',JSON.stringify(errors));
 await page.screenshot({path:'qa-rebuild-failure.png',fullPage:true}).catch(()=>{});
 process.exitCode=1;
}finally{await browser.close()}
