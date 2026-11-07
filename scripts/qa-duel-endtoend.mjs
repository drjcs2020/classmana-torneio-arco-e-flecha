import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'classmana-duel-qa-'));
const PORT='18766',base='http://127.0.0.1:'+PORT+'/api';
const child=spawn(process.execPath,['duel-api/server.mjs'],{
 env:{...process.env,PORT,DB_PATH:join(dir,'test.sqlite'),ALLOWED_ORIGINS:'http://127.0.0.1:8000'},
 stdio:['ignore','pipe','pipe']
});
let stderr='';
child.stderr.on('data',chunk=>stderr+=chunk.toString());
const timeout=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function req(action,{token,body}={}){
 const response=await fetch(base+'?action='+action,{
  method:body?'POST':'GET',headers:{
   ...(token?{Authorization:'Bearer '+token}:{}),
   ...(body?{'Content-Type':'application/json'}:{})
  },body:body?JSON.stringify(body):undefined
 });
 const json=await response.json();
 return {status:response.status,...json};
}
const id=(name)=>'qa-'+name+'-request-0001';
const shots=(offset)=>Array.from({length:5},(_,i)=>({dx:offset+i*.012,dy:offset+i*.008,power:.7,time:.6,bow:'classico'}));
async function run(){
 let up=false;
 for(let i=0;i<75;i++){
  if(child.exitCode!==null)throw Error('Backend failed before startup: '+stderr);
  try{const r=await req('ping');if(r.api===10){up=true;break;}}catch{}
  await timeout(100);
 }
 assert(up,'Backend did not start: '+stderr);
 const A=await req('login',{body:{id:'A01'}}),A2=await req('login',{body:{id:'A02'}}),B=await req('login',{body:{id:'B01'}});
 for(const x of [A,A2,B])assert(x.token,'Login with isolated roster failed');
 const self=await req('challenge',{token:A.token,body:{to:'A01',kind:'mesma_turma',level:'iniciante',requestId:id('self')}});
 assert.equal(self.status,400,'Self challenge must fail');
 const create=await req('challenge',{token:A.token,body:{to:'A02',kind:'mesma_turma',level:'iniciante',requestId:id('create')}});
 assert.equal(create.challenge?.status,'CRIADOR_JOGANDO');
 const createdId=create.challenge.id;
 const first=await req('submit',{token:A.token,body:{id:createdId,shots:shots(.03),requestId:id('submit-a')}});
 assert.equal(first.challenge?.status,'PENDENTE');
 const repeated=await req('submit',{token:A.token,body:{id:createdId,shots:shots(.03),requestId:id('submit-a')}});
 assert.deepEqual(repeated,first,'Retry must be idempotent');
 const received=await req('inbox',{token:A2.token});
 assert(received.challenges.some(x=>x.id===createdId&&x.status==='PENDENTE'),'Opponent missing invite');
 const accepted=await req('answer',{token:A2.token,body:{id:createdId,decision:'accept',requestId:id('accept')}});
 assert.equal(accepted.challenge.status,'ACEITO');
 const final=await req('submit',{token:A2.token,body:{id:createdId,shots:shots(.45),requestId:id('submit-b')}});
 assert.equal(final.challenge.status,'CONCLUIDO');
 assert(final.challenge.creatorScore>final.challenge.recipientScore,'Expected first archer win');
 const ranking=await req('ranking');
 assert.equal(ranking.games,1,'Completed duel should enter ranking');
 assert.equal(ranking.classes.length,3);
 assert(ranking.players.some(x=>x.id==='A01'&&x.wins===1),'Winner absent from ranking');
 const inter=await req('challenge',{token:B.token,body:{to:'A01',kind:'interclasses',level:'iniciante',requestId:id('inter')}});
 assert.equal(inter.challenge.status,'CRIADOR_JOGANDO');
 const interShot=await req('submit',{token:B.token,body:{id:inter.challenge.id,shots:shots(.09),requestId:id('inter-shot')}});
 assert.equal(interShot.challenge.status,'PENDENTE');
 const refused=await req('answer',{token:A.token,body:{id:inter.challenge.id,decision:'decline',requestId:id('decline')}});
 assert.equal(refused.challenge.status,'RECUSADO');
 const after=await req('ranking');
 assert.equal(after.games,1,'Refused duel must not enter ranking');
 const inboxB=await req('inbox',{token:B.token});
 assert(inboxB.challenges.some(x=>x.id===inter.challenge.id&&x.status==='RECUSADO'),'Refusal not stored');
 console.log('✅ Isolated real HTTP backend: 3 profiles, self-challenge blocked, invite, accept, 10 shots, score, ranking, decline, idempotency.');
}
try{await run()}finally{
 child.kill('SIGTERM');
 await timeout(180);
 rmSync(dir,{recursive:true,force:true});
}
