import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json(
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
    "reference/award-presentation-source.json",
);
assert.equal(m.kind, "award-presentation-static-source");
await checkArtifacts({
  build: m.build,
  graphics: m.graphicsProof,
  rows: m.rowAlgorithm,
});
const { image, archives } = await originalGame();
const e = await readFile(m.analysisExecutable),
  h = e.readUInt16LE(8) * 16;
assert.equal(sha(e), m.analysisSha256);
assert.deepEqual(
  m.ranges.map((r) => [r.offset, r.length]),
  [
    [0xb39, 271],
    [0x1c53, 38],
    [0x1cff, 55],
    [0x1d9b, 2],
    [0x1dad, 5],
    [0x5a85, 32],
  ],
);
let bytes = 0,
  relocations = 0;
for (const r of m.ranges) {
  const b = Buffer.from(image.subarray(r.offset, r.offset + r.length));
  assert.equal(sha(b), r.sha256);
  assert.deepEqual(e.subarray(h + r.offset, h + r.offset + r.length), b);
  const found = [];
  for (let n = 0; n < e.readUInt16LE(6); n++) {
    const at = e.readUInt16LE(24) + 4 * n,
      offset = e.readUInt16LE(at) + 16 * e.readUInt16LE(at + 2);
    if (offset >= r.offset && offset + 2 <= r.offset + r.length) {
      found.push(offset);
      b.writeUInt16LE(
        (b.readUInt16LE(offset - r.offset) + 0x1000) & 65535,
        offset - r.offset,
      );
    }
  }
  assert.deepEqual(found, r.relocations);
  await checkArtifacts({ ghidra: r.artifact });
  const raw = await json(r.artifact.path);
  assert.equal(raw.isError, false);
  const g = JSON.parse(raw.content[0].text);
  assert.equal(g.program, m.program);
  assert.equal(g.address, r.address);
  assert.equal(g.length, r.length);
  assert.deepEqual(Buffer.from(g.hex, "hex"), b);
  bytes += r.length;
  relocations += found.length;
}
assert.equal(
  Buffer.from(image.subarray(0x1d9b, 0x1d9d)).toString("hex"),
  "bf00",
);
assert.equal(
  Buffer.from(image.subarray(0xc2e, 0xc36)).toString("hex"),
  "ff1ee01fff1edc1f",
);
assert.equal(
  Buffer.from(image.subarray(0x1c75, 0x1c79)).toString("hex"),
  "ff1ee01f",
);
assert.equal(
  Buffer.from(image.subarray(0xc36, 0xc48)).toString("hex"),
  "803ebe0300740bb8490050ff1e1c2083c402",
);
const driver = (await json(m.rowAlgorithm.path)).graphics;
assert.equal(
  Buffer.from(image.subarray(0x5a85, 0x5aa5)).toString("hex"),
  "57fab840008ec026a11c0026a31a008cd88ec0bf6c27b9400033c0f3abfb5fcb",
);
assert.equal(sha(archives.get("IT.DRV")[1].data), driver.sha256);
assert.equal(archives.get("MAIN.ARC")[35].width, 320);
assert.equal(archives.get("MAIN.ARC")[35].height, 200);
console.log(
  `Award presentation: ${bytes} original/prepared/Ghidra bytes,${relocations} loader relocations;picture6/MAIN35,helper wipe then caller wipe/reveal,enabled49 before40-read wait.75 retraces follow the pinned EGA row algorithm;not native uninterrupted timing parity.`,
);
