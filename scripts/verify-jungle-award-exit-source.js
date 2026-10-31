import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/jungle-award-exit-source.json");
assert.equal(m.kind, "jungle-award-exit-static-source");
await originalGame();
await checkArtifacts(m.artifacts);
assert.deepEqual(
  [
    m.offset,
    m.length,
    m.originalOverlayFileOffset,
    m.originalOverlayHeaderBytes,
  ],
  [0xc170, 1201, 0x1fa00, 2048],
);
const exe = await readFile("game/DUCKTALE.EXE"),
  at = m.originalOverlayFileOffset,
  e = await readFile(m.analysisExecutable),
  h = e.readUInt16LE(8) * 16;
assert.equal(sha(e), m.analysisSha256);
assert.equal(exe.readUInt16LE(at), 0x5a4d);
assert.equal(exe.readUInt16LE(at + 8) * 16, 2048);
const original = exe.subarray(at + 2048, at + 2048 + m.length),
  b = Buffer.from(original);
assert.deepEqual(m.analysisNormalization, {
  offset: 6,
  original: "9a9e1e0e04",
  prepared: "81ecd40090",
});
assert.equal(
  b.subarray(6, 11).toString("hex"),
  m.analysisNormalization.original,
);
Buffer.from(m.analysisNormalization.prepared, "hex").copy(b, 6);
assert.deepEqual(e.subarray(h + m.offset, h + m.offset + m.length), b);
const found = [];
for (let n = 0; n < e.readUInt16LE(6); n++) {
  const p = e.readUInt16LE(24) + n * 4,
    offset = e.readUInt16LE(p) + 16 * e.readUInt16LE(p + 2);
  if (offset >= m.offset && offset + 2 <= m.offset + m.length) {
    found.push(offset);
    b.writeUInt16LE(
      (b.readUInt16LE(offset - m.offset) + 0x1000) & 65535,
      offset - m.offset,
    );
  }
}
assert.deepEqual(found, m.relocations);
const raw = await json(m.artifacts.ghidra.path);
assert.equal(raw.isError, false);
const g = JSON.parse(raw.content[0].text);
assert.equal(g.program, m.program);
assert.equal(g.address, m.address);
assert.equal(g.length, m.length);
assert.deepEqual(Buffer.from(g.hex, "hex"), b);
assert.equal(original.subarray(0x1e0, 0x1e4).toString("hex"), "ff1ee01f");
assert.equal(
  original.subarray(0x4a9, 0x4b1).toString("hex"),
  "a1ac1a5e8be55dcb",
);
console.log(
  `Jungle exit:${m.length} original/prepared/Ghidra bytes,${found.length} relocations,one declared stack-probe replacement;Main01e0 completes the striped clear before returning the treasure outcome. Static black incoming reward-page contract;not native timing parity.`,
);
