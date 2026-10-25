import test from 'node:test';
import assert from 'node:assert/strict';
import { decompressLzw, parseArchive, imagePixels, EGA, fontPixels } from '../src/assets.js';
import { wavFile, renderSound } from '../src/audio.js';
function pack9(codes) {
  let bits = 0, n = 0; const bytes = [];
  for (const code of codes) { bits |= code << n; n += 9; while (n >= 8) { bytes.push(bits & 255); bits >>>= 8; n -= 8; } }
  if (n) bytes.push(bits); return Uint8Array.from(bytes);
}
test('LZW clear, dictionary reference, KwKwK and end codes', () => {
  assert.deepEqual([...decompressLzw(pack9([256,65,66,258,260,257]),7)], [65,66,65,66,65,66,65]);
  assert.deepEqual([...decompressLzw(pack9([256,65,256,66,257]),2)], [65,66]);
});
test('reject corrupt streams instead of drawing partial images', () => {
  assert.throws(()=>decompressLzw(pack9([256,300,257]),1),/Invalid/);
  assert.throws(()=>decompressLzw(pack9([256,65,257]),2),/Decoded size/);
  assert.throws(()=>decompressLzw(pack9([256,65,66,257]),1),/overflow/);
  assert.throws(()=>decompressLzw(Uint8Array.of(0),1),/Truncated/);
});
test('archive directory and packed payload boundaries', () => {
  assert.throws(()=>parseArchive(Uint8Array.of(1,0)),/directory/);
  const payload = pack9([256,65,257]), bytes = new Uint8Array(22+payload.length), v = new DataView(bytes.buffer);
  v.setUint16(0,1,true); v.setUint32(2,6,true); v.setUint32(6,payload.length,true); v.setUint16(10,4,true); v.setUint16(12,1,true); bytes.set(payload,22);
  assert.equal(parseArchive(bytes,'test.arc')[0].data[0],65);
  v.setUint32(6,100,true); assert.throws(()=>parseArchive(bytes),/header/);
});
test('sprite frames are horizontal strips, high nibble first', () => {
  const entry = {type:2,width:2,height:2,frames:2,data:Uint8Array.of(0x12,0x34,0x56,0x78)};
  const pixels = imagePixels(entry,1,7);
  assert.deepEqual([...pixels.slice(0,4)],[...EGA[3],255]);
  assert.deepEqual([...pixels.slice(8,12)],[...EGA[7],0]);
  assert.deepEqual([...pixels.slice(12,16)],[...EGA[8],255]);
  assert.throws(()=>imagePixels(entry,2),/range/);
});
test('font uses 8-byte header and MSB-first glyph rows', () => {
  const data = new Uint8Array(2056); data[8] = 128;
  const rgba = fontPixels(data); assert.equal(rgba[0],245); assert.equal(rgba[4],16);
});
test('WAV has consistent mono PCM sizes', () => {
  const bytes = wavFile({pcm:Float32Array.of(-1,0,1),sampleRate:22050}), view=new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF'); assert.equal(view.getUint32(4,true),42);
  assert.equal(view.getUint32(40,true),6); assert.equal(view.getInt16(44,true),-32767); assert.equal(view.getInt16(48,true),32767);
});
test('audio interpreter bounds looping input and rejects unknown driver', () => {
  assert.throws(()=>renderSound(new Uint8Array(10),0),/Unsupported/);
  const driver=new Uint8Array(7253); driver[0x92b]=0; driver[0x92c]=0x10;
  driver.set([0,0xa0,1,0x84,1,0x10],0x1000);
  assert.equal(renderSound(driver,0,{seconds:1}).truncated,true);
  driver.set([0,0x84,1,0x10],0x1000);
  assert.throws(()=>renderSound(driver,0),/no wait/);
});
