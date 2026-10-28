// Conditional fresh-memory route planning. The browser must validate a found
// stream with its own carried flight/campaign memory; this is not acceptance.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {parseArchive} from '../src/assets.js';import {unpackImage} from '../src/game/executable.js';
import {Jungle} from '../src/game/jungle.js';import {DRIVER_HZ,RETRACE_HZ} from '../src/game/application.js';
const options={image:unpackImage(fs.readFileSync('game/DUCKTALE.EXE')),entries:parseArchive(fs.readFileSync('game/JG.ARC')),mainEntries:parseArchive(fs.readFileSync('game/MAIN.ARC')),mountainEntries:parseArchive(fs.readFileSync('game/MT.ARC')),variant:1,difficulty:2,seed:40033,money:0,day:2};
const base=JSON.parse(fs.readFileSync('reference/hard-expedition-inputs.json')).jungle.flatMap(e=>Array(e.count).fill(e.byte));
const results=[];
for(const delay of [0,3,6,9,12,15,18,21,24,27,30,36,42,48,60]) {
 const g=new Jungle(options);assert.equal(g.snapshot().seed,5289,'Conditional initial seed mismatch');
 let tickAt=1+2507*1000/DRIVER_HZ,retraceAt=1+(Math.floor((34409-1)*RETRACE_HZ/1000)+1)*1000/RETRACE_HZ;
 const inputs=[...Array(delay).fill(0),...base],observations=[];
 for(let i=0;i<inputs.length&&!g.outcome;i++) {
  const byte=inputs[i];g.setControls({fire:!!(byte&192),direction:({1:'up',3:'right',5:'down',7:'left'}[byte&63]??null)});
  const before=g.inputs.length;
  for(let n=0;n<500&&!g.outcome&&g.inputs.length===before;n++) {
   if(tickAt<=retraceAt){g.advanceTick();tickAt+=1000/DRIVER_HZ;}else{g.advanceRetrace();retraceAt+=1000/RETRACE_HZ;}
  }
  if(g.inputs.length===before) break;
  if(i%32===0) observations.push({index:i+1,state:g.snapshot()});
 }
 for(let n=0;n<500&&!g.outcome;n++) {
  if(tickAt<=retraceAt){g.advanceTick();tickAt+=1000/DRIVER_HZ;}else{g.advanceRetrace();retraceAt+=1000/RETRACE_HZ;}
 }
 const r={delay,used:g.inputs.length,final:g.snapshot()};results.push(r);console.log(JSON.stringify(r));
 if(g.outcome?.code===1) {
  fs.writeFileSync('.local/security-jungle-found.json',JSON.stringify({scope:'Conditional fresh-memory planning only; requires carried browser replay.',initial:{variant:1,difficulty:2,seed:40033,money:0,day:2},inputs:inputs.slice(0,g.inputs.length),observations,final:g.snapshot()},null,2));break;
 }
}
fs.writeFileSync('.local/security-jungle-delay-planning.json',JSON.stringify(results,null,2));
