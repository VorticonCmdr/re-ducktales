// Source and presentation-mechanism checks, not a native whole-cave replay.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { Cave } from "../src/game/cave.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

const original = await originalGame(); // Requires all22 original identities.
const exe = await readFile("game/DUCKTALE.EXE");
const mzSize = (b, at) =>
  (b.readUInt16LE(at + 4) - 1) * 512 + (b.readUInt16LE(at + 2) || 512);
let at = Math.ceil(mzSize(exe, 0) / 512) * 512;
let overlay;
while (at < exe.length) {
  assert.equal(exe.readUInt16LE(at), 0x5a4d, "Missing overlay header");
  const size = mzSize(exe, at);
  assert.ok(size > 0 && at + size <= exe.length, "Truncated overlay");
  if (exe.readUInt16LE(at + 26) === 6) {
    assert.equal(overlay, undefined, "Duplicate cave overlay");
    overlay = exe.subarray(at + exe.readUInt16LE(at + 8) * 16, at + size);
  }
  at = Math.ceil((at + size) / 512) * 512;
}
assert.ok(overlay, "Missing cave overlay");
const manifest = JSON.parse(
  await readFile(
    process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
      "reference/cave-reveal.json",
    "utf8",
  ),
);
if (manifest.parentContract) {
  const bytes = await readFile(manifest.parentContract.path);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    manifest.parentContract.sha256,
  );
  const parent = JSON.parse(bytes);
  for (const key of Object.keys(parent))
    if (!["id", "sources"].includes(key))
      assert.deepEqual(
        manifest[key],
        parent[key],
        "Changed original cave expectation " + key,
      );
  assert.equal(manifest.sources.length, parent.sources.length);
  for (let i = 0; i < parent.sources.length; i++) {
    const old = parent.sources[i],
      current = manifest.sources[i];
    assert.equal(current.path, old.path);
    if (old.path === "tests/browser/campaign.spec.js") {
      const text = await readFile(current.path, "utf8");
      assert.equal(text.split('page.goto("/?bios-seed=0")').length - 1, 2);
      const normalized = Buffer.from(
        text.replaceAll('page.goto("/?bios-seed=0")', 'page.goto("/")'),
      );
      assert.equal(normalized.length, old.bytes);
      assert.equal(
        createHash("sha256").update(normalized).digest("hex"),
        old.sha256,
        "Changed cave browser behavior beyond explicit historical BIOS input",
      );
    } else if (old.path !== "scripts/verify-cave-reveal.js")
      assert.deepEqual(current, old, "Changed native cave source contract");
  }
}
assert.equal(manifest.expectedSourceInstructions, 78);
assert.equal(manifest.expectedSourceBytes, 186);
assert.equal(manifest.expectedGroups, 5);
assert.equal(manifest.expectedRetraces, 25);
assert.deepEqual(manifest.injections, []);
assert.deepEqual(manifest.fittedInputs, []);
const checked = async (entry) => {
  const bytes = await readFile(entry.path).catch(() => {
    throw Error(`SETUP: missing ${entry.path}; see docs/cave-reveal.md`);
  });
  assert.equal(bytes.length, entry.bytes, `Corrupt evidence ${entry.path}`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    entry.sha256,
    `Corrupt evidence ${entry.path}`,
  );
  return bytes;
};
for (const entry of manifest.sources) await checked(entry);
assert.equal(
  overlay.subarray(0x173d, 0x1741).toString("hex"),
  "ff1edc1f",
  "First treasure presentation must call reveal",
);
assert.equal(
  overlay.subarray(0x1770, 0x1774).toString("hex"),
  "ff1ed41f",
  "Second treasure presentation must flip",
);
assert.equal(
  overlay.subarray(0x17bc, 0x17c2).toString("hex"),
  "837e96037cb7",
  "Three subsequent treasure flips",
);
const driver = original.archives.get("IT.DRV")[1].data;
let instructionCount = 0,
  sourceBytes = 0;
