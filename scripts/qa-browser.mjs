import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='http://127.0.0.1:8000/';
fs.mkdirSync('qa-screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const errors=[];
async function shot(page,name){
 const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)-window.innerHeight);
 assert(overflow<=4,name+' vertical scroll '+overflow+'px');
 await page.screenshot({path:'qa-screenshots/'+name+'.png',fullPage:false});
}
async function verifyPicture(page,css){
 await page.locator(css).evaluate(async img=>{
  if(img.complete&&img.naturalWidth>0)return;
  await new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});});
  if(!img.naturalWidth)throw Error('Missing image '+img.src);
 });
}
try{
 const desktop=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
 desktop.on('pageerror',e=>errors.push('desktop: '+e.message));
 await desktop.goto(base,{waitUntil:'domcontentloaded'});await desktop.waitForTimeout(750);
 assert.equal(await desktop.locator('body').getAttribute('data-page'),'lobby');
 const musicResponse=await desktop.request.get(base+'assets/sounds/kulakovka-epic-medieval-614879.mp3');
 assert.equal(musicResponse.status(),200,'Official MP3 must be accessible');
 const logoResponse=await desktop.request.get(base+'assets/images/logo-classmana-oficial.webp');
 assert.equal(logoResponse.status(),200,'Official ClassMana logo must load');
 await desktop.locator('#cm-lobby-sound').click();
 await desktop.waitForFunction(async()=>{
  const mod=await import('./arena-audio.js?v=media38');
  return mod.arenaAudio.musicState.playing;
 },null,{timeout:8000});
 await desktop.waitForFunction(async()=>{
  const mod=await import('./arena-audio.js?v=media38');
  return mod.arenaAudio.musicState.volume>=.20;
 },null,{timeout:10000});
 const soundtrack=await desktop.evaluate(async()=>{
  const mod=await import('./arena-audio.js?v=media38');
  return mod.arenaAudio.musicState;
 });
 assert(soundtrack.volume>=.20,'Lobby soundtrack must have audible volume');
 assert(soundtrack.source.includes('kulakovka-epic-medieval-614879.mp3'),'Wrong soundtrack loaded');
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'reino','Must open on house selection');
 assert.equal(await desktop.locator('#cm-main-menu').count(),0,'Deprecated intro screen must not be rendered');
 await verifyPicture(desktop,'.cm-house-title');
 const geometry=await desktop.evaluate(()=>{
 const list=['#view-inicio','#houses','button.house[data-house="A"]','.cm-house-title'];
 return Object.fromEntries(list.map(sel=>{const el=document.querySelector(sel),cs=getComputedStyle(el),r=el.getBoundingClientRect();
 return [sel,{rect:{x:r.x,y:r.y,width:r.width,height:r.height},display:cs.display,position:cs.position,top:cs.top,bottom:cs.bottom,height:cs.height,minHeight:cs.minHeight,maxHeight:cs.maxHeight,overflow:cs.overflow,gridRows:cs.gridTemplateRows,visibility:cs.visibility}]}));
 });
 console.log('LAYOUT DIAGNOSTIC',JSON.stringify(geometry));
 assert(geometry['button.house[data-house="A"]'].rect.height>140,'House card collapsed');
 for(const house of await desktop.locator('button.house').all()){
  const b=await house.boundingBox();
  assert(b&&b.width>200&&b.height>250,'House card collapsed on desktop: '+JSON.stringify(b));
 }
 await shot(desktop,'01-escolha-casa-desktop');
 await desktop.locator('button.house[data-house="B"]').click();
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'perfil');
 await desktop.locator('#cm-identity-player').selectOption('B01');
 await verifyPicture(desktop,'.cm-identity-logo');
 const identityBox=await desktop.locator('.cm-identity-panel').evaluate(el=>{
   const r=el.getBoundingClientRect(),cs=getComputedStyle(el),last=el.querySelector('#cm-confirm-identity')?.getBoundingClientRect();
   const brand=document.querySelector('#view-inicio .cm-house-title')?.getBoundingClientRect();
   return {top:r.top,bottom:r.bottom,width:r.width,overflowY:cs.overflowY,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,
    confirmBottom:last?.bottom,brandBottom:brand?.bottom};
 });
 assert(identityBox.width>=790,'Student identity panel too narrow');
 assert(identityBox.scrollHeight<=identityBox.clientHeight+3,'Student identity panel has unnecessary internal scroll');
 assert(identityBox.confirmBottom<=identityBox.bottom-6,'Confirm player button clipped');
 await shot(desktop,'01b-identidade-desktop');
 const logoDimensions=await desktop.locator('.cm-identity-logo').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
 assert(logoDimensions.width>=1300&&logoDimensions.height>=480,'ClassMana logo is low-resolution');
 await desktop.locator('#cm-confirm-identity').click();
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'heroi');
 await desktop.reload({waitUntil:'domcontentloaded'});
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'reino','Reload must end previous pupil session');
 await desktop.locator('button.house[data-house="B"]').click();
 await desktop.locator('#cm-identity-player').selectOption('B01');
 await desktop.locator('#cm-confirm-identity').click();
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'heroi');
 assert.equal(await desktop.locator('button.house[data-house="B"]').getAttribute('aria-pressed'),'true');
 const panelsHero=await desktop.evaluate(()=>['.studio-character','.studio-equipment','.studio-carousel'].map(selector=>{
 const style=getComputedStyle(document.querySelector(selector));return {selector,background:style.backgroundImage,color:style.backgroundColor};
}));
for(const row of panelsHero)assert.equal(row.background,'none','Painel do arqueiro cobriu cenário: '+row.selector);
await shot(desktop,'02-arqueiro-desktop');
 await desktop.locator('#archer-next').click();
 assert.match(await desktop.locator('#archer-carousel-indicator').textContent(),/Valéria/);
 await desktop.locator('[data-equip-bow="real"]').click();
 assert.equal(await desktop.locator('[data-equip-bow="real"]').getAttribute('aria-pressed'),'true');
 const confirmButton=await desktop.locator('#confirm-archer').boundingBox();
 assert(confirmButton&&confirmButton.width<=320&&confirmButton.height<=82,'Confirm button disproportionate: '+JSON.stringify(confirmButton));
 await desktop.locator('#confirm-archer').click();
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'desafio');
 await verifyPicture(desktop,'.cm-duel-title');
 const duelPanels=await desktop.evaluate(()=>[...document.querySelectorAll('.cm-duel-mode[data-play-mode]')].map(x=>getComputedStyle(x).backgroundImage));
