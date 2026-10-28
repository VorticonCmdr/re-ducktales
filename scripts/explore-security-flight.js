// Conditional planning only: first-flight memory is fresh in Game. Uses the
// observed departure contract, not a seed chosen to fit an expected outcome.
import {readFileSync,writeFileSync} from 'node:fs';
import {parseArchive} from '../src/assets.js';
import {unpackImage} from '../src/game/executable.js';
import {Flight} from '../src/game/flight.js';
import {DRIVER_HZ,RETRACE_HZ} from '../src/game/application.js';
const entries=parseArchive(readFileSync('game/PLANE.ARC')),image=unpackImage(readFileSync('game/DUCKTALE.EXE'));
const results=[];
for(const [low,high] of [[25,40],[0,2],[0,10],[10,25],[50,65],[75,90],[100,115]]) for(const climb of [1,2,3]) {
 const f=new Flight({image,entries,seed:54124,day:1,money:0,difficulty:2,days:1,racing:1});
 let now=0,tickAt=1000/DRIVER_HZ,retraceAt=1000/RETRACE_HZ,lastRead=-1,lastPhase=null;
 const inputs=[];
 for(let n=0;!f.outcome && n<12000;n++) {
  const s=f.snapshot();
  if(f.inputLog.length!==lastRead||s.phase!==lastPhase) {
   const target=s.tile>s.tiles-5?(s.y<135?15:0):s.y>high?climb:s.y<low?15:0;
   const delta=(target-s.heading+16)%16;
   const direction=s.speed<4||!delta?null:delta<8?'down':'up';
   f.setControls({fire:true,direction});inputs.push({read:f.inputLog.length,phase:s.phase,byte:192|({down:5,up:1}[direction]??0)});
   lastRead=f.inputLog.length;lastPhase=s.phase;
  }
  now+=8;
  while(Math.min(tickAt,retraceAt)<=now) {
   if(tickAt<=retraceAt){f.advanceTick();tickAt+=1000/DRIVER_HZ;}
   else {f.advanceRetrace();retraceAt+=1000/RETRACE_HZ;}
  }
  if(f.phase==='return') f.requestFire();
 }
 const s=f.snapshot();const r={low,high,climb,outcome:f.outcome,x:s.x,y:s.y,tile:s.tile,reads:f.inputLog.length};results.push(r);console.log(JSON.stringify(r));
}
writeFileSync('.local/security-flight-policy-planning.json',JSON.stringify({scope:'Conditional fresh-memory first-flight planning, not browser or original acceptance.',contract:{seed:54124,day:1,money:0,difficulty:2,days:1,racing:1},results},null,2));
