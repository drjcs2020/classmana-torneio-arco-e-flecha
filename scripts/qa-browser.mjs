import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='http://127.0.0.1:8765/';
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
 await shot(desktop,'01-escolha-casa-desktop');
 await desktop.locator('button.house[data-house="B"]').click();
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'heroi');
 assert.equal(await desktop.locator('button.house[data-house="B"]').getAttribute('aria-pressed'),'true');
 await shot(desktop,'02-arqueiro-desktop');
 await desktop.locator('#archer-next').click();
 assert.match(await desktop.locator('#archer-carousel-indicator').textContent(),/Valéria/);
 await desktop.locator('[data-equip-bow="real"]').click();
 assert.equal(await desktop.locator('[data-equip-bow="real"]').getAttribute('aria-pressed'),'true');
 await desktop.locator('#confirm-archer').click();
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'desafio');
 await verifyPicture(desktop,'.cm-duel-title');
 await shot(desktop,'03-desafio-desktop');
 await desktop.locator('[data-play-mode="bot"]').click();
 assert.equal(await desktop.locator('#view-inicio').getAttribute('data-step'),'partida');
 await desktop.locator('#challenge-level').selectOption('lendario');
 await desktop.locator('#difficulty').selectOption('hard');
 assert.match(await desktop.locator('#lobby-course').getAttribute('aria-label'),/150/);
 await shot(desktop,'04-preparar-desktop');
 await desktop.locator('#start-game').click();
 await desktop.waitForURL('**/arena.html',{timeout:18000});
 await desktop.locator('#view-arena.active').waitFor({timeout:12000});
 await desktop.waitForTimeout(600);
 assert(await desktop.locator('#world').isVisible());
 assert.equal(await desktop.locator('#stage').getAttribute('data-level'),'lendario');
 await shot(desktop,'05-arena-desktop');
 await desktop.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(base,{waitUntil:'domcontentloaded'});await mobile.waitForTimeout(600);
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'reino');
 await shot(mobile,'06-casa-mobile');
 await mobile.locator('button.house[data-house="C"]').click();
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'heroi');
 await shot(mobile,'07-arqueiro-mobile');
 await mobile.locator('#confirm-archer').click();
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'desafio');
 await shot(mobile,'08-desafio-mobile');
 await mobile.locator('[data-play-mode="practice"]').click();
 assert.equal(await mobile.locator('#view-inicio').getAttribute('data-step'),'partida');
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
