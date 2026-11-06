import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

// Integration contract without modifying any real student sheet / creating a real duel.
const server=readFileSync('backend/Code.gs','utf8');
const fakeHtmlService={
  createHtmlOutput(html){return {html,setTitle(title){this.title=title;return this}}}
};
const sandbox={HtmlService:fakeHtmlService,SpreadsheetApp:{openById(){return {}}}};
vm.runInNewContext(server+'\nthis.cmTest={portal:cmOnlinePortal_,gateway:cmGateway,doGet:doGet};',sandbox);
const app=sandbox.cmTest;
const html=app.portal({house:'B',mode:'challenge_team',player:'B11'}).html;
assert.match(html,/google\.script\.run/);
assert.match(html,/postMessage/);
assert.match(html,/mode=challenge_team/);
assert.match(html,/player=B11/);
assert.match(html,/classmana-torneio-arco-e-flecha\/\?hosted=1/);
assert.match(html,/drjcs2020\.github\.io/);
const inline=html.match(/<script>([\s\S]+?)<\/script>/)?.[1];
assert.ok(inline,'script da ponte não encontrado');
new vm.Script(inline);
const ping=app.gateway({verb:'GET',action:'ping',params:{}});
assert.equal(ping.api,9,'gateway servidor deve responder API v9');
assert.equal(app.gateway({verb:'POST',action:'invalid',params:{}}).ok,false);
const hosted=app.doGet({parameter:{play:'1',house:'A',mode:'challenge_same'}});
assert.match(hosted.html,/classmana-torneio-arco-e-flecha/);
console.log('PASS portal HTML + script + roteador GET e POST');

// Simulate a parent HTMLService delivering ready and async Google.script.run responses.
const listeners=new Set();
let loginCalls=0,created=0,requests=[];
const parent={
  postMessage(msg){
    queueMicrotask(()=>{
      if(msg.type==='cm-gateway-hello-v1'){
        for(const fn of [...listeners])fn({origin:'https://n-test-script.googleusercontent.com',source:parent,data:{type:'cm-gateway-ready-v1',version:9}});
        return;
      }
      if(msg.type!=='cm-gateway-request-v1')return;
      requests.push({verb:msg.verb,action:msg.action});
      let data={ok:true};
      if(msg.action==='ping')data={ok:true,api:9};
      if(msg.action==='login'){loginCalls++;data={ok:true,user:{id:msg.params.id,name:'Aluno fictício',house:'A',team:'Equipe Fictícia'}};}
      if(msg.action==='challenge'){created++;data={ok:true,challenge:{id:'TEST-DUEL',kind:'mesma_turma',status:'CRIADOR_JOGANDO'}}}
      if(msg.action==='inbox')data={ok:true,challenges:[]};
      for(const fn of [...listeners])fn({origin:'https://n-test-script.googleusercontent.com',source:parent,data:{type:'cm-gateway-response-v1',rid:msg.rid,data}});
    });
  }
};
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}}
const window={parent,addEventListener:(type,fn)=>{if(type==='message')listeners.add(fn)},removeEventListener:(type,fn)=>{if(type==='message')listeners.delete(fn)}};
const src=readFileSync('online-client.js','utf8')
  .replace(/^import .*\n/m,'')
  .replace(/^export const online=/m,'const online=')
  +'\nthis.testOnline=online;';
const context={window,sessionStorage:storage(),localStorage:storage(),crypto:webcrypto,URL,URLSearchParams,console,setTimeout,clearTimeout,setInterval,clearInterval,Promise};
vm.runInNewContext('const ONLINE_API_URL="https://script.google.com/macros/s/AKfycbzJ5MB-NWFLJKyh0kaj2Isaiv2H_KK32v8FNuKVltmKiEwpuEeHHNAJBbNfNlc-0jLkTw/exec";\n'+src,context);
const online=context.testOnline;
assert.equal(await online.connect(),true,'handshake');
assert.equal(online.apiVersion,9);
const [first,second]=await Promise.all([online.login('A01'),online.login('A01')]);
assert.equal(first.id,'A01');assert.equal(second.id,'A01');
assert.equal(loginCalls,1,'não duplicar login simultâneo');
assert.equal((await online.create('mesma_turma','A02','iniciante')).id,'TEST-DUEL');
assert.equal(created,1,'uma única criação de convite');
assert.equal((await online.inbox()).length,0);
assert.match(online.portalUrl({house:'B',mode:'challenge',player:'B11'}),/play=1.*house=B.*mode=challenge.*player=B11/);
assert.deepEqual(requests.map(r=>r.action),['ping','login','challenge','inbox']);
console.log('PASS handshake v9 + seleção de aluno + criação do convite + inbox (sem dados reais)');
