import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/cave-audio-source.json");
assert.equal(m.kind, "cave-audio-static-source");
await originalGame();
await checkArtifacts({ build: m.build });
const exe = await readFile("game/DUCKTALE.EXE"),
  o = m.overlay,
  overlay = exe.subarray(o.fileOffset, o.fileOffset + o.bytes);
assert.equal(sha(overlay), o.sha256);
assert.equal(overlay.readUInt16LE(26), 6);
assert.equal(o.imageOffset, 0xc170);
assert.equal(overlay.readUInt16LE(8) * 16, o.headerBytes);
const prepared = await readFile(m.analysisExecutable);
assert.equal(sha(prepared), m.analysisSha256);
const header = prepared.readUInt16LE(8) * 16;
assert.equal(m.ranges.length, 3);
for (const [i, expected] of [
  [0, [0x125f, 13, "ff1e28200bc07503e92a06ebf3"]],
  [1, [0x16a7, 13, "ff1e28200bc07503e9e201ebf3"]],
  [2, [0x188c, 25, "ff1e28200bc075f8803ebe0300740a2bc050ff1e1c2083c402"]],
]) {
  const r = m.ranges[i];
  assert.deepEqual([r.offset, r.length], expected.slice(0, 2));
  await checkArtifacts({ ghidra: r.artifact });
  const original = Buffer.from(
    overlay.subarray(
      o.headerBytes + r.offset,
      o.headerBytes + r.offset + r.length,
    ),
  );
  assert.equal(sha(original), r.sha256);
  assert.equal(original.toString("hex"), expected[2]);
  for (const binary of [overlay, prepared]) {
    const relocations = [];
    for (let n = 0; n < binary.readUInt16LE(6); n++) {
      const p = binary.readUInt16LE(24) + n * 4,
        at = binary.readUInt16LE(p) + 16 * binary.readUInt16LE(p + 2);
      if (
        at >= o.imageOffset + r.offset &&
        at + 2 <= o.imageOffset + r.offset + r.length
      )
        relocations.push(at);
    }
    assert.deepEqual(relocations, [], "Unexpected terminal-loop relocation");
  }
  assert.deepEqual(
    prepared.subarray(
      header + o.imageOffset + r.offset,
      header + o.imageOffset + r.offset + r.length,
    ),
    original,
  );
  const raw = await json(r.artifact.path);
  assert.equal(raw.isError, false);
  const gh = JSON.parse(raw.content[0].text);
  assert.equal(gh.program, m.program);
  assert.equal(gh.address, r.address);
  assert.equal(gh.length, r.length);
  assert.deepEqual(Buffer.from(gh.hex, "hex"), original);
}
console.log(
  "Cave audio:51 original/prepared/Ghidra bytes;three untimed global-status loops,common enabled0 exit. Static instruction evidence;native latency and browser acceptance are separate checks.",
);
