// Conditional planning from the actual replayed campaign prefix. No browser or
// native memory is modified. A found stream still requires browser validation.
import fs from 'node:fs';import assert from 'node:assert/strict';
process.argv=['node','scripts/replay-hard-campaign.js','.local/security-campaign-mountain-prefix-06','--diagnose'];
const logs=[],logger=console.log;console.log=x=>logs.push(x);
const{game:g,clock}=await import('../scripts/replay-hard-campaign.js');console.log=logger;
assert.equal(g.scene,'departure');assert.equal(g.seed,11343);
let now=clock.now;
const effects=()=>g.drainEffects();
function step(){now+=8;clock.advanceTo(now);return effects();}
g.input({type:'controls',fire:true,direction:null});g.input({type:'fire'});
let lastRead=-1,lastPhase=null;
for(let n=0;n<20000 && g.scene==='flight';n++) {
 const f=g.flight.snapshot();
 if(['landing','complete'].includes(f.phase)){g.input({type:'controls',fire:false,direction:null});break;}
 if(f.phase!==lastPhase||g.flight.inputLog.length!==lastRead){
  const desired=f.tile>f.tiles-5?(f.y<135?15:0):f.y>65?2:f.y<50?15:0,delta=(desired-f.heading+16)%16;
  g.input({type:'controls',fire:true,direction:f.speed<4||!delta?null:delta<8?'down':'up'});
  lastRead=g.flight.inputLog.length;lastPhase=f.phase;
 }
 step();
}
for(let n=0;n<20000&&g.scene!=='mountain';n++)step();
assert.equal(g.scene,'mountain');assert.equal(g.flight.outcome.code,1);assert.equal(g.flight.outcome.frames,232);
const initial=g.snapshot();console.log('entry',JSON.stringify({seed:g.seed,briefing:g.briefing,day:g.campaign.day,mountain:initial.mountain}));
const declared=JSON.parse(fs.readFileSync('reference/hard-campaign-inputs.json')).mountain;
const stream=declared.inputEvents.flatMap(e=>Array(e.count).fill(e.byte));
let held=new Set(),actualHeld=new Set(),used=0;
function publish(){g.input({type:'controls',fire:actualHeld.has('Space'),direction:[...actualHeld].filter(k=>k!=='Space').at(-1)??null});}
for(const byte of stream){
 if(g.scene!=='mountain')break;
 const next=new Set([...(byte&64?['Space']:[]),...(({1:['up'],3:['right'],5:['down'],7:['left']}[byte&63])??[])]);
 for(const k of held)if(!next.has(k)){actualHeld.delete(k);publish();}
 for(const k of next)if(!held.has(k)){actualHeld.add(k);publish();}
 held=next;const before=g.mountain.inputs.length;
 for(let n=0;n<2000&&g.scene==='mountain'&&g.mountain.inputs.length===before;n++)for(const e of step())if(e.type==='flushControls')actualHeld.clear();
 assert.equal(g.mountain.inputs.length,before+1,'Unfinished conditional mountain input');used++;
}
for(let n=0;n<2000&&g.scene==='mountain';n++)step();
const result={scope:'Conditional carried port planning from16 exact prefix checkpoints and a modelled fourth flight; not actual browser acceptance.',initial,declaredInputs:stream.length,used,final:g.snapshot(),inputs:stream.slice(0,used)};
fs.writeFileSync('.local/security-mountain-ascent-planning.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({used,declared:stream.length,scene:g.scene,mountain:g.mountain.snapshot(),money:g.money,day:g.campaign.day}));