assert(duelPanels.every(x=>x==='none'),'Botões ilustrados não podem ter painéis atrás');
assert(await desktop.locator('#cm-ranking-choice').isVisible(),'Ranking shortcut not visible');
 const tileSizes=await desktop.locator('.cm-duel-mode').evaluateAll(els=>els.map(el=>{
  const r=el.getBoundingClientRect();return {w:r.width,h:r.height};
 }));
 assert.equal(tileSizes.length,6,'Expected five play modes and ranking');
 assert(Math.max(...tileSizes.map(x=>x.h))-Math.min(...tileSizes.map(x=>x.h))<2,'Tiles must have the same height');
 assert(Math.max(...tileSizes.map(x=>x.w))-Math.min(...tileSizes.map(x=>x.w))<2,'Tiles must have the same width');
 const rankingTile=await desktop.locator('#cm-ranking-choice').evaluate(el=>getComputedStyle(el).backgroundImage);
 assert(rankingTile.includes('botao-ranking-classmana.svg'),'Ranking needs the approved blue-and-gold artwork');
 await desktop.locator('#cm-ranking-choice').click();
 assert(await desktop.locator('#view-ranking.active').isVisible(),'Ranking button must open the standings');
 await desktop.waitForFunction(()=>{
  const status=document.querySelector('#ranking-status')?.textContent||'';
  return status.includes('duelos concluídos')||status.includes('⚠️');
 },null,{timeout:16000});
 assert.match(await desktop.locator('#ranking-status').textContent(),/duelos concluídos/,'Ranking must load live server data, not show an error');
 assert((await desktop.locator('#rank-houses .rankline').count())>=3,'House ranking must contain three classes');
 assert((await desktop.locator('#rank-players .rankline').count())>=1,'Player ranking must contain duel results');
 const rankingLegibility=await desktop.locator('#view-ranking').evaluate(root=>{
  const panel=root.querySelector('.ranking-panel');
  const title=root.querySelector('.ranking-panel h2');
  const line=root.querySelector('.rankline b');
  return {panel:getComputedStyle(panel).backgroundImage,title:getComputedStyle(title).color,line:line?getComputedStyle(line).color:null};
 });
 assert(rankingLegibility.panel.includes('gradient'),'Ranking cards must have a parchment texture');
 const rankOverflow=await desktop.locator('#view-ranking .ranking-panel').evaluateAll(els=>els.map(el=>getComputedStyle(el).overflowY));
 assert(rankOverflow.every(x=>x==='visible'),'Ranking should not hide players inside nested scrolling lists');
 assert(rankingLegibility.title==='rgb(255, 238, 189)','Ranking header contrast incorrect');
 if(rankingLegibility.line)assert.equal(rankingLegibility.line,'rgb(38, 25, 14)','Ranking text must be dark on parchment');
 const rankLayout=await desktop.locator('#view-ranking').evaluate(root=>{
  const groups=root.querySelector('#rank-houses');
  const archers=root.querySelector('#rank-players');
  const exit=root.querySelector('#rank-play').getBoundingClientRect();
  return {groupColumns:getComputedStyle(groups).gridTemplateColumns.split(' ').length,
    archerColumns:getComputedStyle(archers).gridTemplateColumns.split(' ').length,
    exitBottom:exit.bottom,viewport:innerHeight,
    exitWidth:exit.width};
 });
 assert.equal(rankLayout.groupColumns,3,'Houses must be presented in three balanced columns');
 assert.equal(rankLayout.archerColumns,2,'Archer rankings should use two columns');
 assert(rankLayout.exitBottom<=rankLayout.viewport+4,'Fechar Placar is offscreen: '+JSON.stringify(rankLayout));
 await shot(desktop,'03b-ranking-desktop');
 await desktop.locator('#rank-play').click();
 assert(await desktop.locator('#view-inicio.active').isVisible(),'Closing ranking must return to game');
