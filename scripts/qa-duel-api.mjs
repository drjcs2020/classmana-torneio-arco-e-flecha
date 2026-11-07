import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=readFileSync('online-config.js','utf8');
const url=config.match(/https:\/\/[^'"]+\/api/)?.[0];
assert(url,'Live duel API URL missing');
const ctrl=new AbortController();
const timeout=setTimeout(()=>ctrl.abort(),15000);
async function read(action){
 const u=new URL(url);u.searchParams.set('action',action);
 const response=await fetch(u,{cache:'no-store',signal:ctrl.signal});
 assert(response.ok,'API '+action+' failed: '+response.status);
 const data=await response.json();
 assert(data.ok!==false,'API '+action+' error: '+data.error);
 return data;
}
try{
 const ping=await read('ping');
 assert.equal(Number(ping.api),10,'Expected ClassMana protocol v10');
 const ranking=await read('ranking');
 assert(Number.isInteger(ranking.games)&&ranking.games>=0,'Invalid completed duels count');
 for(const field of ['classes','teams','players'])assert(Array.isArray(ranking[field]),'Missing '+field+' ranking');
 assert.equal(ranking.classes.length,3,'Ranking must list 3 classes');
 assert(ranking.teams.every(t=>typeof t.name==='string'&&t.name.length>0),'Team label absent');
 console.log('✅ API v10 online, '+ranking.games+' completed duels, '+ranking.teams.length+' teams.');
}finally{clearTimeout(timeout)}
