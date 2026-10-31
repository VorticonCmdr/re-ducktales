// Conditional component replay from original entry memory. Reader bytes are a
// separate explicit environment stream;native timing/BIOS/IRQ are not replayed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { Cave } from "../src/game/cave.js";
import { CAVE_SPRITES, parseCaveMaps } from "../src/game/cave-scene.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
const declaration=JSON.parse(await readFile("reference/cave-treasure-component.json"));
assert.equal(declaration.kind,"conditional-original-cave-treasure-comparison");
assert.equal(declaration.expectedReaderCalls,14);assert.equal(declaration.expectedTreasureCheckpoints,6);
assert.equal(declaration.expectedPortPublications,354);assert.equal(declaration.expectedCoreRanges,16);
assert.equal(declaration.negativeControls,3);
assert.equal(declaration.independentRuntimeAccepted,false);assert.equal(declaration.browserAccepted,false);assert.equal(declaration.nativeElapsedTimeAccepted,false);
const declared={};
for(const [name,a]of Object.entries(declaration.artifacts)) {
  const b=await readFile(a.path);assert.equal(b.length,a.bytes);assert.equal(createHash("sha256").update(b).digest("hex"),a.sha256);declared[name]=JSON.parse(b);
}
assert.deepEqual(Object.keys(declared).sort(),["inputs","native","parameters"]);
const m=declared.native,input=declared.inputs;
assert.equal(input.kind, "conditional-cave-treasure-reader-inputs");
assert.equal(input.requiredReads, 14);
assert.equal(input.events.length, 14);
async function artifact(name) {
  const a=m.artifacts[name], b=await readFile(a.path);
  assert.equal(b.length,a.bytes);
  assert.equal(createHash("sha256").update(b).digest("hex"),a.sha256);
  return JSON.parse(b);
}
function memory(snapshot) { return new FlightMemory(Buffer.from(snapshot.state.results[1].data,"base64")); }
const start=memory(await artifact("cave-entry.json"));
const contract=await artifact("cave-entry-contract.json");
assert.equal(contract.variant,1); assert.equal(contract.difficulty,0);
const reads=await Promise.all(Array.from({length:14},(_,i)=>artifact(`treasure-route-read-${i}.json`).then(memory)));
const labels=["before-wipe","after-background","before-first-reveal","before-second-flip","celebration-loop","treasure-end"];
const targets=Object.fromEntries(await Promise.all(labels.map(async label=>[label,memory(await artifact(`treasure-${label}.json`))])));
const {image,archives}=await originalGame();
const entries=archives.get("EXP.ARC"),font=archives.get("MAIN.ARC")[42].data;
const core=[[0x2229,2],[0x4d32,2],[0x97b0,2],[0x6810,2],[0x5a42,128],
  [0x8b54,1],[0x6d44,1],[0x5c74,1],[0x4e08,2],[0x54ac,2],[0x8b3e,2],
  [0x4e28,2],[0x546a,1],[0x8cc0,4],[0x5d2b,1],[0x8eb2,2]];
function compare(actual,expected,label) {
  const ids=[17,14,4,5,6,3,22,23,26,37,38,39,40,41,42,43,
    ...(label.startsWith("read")?[]:[44,45])];
  const ranges=[...core,[0x54fc,12],[0x550e,1],...ids.flatMap(id=>{const at=CAVE_SPRITES.get(id);return [[at,12],[at+18,1]];})];
  for(const [at,n] of ranges) assert.deepEqual(actual.bytes.slice(at,at+n),expected.bytes.slice(at,at+n),`${label}:DS${at.toString(16)}`);
}
function replay(events,CaveClass=Cave,onCheckpoint=()=>{}) {
  let cave,consumed=0,parties=0,presents=0,frames=0,lastPresentation=0;
  const seen=[];
  function checkpoint(label) { compare(cave.memory,targets[label],label);seen.push(label);onCheckpoint(label,cave.current,{entries,font}); }
  class Observed extends CaveClass {
    *wipe() { if(this.phase==="treasure") checkpoint("before-wipe");observe();for(const wait of super.wipe()){observe();yield wait;}observe(); }
    *loadWork(id) { yield* super.loadWork(id);if(this.phase==="treasure"&&id===0)checkpoint("after-background"); }
    *party(...args) {
      if(this.phase==="treasure") {if(parties===5)checkpoint("celebration-loop");parties++;}
      return yield* super.party(...args);
    }
    *present(...args) {
      const treasure=this.phase==="treasure";
      if(treasure) {presents++;if(presents===1)checkpoint("before-first-reveal");if(presents===2)checkpoint("before-second-flip");}
      for(const wait of super.present(...args)){observe();yield wait;}
      observe();
      if(treasure&&presents===15)checkpoint("treasure-end");
    }
  }
  cave=new Observed({image,entries,mapEntries:archives.get("CAVEMAPS.ARC"),maps:parseCaveMaps(archives.get("CAVEMAPS.ARC")),
    currentDrive:2,variant:contract.variant,difficulty:contract.difficulty,seed:contract.seed,money:contract.money,
    readInput:()=>{
      const e=events[consumed];assert.equal(e?.read,consumed,"Unfinished required reader input");
      compare(cave.memory,reads[consumed],`read${consumed}`);consumed++;return e.code;
    }},new FlightMemory(start.bytes));
  function observe() {
    if(cave && cave.presentations!==lastPresentation) {
      assert.equal(cave.presentations,lastPresentation+1,"Skipped cave publication");
      assert.equal(renderFlightPixels(cave.current,entries,font,"EXP.ARC").length,256000);
      lastPresentation=cave.presentations;frames++;
    }
  }
  for(let i=0;i<15000&&!cave.outcome;i++){cave.advanceTick();observe();cave.advanceRetrace();observe();}
  assert.equal(cave.outcome?.status,"treasure","Unfinished carried cave route");
  assert.equal(consumed,events.length,"Unconsumed required reader events");
  assert.equal(consumed,14);assert.equal(parties,15);assert.equal(presents,15);
  assert.deepEqual(seen,labels);assert.equal(frames,declaration.expectedPortPublications,"Unfinished/skipped publications");
  return {consumed,frames};
}
export function replayNativeTreasure(onCheckpoint) { return replay(input.events,Cave,onCheckpoint); }
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
const result=replay(input.events);
const old=execFileSync("git",["show","9232a42:src/game/cave-transitions.js"],{encoding:"utf8"});
const oldURL=`data:text/javascript;base64,${Buffer.from(old).toString("base64")}`;
const source=(await readFile("src/game/cave.js","utf8")).replace(/\bfrom\s+["'](\.[^"']+)["']/g,(all,spec)=>all.replace(spec,spec==="./cave-transitions.js"?oldURL:pathToFileURL(resolve("src/game",spec)).href));
const historical=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
assert.throws(()=>replay(input.events,historical.Cave),/before-wipe:DS(?:550e|78ba)/);
const missing=input.events.filter((_,i)=>i!==1).map((e,read)=>({...e,read}));
assert.throws(()=>replay(missing),/read2:DS/);
targets["treasure-end"].bytes[0x2229]^=1;
try {assert.throws(()=>replay(input.events),/treasure-end:DS2229/);}finally{targets["treasure-end"].bytes[0x2229]^=1;}

console.log(JSON.stringify({scope:"conditional-native-entry-reader-stream",...result,checkpoints:labels.length,readerCheckpoints:14,coreRanges:core.length,negativeControls:3}));

}
