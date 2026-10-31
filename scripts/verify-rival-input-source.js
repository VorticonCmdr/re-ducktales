import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/rival-input-source.json"),
  { image } = await originalGame();
assert.equal(m.kind, "rival-input-static-source");
assert.equal(m.program, "INVESTMENT_CODE.EXE");
const exe = await readFile(m.analysisExecutable);
assert.equal(sha(exe), m.analysisSha256);
const header = exe.readUInt16LE(8) * 16;
assert.equal(m.ranges.length, 2);
assert.deepEqual(
  m.ranges.map((r) => [r.offset, r.length]),
  [
    [0x2927, 148],
    [0x29d2, 6],
  ],
);
assert.deepEqual(
  [...m.ranges[0].relocations].sort((a, b) => a - b),
  [0x2940, 0x2952, 0x296a, 0x29a3, 0x29af],
);
for (const r of m.ranges) {
  await checkArtifacts({ ghidra: r.artifact });
  const original = Buffer.from(image.subarray(r.offset, r.offset + r.length));
  assert.equal(sha(original), r.sha256);
  const prepared = Buffer.from(
    exe.subarray(header + r.offset, header + r.offset + r.length),
  );
  assert.deepEqual(prepared, original, "Unexpected analysis edits");
  const relocations = [];
  for (let i = 0; i < exe.readUInt16LE(6); i++) {
    const at = exe.readUInt16LE(24) + 4 * i,
      where = exe.readUInt16LE(at) + 16 * exe.readUInt16LE(at + 2);
    if (where >= r.offset && where + 2 <= r.offset + r.length) {
      relocations.push(where);
      prepared.writeUInt16LE(
        (prepared.readUInt16LE(where - r.offset) + 4096) & 65535,
        where - r.offset,
      );
    }
  }
  assert.deepEqual(relocations, r.relocations);
  const g = await json(r.artifact.path);
  assert.equal(g.program, m.program);
  assert.equal(g.address, r.address);
  assert.equal(g.length, r.length);
  assert.deepEqual(prepared, Buffer.from(g.hex, "hex"));
}
for (const [at, hex] of [
  [0x2927, "803ebe0300740bb86e0050ff1e1c2083c402"],
  [0x2947, "ff1e28200bc0740e"],
  [0x2963, "b82800509af509c401"],
  [0x2985, "ff1ee01f803ebe03007442b8210050ff1e1c2083c402"],
  [0x29d2, "a08e35a28105"],
])
  assert.equal(
    Buffer.from(image.subarray(at, at + hex.length / 2)).toString("hex"),
    hex,
    "Original rule " + at.toString(16),
  );
console.log(
  "Rival input source:154 original/Ghidra bytes,declared relocations;enabled6e,raw busy loop,fallback40,conditional24,enabled21 and deferred location. Static evidence only.",
);