await shot(desktop,'03-desafio-desktop');
 await desktop.locator('[data-play-mode="bot"]').click();
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'partida');
 await desktop.locator('#challenge-level').selectOption('lendario');
 await desktop.locator('#difficulty').selectOption('hard');
 assert.match(await desktop.locator('#lobby-course').getAttribute('aria-label'),/150/);
 const setupVisual=await desktop.evaluate(()=>{
  const head=document.querySelector('#view-inicio[data-step="partida"] .setup-head');
  const items=[...document.querySelectorAll('#view-inicio[data-step="partida"] .setup-fields>label:not(.hidden)')];
  const start=document.querySelector('#start-game').getBoundingClientRect();
  return {
    headerBackground:getComputedStyle(head).backgroundImage,
    labels:items.map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height,
      background:getComputedStyle(x).backgroundImage,selectWidth:x.querySelector('select')?.getBoundingClientRect().width})),
    startBottom:start.bottom,viewport:window.innerHeight
  };
 });
 assert(setupVisual.headerBackground.includes('gradient'),'Preparation needs a decorated fantasy title');
 assert(setupVisual.labels.length>=4&&setupVisual.labels.every(x=>x.width>300&&x.height>=78&&x.background.includes('gradient')),
 'Preparation controls must use consistent framed cards: '+JSON.stringify(setupVisual));
 assert(setupVisual.startBottom<=setupVisual.viewport+6,'Start game is clipped below viewport');
await shot(desktop,'04-preparar-desktop');
 await desktop.locator('#mode').selectOption('challenge_team');
 await desktop.locator('#team-scope').selectOption('same');
 assert(await desktop.locator('#team-label').isVisible(),'Team challenge must display player's team');
 assert(await desktop.locator('#opponent-team-label').isVisible(),'Team challenge must display opposing team');
 assert(await desktop.locator('#rival-label').isVisible(),'Team challenge must display opposing archer');
 const teamFields=await desktop.locator('#view-inicio[data-step="partida"] .setup-fields>label:not(.hidden)').evaluateAll(els=>els.map(el=>{
   const r=el.getBoundingClientRect(),select=el.querySelector('select')?.getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,selectBottom:select?.bottom};
 }));
 assert(teamFields.length>=6,'Missing team challenge fields');
 assert(teamFields.every(x=>x.left>=0&&x.right<=1367&&x.selectBottom<=x.bottom),'Team fields clipped');
 await shot(desktop,'04b-desafiar-equipe-desktop');
 await desktop.locator('#mode').selectOption('bot');
 await desktop.locator('#start-game').click();
 await desktop.waitForURL('**/arena.html',{timeout:18000});
 await desktop.locator('#view-arena.active').waitFor({timeout:12000});
 await desktop.waitForTimeout(600);
 assert(await desktop.locator('#world').isVisible());
 await desktop.waitForFunction(()=>document.body.classList.contains('cm-art-on'),null,{timeout:11000});
 const backBox=await desktop.locator('#leave-arena').boundingBox();
 assert(backBox&&backBox.x<100&&backBox.y<100&&backBox.width>=110&&backBox.height>=50,
  'Back button must be readable at top-left of the arena: '+JSON.stringify(backBox));
 assert.equal(await desktop.locator('#stage').getAttribute('data-level'),'lendario');
 await shot(desktop,'05-arena-desktop');
