import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/bank-sparkle-copy-source.json");
assert.equal(m.kind, "bank-sparkle-copy-static-source");
assert.deepEqual(
  [m.originalOverlay, m.headerBytes, m.offset, m.length, m.analysisBody],
  [72704, 512, 0xc1d, 160, 0xc170],
);
await originalGame();
await checkArtifacts(m.artifacts);
const exe = await readFile("game/DUCKTALE.EXE"),
  e = await readFile(m.analysisExecutable);
assert.equal(sha(e), m.analysisSha256);
const raw = exe.subarray(
    m.originalOverlay + m.headerBytes + m.offset,
    m.originalOverlay + m.headerBytes + m.offset + m.length,
  ),
  at = m.analysisBody + m.offset,
  h = e.readUInt16LE(8) * 16;
assert.equal(sha(raw), m.originalSha256);
assert.deepEqual(e.subarray(h + at, h + at + m.length), raw);
const relocated = Buffer.from(raw),
  relocations = [];
for (let i = 0; i < e.readUInt16LE(6); i++) {
  const q = e.readUInt16LE(24) + i * 4,
    p = e.readUInt16LE(q) + 16 * e.readUInt16LE(q + 2);
  if (p >= at && p + 2 <= at + m.length) {
    relocations.push(p);
    relocated.writeUInt16LE(
      (relocated.readUInt16LE(p - at) + 0x1000) & 65535,
      p - at,
    );
  }
}
assert.deepEqual(relocations, m.relocations);
const packet = await json(m.artifacts.ghidra.path);
assert.equal(packet.isError, false);
const g = JSON.parse(packet.content[0].text);
assert.equal(g.program, "BANK_CODE.EXE");
assert.equal(g.address, "1c17:0c1d");
assert.equal(g.length, 160);
assert.deepEqual(Buffer.from(g.hex, "hex"), relocated);
assert.ok(
  raw.includes(Buffer.from("b8200050b8120050ff1eec1f", "hex")),
  "Missing original32x18 copy call",
);
const p = spawnSync(process.execPath, ["scripts/verify-ega-signed-copies.js"], {
  encoding: "utf8",
});
assert.equal(p.status, 0, p.stdout + p.stderr);
console.log(
  "Bank sparkle source:160 original/prepared/Ghidra bytes,signed Y passed identically to the32x18 background copy;native-validated original signed EGA primitive rules. Visible projection is statically inferred,not a new native screenshot or hidden-memory aliasing comparison.",
);
