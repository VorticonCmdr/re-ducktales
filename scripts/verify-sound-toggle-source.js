import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/sound-toggle-source.json"),
  { image, archives } = await originalGame();
assert.equal(m.kind, "sound-toggle-static-source");
assert.equal(m.program, "INVESTMENT_CODE.EXE");
await checkArtifacts({ build: m.build, ghidra: m.artifact });
assert.equal(m.offset, 0x13da);
assert.equal(m.length, 59);
const original = Buffer.from(image.subarray(m.offset, m.offset + m.length));
assert.equal(sha(original), m.sha256);
const exe = await readFile(m.analysisExecutable);
assert.equal(sha(exe), m.analysisSha256);
const header = exe.readUInt16LE(8) * 16,
  prepared = exe.subarray(header + m.offset, header + m.offset + m.length);
assert.deepEqual(prepared, original, "Undeclared analysis edit");
const relocations = [];
for (let i = 0; i < exe.readUInt16LE(6); i++) {
  const p = exe.readUInt16LE(24) + 4 * i,
    at = exe.readUInt16LE(p) + 16 * exe.readUInt16LE(p + 2);
  if (at >= m.offset && at + 2 <= m.offset + m.length) relocations.push(at);
}
assert.deepEqual(relocations, []);
assert.deepEqual(m.relocations, []);
const g = await json(m.artifact.path);
assert.equal(g.program, m.program);
assert.equal(g.address, m.address);
assert.equal(g.length, 59);
assert.deepEqual(Buffer.from(g.hex, "hex"), original);
assert.equal(
  original.toString("hex"),
  "803ebe03007425740a2bc050ff1e1c2083c402803ebe0300740bb8240050ff1e1c2083c402c606be0300eb0fc606be03012bc050ff1e1c2083c402",
);
const bytes = Buffer.from(archives.get("IT.DRV")[5].data);
assert.equal(bytes[bytes.readUInt16LE(0x92b)], 16);
assert.equal(bytes[bytes.readUInt16LE(0x92b + 0x24 * 2)], 0);
console.log(
  "Sound toggle:59 original/Ghidra bytes,no relocations;off0→24→clear03be,on set03be→0;original speaker priorities16/0. Zero-inserted-IRQ composition is conditional,not recovered native CPU/PIT phase.",
);
