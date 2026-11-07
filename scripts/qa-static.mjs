import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html'),arena=read('arena.html'),game=read('game-v3.js'),client=read('online-client.js');
const required=['index.html','arena.html','tour-layout.css','studio.css','game-v3.js','scene-v3.js','arena-audio.js',
 'online-config.js','online-client.js','duel-buttons-proportions.css','sprite-hud.js','sprite-hud.css'];
for(const path of required)assert(fs.existsSync(path),'Missing file: '+path);
for(const [page,html] of [['index.html',index],['arena.html',arena]]){
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size,'Duplicate IDs in '+page);
 for(const ref of [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map(m=>m[1])){
  assert(fs.existsSync(ref),'Missing asset '+ref+' in '+page);
 }
 assert(html.includes('id="world"'),'Arena canvas missing in '+page);
 assert(html.includes('game-v3.js?v='),'Shared game logic missing in '+page);
}
assert(index.includes('data-page="lobby"'));
assert(arena.includes('data-page="arena"'));
assert(index.includes('id="cm-identity-back"'),'Back button missing');
assert(index.includes('id="cm-previous-session"'),'Current-session identity display missing');
assert(index.includes('id="cm-previous-session-exit"'),'Session exit control missing');
assert(index.includes('id="cm-ranking-choice"'),'Ranking choice missing');
assert(index.includes('id="ranking-tabs"'),'Ranking tabs missing');
assert(index.includes('duel-buttons-proportions.css?v='),'Button proportions missing');
assert.equal((index.match(/data-house="[ABC]"/g)||[]).length>=3,true,'Three houses missing');
assert.equal((index.match(/data-play-mode=/g)||[]).length,5,'Five play modes missing');
const known=new Set([...index.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const requested=[...new Set([...game.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))];
const missing=requested.filter(id=>!known.has(id));
// These two DOM nodes are optional and/or created dynamically by JavaScript.
assert.deepEqual(missing.filter(id=>!['cm-quick-player','cm-duel-turn'].includes(id)),[],'Broken game DOM selectors');
assert(game.includes("panel.id='cm-duel-turn'"),'Dynamic turn status missing');
assert(game.includes('cmResumeSameStudent'),'Reload-safe session state missing');
assert(game.includes('cmMarkInternalReturn()'),'Arena return handoff missing');
assert(game.includes('cmShowActiveSession()'),'Session display missing');
assert(game.includes("$('cm-ranking-choice')?.addEventListener"),'Ranking shortcut not interactive');
assert(game.includes("window.location.assign('./arena.html')"),'Arena navigation missing');
assert(game.includes('cm_active_archery_match_v1'),'Match handoff missing');
assert(game.includes('mountSpriteHUD'),'Visual HUD hookup missing');
assert(read('scene-v3.js').includes('projectile.lookAt'),'Arrow pitch update missing');
assert(read('sprite-hud.js').includes('onPowerRelease'),'Shot release HUD missing');
assert(read('arena-audio.js').includes('function musicTick'),'Audio engine missing');
assert(client.includes("Number(ping.api)!==10"),'Current API v10 check missing');
assert(game.includes('online.ranking()'),'Real ranking request missing');
for(const imp of [...game.matchAll(/from '\.\/(.*?)'/g)])
 assert(fs.existsSync(imp[1].split('?')[0]),'Missing JS module '+imp[1]);
console.log('✅ ClassMana current client: module refs, assets, selectors, sessions, ranking and archery invariants.');
