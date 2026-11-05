import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const raw=readFileSync('online-config.js','utf8');
const matched=raw.match(/ONLINE_API_URL\s*=\s*['"]([^'"]+)['"]/);
assert(matched,'ONLINE_API_URL ausente');
const base=matched[1];
assert(/^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(base),'URL precisa apontar para /exec');
async function ping(action){
 const callback='cmHealthCheck';
 const url=base+'?'+new URLSearchParams({action,callback,_:String(Date.now())});
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),19000);
 try{
  const response=await fetch(url,{signal:ctrl.signal,redirect:'follow',headers:{'User-Agent':'ClassMana-health-check/1.0'}});
  const body=await response.text();
  if(!response.ok)throw Error('HTTP '+response.status);
  const match=body.match(/^cmHealthCheck\((\{[\s\S]*\})\);?\s*$/);
  if(!match)throw Error('Retorno não é JSONP válido; verifique o acesso público da implantação /exec. Recebido: '+body.slice(0,100).replace(/\s+/g,' '));
  const json=JSON.parse(match[1]);
  if(!json.ok)throw Error('Apps Script retornou erro: '+(json.error||'sem detalhes'));
  return json;
 }finally{clearTimeout(timer)}
}
try{
 const p=await ping('ping');
 if(Number(p.api)<7)throw Error('API /exec na versão '+p.api+'; código no GitHub é v7. Republique backend/Code.gs na mesma implantação.');
 console.log('OK ping: API v'+p.api);
 const roster=await ping('roster');
 console.log('OK roster: '+(roster.players?.length||0)+' perfis disponíveis');
 const ranking=await ping('ranking');
 console.log('OK ranking: '+(ranking.games||0)+' desafios concluídos');
}catch(e){console.error('FALHA API ONLINE: '+(e?.message||e));process.exitCode=1}
