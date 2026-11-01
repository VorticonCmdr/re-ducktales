// Byte-checked original clear loops and their required payload work.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { originalGame } from '../tests/helpers/original-game.js';
import { allocationPayloadClearWork } from '../src/game/allocation-clear-work.js';
import { graphicsLoadWork,byteLoadWork } from '../src/game/graphics-load-work.js';
const m=JSON.parse(await readFile('reference/allocation-clear-work.json'));
assert.equal(m.kind,'original-required-allocation-payload-clear');
assert.equal(m.nativeTimingAcceptance,false);assert.equal(m.expectedResources,55);
const hash=b=>createHash('sha256').update(b).digest('hex');
const {image,archives}=await originalGame(),exe=await readFile('game/DUCKTALE.EXE');
const relocated=Buffer.from(image);
let cursor=exe.readUInt16LE(8)*16+exe.readUInt16LE(22)*16+0x125;
for(let region=0;region<16;region++) {
  const count=exe.readUInt16LE(cursor);cursor+=2;
  for(let i=0;i<count;i++,cursor+=2) {
    const p=region*65536+exe.readUInt16LE(cursor);
    relocated.writeUInt16LE((relocated.readUInt16LE(p)+0x1000)&65535,p);
  }
}
const code=new Map();let instructionCount=0,byteCount=0;
for(const[name,[lo,hi]]of Object.entries(m.ranges)) {
  const spec=m.source[name],b=await readFile(spec.path);
  assert.equal(b.length,spec.bytes);assert.equal(hash(b),spec.sha256);
  const d=JSON.parse(JSON.parse(b).content[0].text);
  assert.equal(d.success,true);assert.equal(d.truncated,false);assert.equal(d.program,'CAVE_CODE.EXE');
  let at=lo;
  for(const i of d.instructions) {
    const offset=parseInt(i.address.split(':')[1],16);
    if(offset<lo||offset>=hi)continue;
    assert.equal(offset,at,'Missing original allocation instruction');
    const raw=Buffer.from(i.bytes,'hex');assert.equal(raw.length,i.length);
    assert.deepEqual(raw,relocated.subarray(0x40e0+at,0x40e0+at+raw.length));
    code.set(at,i.bytes);at+=raw.length;instructionCount++;byteCount+=raw.length;
  }
  assert.equal(at,hi);
}
assert.equal(instructionCount,m.expectedSourceInstructions);assert.equal(instructionCount,360);
assert.equal(byteCount,m.expectedSourceBytes);assert.equal(byteCount,862);
// Original bytes resolve misleading Ghidra segment-register operand text.
for(const[at,bytes]of [[0x478,'8bf8'],[0x482,'d1e9'],[0x484,'f2ab'],[0x486,'13c9'],[0x488,'f2aa'],[0x40e9,'8bcb'],[0x40eb,'d1e1'],[0x40ed,'d1e1'],[0x40ef,'d1e1'],[0x40f5,'f3ab']])
  assert.equal(code.get(at),bytes,`Original clear operation ${at.toString(16)}`);
assert.equal(code.get(0x47e),'8ec2'); //MOV ES,DX;zeroing destination is DS near storage.
assert.equal(code.get(0x40dd),'8ec0'); //MOV ES,AX;DOS-allocated far segment.
let cases=0;
for(const archive of ['EXP.ARC','CAVEMAPS.ARC'])for(const entry of archives.get(archive)) {
  if(![1,2,4].includes(entry.type))continue;
  const bytes=entry.type===4?entry.data.length:entry.width/8*entry.height*entry.frames*(entry.type===2?5:4);
  // Derive both source paths independently. Near ADC retains SHR's odd carry;
  // far DOS allocation rounds bytes upward to paragraphs,then clears8 words each.
  const near=(bytes>>>1)+(bytes&1),far=Math.ceil(bytes/16)*8;
  const clear=allocationPayloadClearWork(bytes);
  assert.equal(clear.repeatIterations,near);assert.ok(clear.repeatIterations<=far);
  assert.equal(clear.instructions-clear.repeatOpcodes,0);
  const work=entry.type===4?byteLoadWork(entry):graphicsLoadWork(entry);
  assert.equal(work.clearedPayloadBytes,bytes);
  assert.ok(work.repeatIterations>=near,'Required allocation clear was omitted');
  cases++;
}
assert.equal(cases,55);
for(const example of Object.values(m.nativeExamples)) {
  const parentBytes=await readFile(example.path);
  assert.equal(parentBytes.length,example.bytes);assert.equal(hash(parentBytes),example.sha256);
  const parent=JSON.parse(parentBytes);
  const spec=parent.artifacts['cave-loader-payload.json'],b=await readFile(spec.path);
  assert.equal(b.length,spec.bytes);assert.equal(hash(b),spec.sha256);
  const capture=JSON.parse(b),payload=Buffer.from(capture.read.results[0].data,'base64');
  assert.equal(payload.length,example.payloadBytes);assert.equal(payload.length%16,0);
  assert.equal(allocationPayloadClearWork(payload.length).repeatIterations,example.wordStores);
}
let negatives=0;
assert.throws(()=>assert.equal(code.get(0x484),'f2aa'));negatives++;
const sprite=graphicsLoadWork(archives.get('EXP.ARC')[10]);
assert.throws(()=>assert.ok(sprite.repeatIterations-19040>=19040));negatives++;
for(const size of [0,65536,1.5]){assert.throws(()=>allocationPayloadClearWork(size));negatives++;}
assert.equal(negatives,5);
console.log(`Original allocation clear:${instructionCount} instructions/${byteCount} bytes;55 payloads;2 native aligned sizes;5 negatives. Padding/allocator/whole-call timing remain excluded.`);
