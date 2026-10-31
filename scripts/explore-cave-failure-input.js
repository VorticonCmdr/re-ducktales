// Real browser observation from startup; no state restore or memory injection.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fresh,archiveSource,json,checkSource} from './lib/local-scenario-source.js';
import {withCarlsbadBrowser} from './lib/carlsbad-browser.js';
import {observeRecordedRoute,saveRecordedRoute} from '../tests/browser/helpers/entry-recording.js';
import {recordedDOMInput} from '../tests/browser/helpers/recorded-dom-input.js';
const root=await fresh(process.argv.find(a=>a.startsWith('--output='))?.slice(9));
await archiveSource(root);
const source='.local/result-earned-browser-01';
const checks=await json(source+'/campaign-checkpoints.json'),events=await json(source+'/captured-events.json');
const entry=checks.find(c=>c.name==='cave-entry');assert.ok(entry);
await withCarlsbadBrowser(async ({page,state,until})=>{
 const points=[];const note=async name=>{const p=await observeRecordedRoute({page,state:await state(),name});points.push(p);console.log(name,JSON.stringify({scene:p.state.scene,result:p.state.expeditionResult,overlay:p.state.systemOverlay,day:p.state.campaign.day}));};
 let now=1;
 for(const e of events.slice(0,entry.eventCount)){if(e.time>now)await page.clock.runFor(e.time-now);now=e.time;await recordedDOMInput(page,e);}
 await page.clock.runFor(entry.at-now);
 assert.equal((await state()).scene,'cave');await note('entry');
 await until(s=>s.cave.phase==='exploring');
 const s=await state(), rooms=s.cave.rooms,queue=[[s.cave.room,[]]],seen=new Set();let path;
 while(queue.length){const [at,p]=queue.shift();if(rooms[at]&64){path=p;break;}if(seen.has(at))continue;seen.add(at);
 for(const [key,bit,delta]of [['ArrowLeft',1,-1],['ArrowRight',2,1],['ArrowDown',4,8],['ArrowUp',8,-8]]){const n=at+delta;if(rooms[at]&bit&&n>=0&&n<64&&!(rooms[n]&32))queue.push([n,[...p,key]]);}}
 assert.ok(path?.length);
 for(const key of path){await until(v=>v.scene!=='cave'||v.cave.phase==='exploring');assert.equal((await state()).scene,'cave');const old=(await state()).cave.room;await page.keyboard.down(key);await page.keyboard.down('Space');await until(v=>v.scene!=='cave'||v.cave.room!==old);await page.keyboard.up('Space');await page.keyboard.up(key);}
 await until(v=>v.scene==='expedition-result');assert.equal((await state()).expeditionResult.phase,'failure');await note('failure');
 await page.keyboard.press('p');await page.clock.runFor(16);await note('after-p');
 await saveRecordedRoute({page,root,observations:points,difficulty:0,physical:true,scope:'Exploratory cave pit/failure P input observation;not acceptance or native timing'});
 await page.locator('#restart').click();await until(v=>v.scene==='title');
});
await checkSource(root,p=>p.startsWith('src/')||p.startsWith('scripts/')||p.startsWith('tests/'));
