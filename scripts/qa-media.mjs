import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const logo='assets/images/logo-classmana-oficial.webp';
const music='assets/sounds/kulakovka-epic-medieval-614879.mp3';
const l=fs.readFileSync(logo),m=fs.readFileSync(music);
assert.equal(l.length,122064,'Logo size differs from verified uploaded version');
assert.equal(l.subarray(0,4).toString(),'RIFF');
assert.equal(l.subarray(8,12).toString(),'WEBP');
assert.equal(m.length,3299369,'Soundtrack is incomplete');
assert.equal(createHash('sha256').update(m).digest('hex'),'7b8e8a371ed93aecdf850708fa9ae2ac7b42f324ed63577851d370b02f289cf5','Soundtrack must match original uploaded MP3');
const index=fs.readFileSync('index.html','utf8');
const arena=fs.readFileSync('arena.html','utf8');
const audio=fs.readFileSync('arena-audio.js','utf8');
for(const html of [index,arena]){
 assert(html.includes('assets/images/logo-classmana-oficial.webp'),'Logo not connected to both pages');
 assert(!html.includes('assets/images/arte-002.webp'),'Blurry logo still referenced');
}
assert(audio.includes("const bgm=new Audio(MUSIC_FILE)"),'User soundtrack not loaded');
assert(audio.includes('active?.045:.28'),'Arena music attenuation not configured');
assert(!audio.includes('function musicTick()'),'Synthetic music still present');
console.log('PASS: original MP3 SHA256, logo file, visual references, music fade and soundtrack path');
