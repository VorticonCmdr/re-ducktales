// Compare actual passage coroutine arguments to original bounded call paths.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { caveTransition } from "../src/game/cave-transitions.js";
execFileSync("python3",["scripts/verify_cave_passage_parameters.py"],{env:{...process.env,PYTHONDONTWRITEBYTECODE:"1"},stdio:"inherit"});
const m=JSON.parse(await readFile("reference/cave-passage-parameters.json"));
const {image}=await originalGame();
function exercise(transition) {
  let cases=0;
  for(const c of m.cases) {
    const bytes=new Uint8Array(65536);bytes.set(image.subarray(0x120e0));
    const memory=new FlightMemory(bytes),seen=[],loads=[];
    let normal=0;
    const host={memory,cell:16,back:()=>[],restoreBackground:()=>[],sound:()=>{},
      *load(id){loads.push(id);},*draw(){},*present(){},
      *party(commands,options){if(options)seen.push({options:{...options},x:memory.i(0x54fc),y:memory.i(0x54fe),frame:memory.b(0x550e)});else normal++;return commands;}};
    for(const wait of transition.call(host,c.stage,c.direction))throw Error("Unexpected stubbed passage wait");
    assert.equal(loads[0],c.asset,"Passage asset");assert.equal(seen.length,c.count,"Passage count");
    assert.equal(normal,c.stage==="entry"?4:0,"Passage post-animation calls");
    for(const [i,s]of seen.entries()) {
      const pose=(c.pose+i)%4;
      assert.deepEqual(s.options,{asset:c.asset,kind:c.kind,pose},"Passage arguments");
      assert.equal(s.frame,pose,"Passage pose");
      assert.equal(s.x,memory.i(c.table+i*4));assert.equal(s.y,memory.i(c.table+i*4+2));
    }
    cases++;
  }
  assert.equal(cases,8);return cases;
}
const cases=exercise(caveTransition);
const old=execFileSync("git",["show","9232a42:src/game/cave-transitions.js"],{encoding:"utf8"});
const historical=await import(`data:text/javascript;base64,${Buffer.from(old).toString("base64")}`);
assert.throws(()=>exercise(historical.caveTransition),/Passage arguments|Passage pose/);
console.log(`Passage parameters:${cases} actual coroutine paths match original asset/kind/table/count/pose;historical parameter negative rejected. Conditional call-argument check,not native intermediate pixels/timing.`);
