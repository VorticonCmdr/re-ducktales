// One fixed native completed-reveal page. No alignment search or pixel mask.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import { replayNativeTreasure } from "./compare-cave-treasure-observation.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
const m=JSON.parse(await readFile("reference/cave-treasure-pixels.json"));
assert.equal(m.kind,"conditional-original-cave-treasure-pixels");
assert.equal(m.checkpoint,"before-second-flip");assert.equal(m.sourceOffset,0x1770);
assert.equal(m.expectedFrames,1);assert.equal(m.expectedPortPublications,354);assert.equal(m.negativeControls,2);
assert.equal(m.nativeElapsedTimeAcceptance,false);assert.equal(m.browserAcceptance,false);
const sha=b=>createHash("sha256").update(b).digest("hex");
async function artifact(a){const b=await readFile(a.path);assert.equal(b.length,a.bytes);assert.equal(sha(b),a.sha256);return b;}
await artifact(m.parent);await artifact(m.native);await artifact(m.revealSource);
execFileSync("python3",["scripts/verify_cave_entry_transition_source.py"],{env:{...process.env,PYTHONDONTWRITEBYTECODE:"1"},stdio:"inherit"});
const target=PNG.sync.read(await artifact(m.target));
assert.deepEqual([target.width,target.height],[m.expectedWidth,m.expectedHeight]);
assert.deepEqual([m.expectedWidth,m.expectedHeight,m.expectedRGBABytes],[320,200,256000]);
assert.equal(target.data.length,m.expectedRGBABytes);assert.equal(sha(target.data),m.expectedRGBASHA256);
assert.ok(target.data.some((v,i)=>i%4!==3&&v!==0),"Blank native target");
function pixels(actual,expected){assert.deepEqual(Buffer.from(actual),Buffer.from(expected),"Native treasure pixel divergence");}
function count(n){assert.equal(n,1,"Missing native pixel checkpoint");}
let compared=0,actual;
const result=replayNativeTreasure((label,commands,{entries,font})=>{
  if(label!==m.checkpoint)return;
  assert.equal(compared,0,"Repeated native pixel checkpoint");
  actual=renderFlightPixels(commands,entries,font,"EXP.ARC");
  pixels(actual,target.data);compared++;
});
count(compared);assert.equal(result.frames,354);
const wrong=Uint8Array.from(target.data);wrong[1000]^=1;
assert.throws(()=>pixels(actual,wrong),/Native treasure pixel divergence/);
assert.throws(()=>count(0),/Missing native pixel checkpoint/);
console.log("Cave native pixels:one fixed1770 completed-reveal page,all64000 pixels/256000 RGBA bytes exact;354 carried port publications render;2 negatives. Conditional capture alignment,not whole-ending scanout/timing or browser acceptance.");
