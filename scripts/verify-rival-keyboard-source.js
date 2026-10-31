import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/rival-keyboard-source.json"),
  parent = await json("reference/rival-input-source.json");
assert.equal(m.kind, "rival-keyboard-static-source");
assert.equal(m.program, "INVESTMENT_CODE.EXE");
assert.equal(m.address, "1124:00bb");
assert.equal(m.offset, 0x12fb);
assert.equal(m.length, 282);
const { image } = await originalGame(),
  original = Buffer.from(image.subarray(m.offset, m.offset + m.length));
assert.equal(sha(original), m.sha256);
await checkArtifacts({ ghidra: m.artifact });
const exe = await readFile(parent.analysisExecutable);
assert.equal(sha(exe), parent.analysisSha256);
const header = exe.readUInt16LE(8) * 16,
  prepared = Buffer.from(
    exe.subarray(header + m.offset, header + m.offset + m.length),
  );
assert.deepEqual(prepared, original);
const relocations = [];
for (let i = 0; i < exe.readUInt16LE(6); i++) {
  const p = exe.readUInt16LE(24) + 4 * i,
    at = exe.readUInt16LE(p) + 16 * exe.readUInt16LE(p + 2);
  if (at >= m.offset && at + 2 <= m.offset + m.length) {
    relocations.push(at);
    prepared.writeUInt16LE(
      (prepared.readUInt16LE(at - m.offset) + 4096) & 65535,
      at - m.offset,
    );
  }
}
assert.deepEqual(relocations, m.relocations);
assert.deepEqual(
  [...relocations].sort((a, b) => a - b),
  [0x133d, 0x13d5],
);
const g = await json(m.artifact.path);
assert.equal(g.address, m.address);
assert.equal(g.program, m.program);
assert.equal(g.length, m.length);
assert.deepEqual(prepared, Buffer.from(g.hex, "hex"));
assert.equal(
  Buffer.from(image.subarray(0x133a, 0x133f)).toString("hex"),
  "9aa702c401",
);
assert.equal(
  Buffer.from(image.subarray(0x13d2, 0x13d7)).toString("hex"),
  "9a7f04c401",
);
console.log(
  "Rival busy-reader keyboard:282 original/Ghidra bytes,two relocations;default P/Q handlers are inside1124:0002 and S is consumed there too. General S-off click/IRQ adaptation remains separate.",
);
