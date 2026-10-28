// Conditional flight planning from a fully carried, independently replayed
// port prefix. Copies all64K of the resulting port data segment for each policy.
// This is not a DOS machine restore and is not browser acceptance.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {Flight} from '../src/game/flight.js';import {FlightMemory} from '../src/game/flight-physics.js';
import {DRIVER_HZ,RETRACE_HZ} from '../src/game/application.js';
process.argv=['node','scripts/replay-hard-campaign.js','.local/security-campaign-cave-prefix-05','--diagnose'];
const logs=[],logger=console.log;console.log=x=>logs.push(x);
const{game,archives}=await import('../scripts/replay-hard-campaign.js');console.log=logger;
fs.writeFileSync('.local/security-campaign-cave-prefix-05/replay.log',logs.join('\n')+'\n');
assert.equal(game.scene,'departure');assert.equal(game.seed,51213);assert.equal(game.campaign.day,12);
const memory=Uint8Array.from(game.flightMemory.bytes),results=[];
const contract={...game.departure.flightRequest,seed:game.seed,day:game.campaign.day,money:game.money,difficulty:game.difficulty};
for(const [low,high] of [[10,25],[25,40],[0,2],[0,10],[5,15],[40,55],[50,65],[75,90],[100,115]]) for(const climb of [1,2,3]) {
 const f=new Flight({...game.flightResources,...contract},new FlightMemory(memory));
 let now=0,tickAt=1000/DRIVER_HZ,retraceAt=1000/RETRACE_HZ,lastRead=-1,lastPhase=null;
 for(let n=0;!f.outcome && n<15000;n++) {
  const s=f.snapshot();
  if(f.inputLog.length!==lastRead||s.phase!==lastPhase) {
   const target=s.tile>s.tiles-5?(s.y<135?15:0):s.y>high?climb:s.y<low?15:0;
   const delta=(target-s.heading+16)%16,direction=s.speed<4||!delta?null:delta<8?'down':'up';
   f.setControls({fire:true,direction});lastRead=f.inputLog.length;lastPhase=s.phase;
  }
  now+=8;
  while(Math.min(tickAt,retraceAt)<=now) {if(tickAt<=retraceAt){f.advanceTick();tickAt+=1000/DRIVER_HZ;}else{f.advanceRetrace();retraceAt+=1000/RETRACE_HZ;}}
  if(f.phase==='return')f.requestFire();
 }
 const s=f.snapshot(),r={low,high,climb,outcome:f.outcome,x:s.x,y:s.y,tile:s.tile,reads:f.inputLog.length};results.push(r);console.log(JSON.stringify(r));
}
fs.writeFileSync('.local/security-cave-flight-policy-planning.json',JSON.stringify({scope:'Conditional port planning after12 exact carried Game checkpoints; copied full port DS, not an original emulator checkpoint or browser acceptance.',contract,results},null,2));
