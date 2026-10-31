import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json(
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
    "reference/cave-audio-calls-source.json",
);
assert.equal(m.kind, "cave-audio-calls-static-source");
await originalGame();
await checkArtifacts({ build: m.build });
const exe = await readFile("game/DUCKTALE.EXE"),
  o = m.overlay,
  overlay = exe.subarray(o.fileOffset, o.fileOffset + o.bytes),
  prepared = await readFile(m.analysisExecutable),
  header = prepared.readUInt16LE(8) * 16;
assert.equal(sha(overlay), o.sha256);
assert.equal(sha(prepared), m.analysisSha256);
assert.equal(o.imageOffset, 0xc170);
const offsets = [
  0x46f, 0x6a7, 0x985, 0xa1d, 0xd2f, 0xd8d, 0xee4, 0xf76, 0x1008, 0x1144,
  0x148f, 0x14de, 0x15f6, 0x17c7, 0x1894, 0x1aa0, 0x260a, 0x285d, 0x2adf,
  0x1adc, 0x59d, 0x5ed, 0x2857, 0x2881,
];
assert.deepEqual(
  m.ranges.map((r) => r.offset),
  offsets,
);
assert.ok(m.distanceOrigin, "Missing cave distance-origin evidence");
assert.deepEqual(
  [m.distanceOrigin.offset, m.distanceOrigin.length],
  [0x4ab, 18],
);
let bytes = 0;
for (const r of [...m.ranges, m.distanceOrigin]) {
  await checkArtifacts({ ghidra: r.artifact });
  const b = overlay.subarray(
    o.headerBytes + r.offset,
    o.headerBytes + r.offset + r.length,
  );
  assert.equal(b.length, r.length);
  assert.equal(sha(b), r.sha256);
  assert.deepEqual(
    prepared.subarray(
      header + o.imageOffset + r.offset,
      header + o.imageOffset + r.offset + r.length,
    ),
    b,
  );
  const result = await json(r.artifact.path);
  assert.equal(result.isError, false);
  const gh = JSON.parse(result.content[0].text);
  assert.equal(gh.program, m.program);
  assert.equal(gh.address, r.address);
  assert.equal(gh.length, r.length);
  assert.deepEqual(Buffer.from(gh.hex, "hex"), b);
  if (r.name.startsWith("guard-")) {
    assert.equal(b.subarray(0, 5).toString("hex"), "803ebe0300");
    assert.ok(b.includes(Buffer.from("ff1e1c20", "hex")));
  }
  // No relocation normalization or comparison exclusions in these snippets.
  for (const binary of [overlay, prepared]) {
    for (let n = 0; n < binary.readUInt16LE(6); n++) {
      const at = binary.readUInt16LE(24) + n * 4,
        location = binary.readUInt16LE(at) + 16 * binary.readUInt16LE(at + 2),
        base = binary === overlay ? 0 : o.imageOffset;
      assert.ok(
        location + 2 <= base + r.offset ||
          location >= base + r.offset + r.length,
        "Unexpected relocation in cave source range",
      );
    }
  }
  bytes += r.length;
}
console.log(
  `Cave audio calls: ${m.ranges.length + 1} ranges/${bytes} bytes match original, prepared image and Ghidra; guarded calls, one audible entry, signed treasure proximity/pit priority. Static evidence only.`,
);