assert.deepEqual(Object.keys(manifest.staticArtifacts).sort(), [
  "caller-flips",
  "caller-reveal",
  "ega-reveal",
]);
function compareListing(listing, bytes, baseSegment) {
  assert.equal(listing.truncated, false);
  assert.ok(listing.instructions.length > 0, "Zero executed source cases");
  for (const row of listing.instructions) {
    const [segment, relative] = row.address
      .split(":")
      .map((part) => parseInt(part, 16));
    const offset = (segment - baseSegment) * 16 + relative;
    assert.ok(
      offset >= 0 && offset + row.length <= bytes.length,
      "Source address outside verified image",
    );
    assert.equal(
      Buffer.from(bytes.subarray(offset, offset + row.length)).toString("hex"),
      row.bytes,
      "Original instruction bytes differ",
    );
  }
}
for (const [name, artifact] of Object.entries(manifest.staticArtifacts)) {
  const raw = JSON.parse(await checked(artifact));
  assert.equal(raw.isError, false);
  const listing = JSON.parse(raw.content[0].text);
  assert.equal(
    listing.program,
    name === "ega-reveal" ? "ducktales-ega-driver.bin" : "CAVE_CODE.EXE",
  );
  compareListing(
    listing,
    name === "ega-reveal" ? driver : overlay,
    name === "ega-reveal" ? 0 : 0x1c17,
  );
  instructionCount += listing.instructions.length;
  sourceBytes += listing.instructions.reduce((n, row) => n + row.length, 0);
  const corrupt = structuredClone(listing);
  corrupt.instructions[0].bytes = "00";
  assert.throws(
    () =>
      compareListing(
        corrupt,
        name === "ega-reveal" ? driver : overlay,
        name === "ega-reveal" ? 0 : 0x1c17,
      ),
    /Original instruction bytes differ/,
  );
}
assert.equal(instructionCount, manifest.expectedSourceInstructions);
assert.equal(sourceBytes, manifest.expectedSourceBytes);
assert.equal(
  Buffer.from(driver.subarray(0x127, 0x12e)).toString("hex"),
  "83c22881fac800",
);
assert.equal(
  Buffer.from(driver.subarray(0x130, 0x143)).toString("hex"),
  "b82800b92800f3a448740a81c7a00081c6a000",
);
assert.equal(
  Buffer.from(driver.subarray(0x146, 0x14e)).toString("hex"),
  "b90500e818ffe2fb",
);

// Deliberately distinct source/target rows detect copying the wrong page,
// premature full flips, black substitution, row ordering and missing groups.
const rows = (offset) =>
  Array.from({ length: 200 }, (_, y) => ({
    op: "fill",
    x: 0,
    y,
    width: 320,
    height: 1,
    color: (y + offset) % 16,
  }));
const source = rows(0),
  target = rows(7);
const entries = original.archives.get("EXP.ARC");
const font = original.archives.get("MAIN.ARC")[42].data;
const raster = (commands) =>
  renderFlightPixels(commands, entries, font, "EXP.ARC");
const before = raster(source),
  after = raster(target);
// A mechanism boundary fixture. It is not a restored machine/game checkpoint.
const cave = Object.assign(Object.create(Cave.prototype), {
  current: source,
  buffers: [[], source],
  drawIndex: 0,
  presentations: 0,
});
const iterator = cave.present(target, { striped: true });
const observed = [];
for (let band = 0; band < 5; band++) {
  const step = iterator.next();
  assert.equal(step.done, false, "Skipped reveal group");
  assert.deepEqual(step.value, { clock: "retrace", remaining: 5 });
  assert.equal(cave.drawIndex, 0, "Reveal swapped page roles");
  assert.equal(cave.presentations, band + 1);
  const expected = Uint8ClampedArray.from(before);
  // Independent traversal of the original byte/row groups:40 bytes per row,
  // forty rows per group,200-byte stride. One byte represents eight pixels.
  for (let group = 0; group <= band; group++)
    for (let row = 0; row < 40; row++) {
      const y = group + row * 5;
      expected.set(after.subarray(y * 1280, (y + 1) * 1280), y * 1280);
    }
  const actual = raster(cave.current);
  assert.equal(
    Buffer.compare(Buffer.from(actual), Buffer.from(expected)),
    0,
    "Reveal pixels differ",
  );
  observed.push({ band, wait: step.value.remaining });
  if (band === 0) {
    const corrupt = actual.slice();
    corrupt[0] ^= 1;
    assert.throws(
      () =>
        assert.equal(
          Buffer.compare(Buffer.from(corrupt), Buffer.from(expected)),
          0,
          "Reveal pixels differ",
        ),
      /Reveal pixels differ/,
    );
    assert.throws(
      () =>
        assert.equal(
          Buffer.compare(Buffer.from(after), Buffer.from(expected)),
          0,
          "Premature full flip",
        ),
      /Premature full flip/,
    );
  }
}
assert.equal(iterator.next().done, true, "Unfinished reveal");
assert.equal(cave.current, target);
assert.equal(cave.buffers[0], target);
assert.equal(cave.buffers[1], target);
assert.equal(cave.drawIndex, 0);
assert.equal(cave.presentationTransition, null);
const checkSchedule = (events) => {
  assert.deepEqual(
    events.map((e) => e.band),
    [0, 1, 2, 3, 4],
    "Missing reveal group",
  );
  assert.equal(
    events.reduce((sum, e) => sum + e.wait, 0),
    25,
    "Wrong reveal retraces",
  );
};
checkSchedule(observed);
assert.throws(() => checkSchedule(observed.slice(1)), /Missing reveal group/);
assert.throws(
  () => checkSchedule(observed.map((e, i) => ({ ...e, wait: i ? e.wait : 4 }))),
  /Wrong reveal retraces/,
);
console.log(
  "Cave reveal: original caller/driver bytes;5 exact 320x200 groups;25 declared retraces;unchanged page roles;7 negative controls. Mechanism evidence,not native whole-cave timing.",
);