await desktop.goto(base+'arena.html?qa=1',{waitUntil:'domcontentloaded'});
await desktop.locator('#view-arena.active').waitFor({timeout:12000});
await desktop.waitForTimeout(4500);
for(const model of [
  'models3d/arco_aguia_dourada.glb',
  'models3d/arco_leao_de_fogo.glb',
  'models3d/arco_dragao_de_esmeralda.glb',
  'models3d/flecha_aguia_dourada.glb',
  'models3d/flecha_leao_de_fogo.glb',
  'models3d/flecha_dragao_de_esmeralda.glb',
  'models3d/alvo_suspenso_sem_cavalete.glb']){
  const res=await desktop.request.get(base+model);
  assert.equal(res.status(),200,'Missing approved 3D asset: '+model);
 }
const engine=await desktop.locator('#stage').getAttribute('data-scene-engine');
console.log('ENGINE3D_DIAGNOSTIC',engine);
if(engine==='playcanvas'){
 await desktop.waitForFunction(()=>{
  const p=document.querySelector('#stage');
  return p?.dataset.glbBow==='ready'&&p?.dataset.glbTarget==='ready'&&p?.dataset.glbArrow==='ready';
 },null,{timeout:18000});
 const r=await desktop.locator('#stage').boundingBox();
 for(const pos of [[.33,.35],[.66,.58],[.49,.42]]){
  await desktop.mouse.move(r.x+r.width*pos[0],r.y+r.height*pos[1]);
  await desktop.waitForTimeout(250);
  const diag=await desktop.evaluate(()=>document.querySelector('#stage').cmAimDiagnostic?.());
  assert(diag&&diag.kind==='PlayCanvas 3D','Diagnóstico 3D indisponível');
  const delta=Math.hypot(diag.input.x-diag.projected.x,diag.input.y-diag.projected.y);
  console.log('MIRA',JSON.stringify(diag),delta);
  assert(delta<.025,'Mira 3D deslocada do ponteiro: '+delta);
 }
}

 await desktop.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(base,{waitUntil:'domcontentloaded'});await mobile.waitForTimeout(600);
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'reino');
 for(const house of await mobile.locator('button.house').all()){
  const b=await house.boundingBox();
  assert(b&&b.width>250&&b.height>120,'House card collapsed on mobile: '+JSON.stringify(b));
 }
 await shot(mobile,'06-casa-mobile');
 await mobile.locator('button.house[data-house="C"]').click();
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'perfil');
 await mobile.locator('#cm-identity-player').selectOption('C01');
 await mobile.locator('#cm-confirm-identity').click();
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'heroi');
 await shot(mobile,'07-arqueiro-mobile');
 await mobile.locator('#confirm-archer').click();
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'desafio');
 await shot(mobile,'08-desafio-mobile');
 await mobile.locator('[data-play-mode="practice"]').click();
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'partida');
 const fields=await mobile.locator('#view-inicio[data-step="partida"] .setup-fields>label:not(.hidden) select').evaluateAll(els=>els.map(el=>{
  const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
  return {width:r.width,height:r.height,color:cs.color,background:cs.backgroundColor};
 }));
 assert(fields.length>=3,'Preparation labels missing');
 assert(fields.every(x=>x.width>=300&&x.height>=40),'Mobile preparation fields must be full-width and legible: '+JSON.stringify(fields));
 await shot(mobile,'09-preparar-mobile');
 await mobile.locator('#start-game').click();
 await mobile.waitForURL('**/arena.html',{timeout:18000});
 await mobile.locator('#view-arena.active').waitFor({timeout:12000});
 await shot(mobile,'10-arena-mobile');
 await mobile.close();
 assert.deepEqual(errors,[],'Uncaught browser exceptions');
 console.log('✅ Fluxo Casa → personagem/arco → duelo → preparar → arena, desktop + celular, sem scroll e com imagens.');
}catch(e){console.error('❌ QA failed:',e);console.error(errors);process.exitCode=1}
finally{await browser.close()}
