import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import {
  officeCommands,
  officeSelectionCommands,
  officeInput,
  officeMoneyBinFrames,
  OfficeMoneyBin,
} from "../src/game/office.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const json = async (path) => JSON.parse(await readFile(path));
const manifest = await json("reference/office.json"),
  build = await json(manifest.buildManifest);
async function required(path) {
  return readFile(path).catch(() => {
    throw Error(`SETUP: missing ${path}; see docs/office-transitions.md`);
  });
}
assert.equal(manifest.expectedCheckpointCount, 20);
assert.equal(manifest.cases.length, 20);
assert.equal(manifest.expectedArtifactCount, 48);
assert.equal(manifest.artifacts.length, manifest.expectedArtifactCount);
for (const f of manifest.artifacts) {
  const b = await required(f.path);
  assert.equal(b.length, f.bytes, `Truncated ${f.path}`);
  assert.equal(sha(b), f.sha256, `Corrupt ${f.path}`);
}
assert.equal(Object.keys(manifest.verificationTools).length, 5);
for (const [path, hash] of Object.entries(manifest.verificationTools))
  assert.equal(
    sha(await required(path)),
    hash,
    `Changed office verification tool ${path}`,
  );
const original = {};
for (const file of ["DUCKTALE.EXE", "MAIN.ARC", "IT.DRV"]) {
  const b = await required(`game/${file}`);
  assert.equal(b.length, build.files[file].bytes);
  assert.equal(sha(b), build.files[file].sha256);
  original[file] = b;
}
const tool = (r) => {
  assert.notEqual(r.isError, true);
  return JSON.parse(r.content.find((c) => c.type === "text").text);
};
const root = manifest.artifactRoot,
  mapping = manifest.mapping;
const exe = original["DUCKTALE.EXE"],
  overlayAt = 0xf600;
assert.equal(exe.readUInt16LE(overlayAt + 26), 2);
const length =
  (exe.readUInt16LE(overlayAt + 4) - 1) * 512 +
  (exe.readUInt16LE(overlayAt + 2) || 512);
const header = exe.readUInt16LE(overlayAt + 8) * 16;
const body = Buffer.from(exe.subarray(overlayAt + header, overlayAt + length));
assert.equal(body.length, mapping.overlayBytes);
assert.equal(exe.readUInt16LE(overlayAt + 6), mapping.overlayRelocations);
for (let i = 0; i < mapping.overlayRelocations; i++) {
  const at = overlayAt + exe.readUInt16LE(overlayAt + 24) + i * 4;
  const pos =
    exe.readUInt16LE(at) +
    exe.readUInt16LE(at + 2) * 16 -
    mapping.overlayRelocationOrigin;
  assert.ok(pos >= 0 && pos + 2 <= body.length);
  body.writeUInt16LE(
    (body.readUInt16LE(pos) + mapping.loadParagraph) & 65535,
    pos,
  );
}
// Operand widths/counts and branch limits are checked in original instructions,
// independently of the JavaScript frame plan and its total-count assertion.
for (const [at, hex] of [
  [0x1bb, "c746fe0f00"],
  [0x1f4, "b80700"],
  [0x203, "837efe03"],
  [0x247, "b80700"],
  [0x29d, "b84900"],
  [0x2a9, "c746fe0100"],
  [0x2cb, "b81c00"],
  [0x2da, "837efe03"],
  [0x1b0, "b80400"],
  [0x22d, "b82300"],
  [0x25a, "b82200"],
  [0x559, "c746f62600"],
  [0x6bf, "9aa519"],
])
  assert.equal(body.subarray(at, at + hex.length / 2).toString("hex"), hex);
const live = tool(await json(`${root}/live-overlay.json`));
assert.equal(live.addr, mapping.overlay2 * 16);
const sameCode = (bytes) =>
  assert.deepEqual(bytes, body, "Original office overlay identity");
sameCode(Buffer.from(live.data, "base64"));
const changedCode = Buffer.from(body);
changedCode[0x200] ^= 1;
assert.throws(() => sameCode(changedCode), /Original office overlay identity/);
const entries = parseArchive(original["MAIN.ARC"]),
  image = unpackImage(original["DUCKTALE.EXE"]),
  frames = Array.from(officeMoneyBinFrames());
assert.equal(frames.length, 19);
const bitmaps = new Map();
function compareCases(cases) {
  assert.equal(cases.length, 20, "Missing office checkpoint");
  const seen = new Set();
  for (const c of cases) {
    assert.ok(!seen.has(c.name));
    seen.add(c.name);
    const r = bitmaps.get(c.name);
    assert.ok(r, "Missing office picture");
    const commands =
      c.kind === "initial"
        ? officeCommands()
        : c.kind === "selection"
          ? officeSelectionCommands(image, c.byte)
          : frames[c.frameIndex]?.commands;
    assert.ok(commands, "Unsupported office case");
    assert.deepEqual(
      Buffer.from(
        renderFlightPixels(commands, entries, entries[42].data, "MAIN.ARC"),
      ),
      r.png.data,
      `Original office pixels ${c.name}`,
    );
    const ds = r.ds;
    for (const sprite of commands.filter((v) => v.op === "sprite")) {
      const at = { 4: 0x3d14, 5: 0x4e12, 6: 0x9794, 7: 0x5f92, 8: 0x77dc }[
        sprite.asset
      ];
      assert.ok(at);
      assert.deepEqual(
        [sprite.x, sprite.y, sprite.frame],
        [ds.readInt16LE(at), ds.readInt16LE(at + 2), ds[at + 18]],
        `Native sprite ${c.name}/${sprite.asset}`,
      );
    }
  }
}
for (const c of manifest.cases) {
  const data = await json(`${root}/${c.name}.json`),
    state = tool(data.state);
  assert.equal(state.aborted, false);
  assert.equal(state.results.length, 2);
  const [cpu, memory] = state.results;
  assert.equal(cpu.status, "ok");
  assert.equal(memory.status, "ok");
  assert.equal(cpu.registers.cs, mapping.overlay2);
  assert.equal(cpu.registers.ds, mapping.gameDS);
  assert.equal(cpu.registers.ss, mapping.gameSS);
  assert.equal(cpu.registers.eip, c.ip);
  const ds = Buffer.from(memory.data, "base64");
  assert.equal(ds.length, 65536);
  assert.equal(memory.addr, mapping.gameDS * 16);
  if (c.name.startsWith("pendulum-"))
    assert.equal(
      ds.readInt16LE(cpu.registers.ebp - 2),
      15 - Number(c.name.slice(9)),
    );
  const png = PNG.sync.read(await required(`${root}/${c.name}.png`));
  assert.equal(png.width, 320);
  assert.equal(png.height, 200);
  bitmaps.set(c.name, { png, ds });
}
compareCases(manifest.cases);
assert.throws(() => compareCases([]), /Missing office checkpoint/);
assert.throws(
  () => compareCases(manifest.cases.slice(1)),
  /Missing office checkpoint/,
);
bitmaps.get("pendulum-1").png.data[0] ^= 1;
assert.throws(
  () => compareCases(manifest.cases),
  /Original office pixels pendulum-1/,
);
bitmaps.get("pendulum-1").png.data[0] ^= 1;
const observations = [
  tool((await json(`${root}/initial.json`)).stop),
  tool((await json(`${root}/up.json`)).stop),
  tool(await json(`${root}/fire-input.json`)),
];
assert.equal(observations.length, manifest.expectedInputObservationCount);
assert.deepEqual(
  observations.map((s) => s.registers.eax & 255),
  manifest.inputSchedule.observedBytes,
);
assert.deepEqual(
  observations.map((s) => officeInput(s.registers.eax & 255).action),
  [null, null, "money-bin"],
);
assert.equal(
  officeInput(192).action,
  null,
  "Neutral Fire must not reuse a selection",
);
assert.throws(() => officeInput(256), /Invalid office input/);
// Carry the component across every source-declared flip/count wait. No wall
// time or expected native state feeds its providers or chooses its commands.
const component = new OfficeMoneyBin({ audioEnabled: true });
let flips = 0,
  counts = 0;
for (const f of frames) {
  assert.equal(component.wait.clock, "retrace");
  assert.equal(component.wait.remaining, 1);
  component.advanceTick();
  assert.equal(component.wait.remaining, 1);
  component.advanceRetrace();
  flips++;
  assert.deepEqual(component.frame, f.commands);
  for (let n = 0; n < f.counts; n++) {
    assert.equal(component.wait.clock, "driver");
    assert.equal(component.wait.remaining, f.counts - n);
    component.advanceTick();
    counts++;
  }
}
assert.equal(flips, 19);
assert.equal(counts, 255);
assert.equal(component.presentations, 19);
assert.equal(component.wait, null);
assert.deepEqual(
  component.events,
  [4, 35, 34].map((id) => ({ type: "sound", id })),
);
assert.deepEqual(component.outcome, { code: 38, action: "money-bin" });
// Independent browser receipts are required separately from native component
// comparisons. Their source hashes pin the current connected application.
const browser = manifest.browserAcceptance;
assert.equal(browser.caseCount, 2);
assert.equal(browser.regressionCaseCount, 9);
assert.equal(browser.unitCaseCount, 117);
assert.equal(browser.expectedArtifactCount, 31);
assert.equal(browser.artifacts.length, browser.expectedArtifactCount);
for (const f of browser.artifacts) {
  const bytes = await required(f.path);
  assert.equal(bytes.length, f.bytes, `Truncated browser receipt ${f.path}`);
  assert.equal(sha(bytes), f.sha256, `Corrupt browser receipt ${f.path}`);
}
const receipt = (name) => `${browser.artifactRoot}/${name}`;
assert.deepEqual(await json(receipt("browser-status.json")), {
  status: "passed",
  failedTests: [],
});
assert.match(await readFile(receipt("browser.log"), "utf8"), /2 passed/);
assert.match(await readFile(receipt("regression.log"), "utf8"), /9 passed/);
assert.match(await readFile(receipt("unit.log"), "utf8"), /pass 117/);
assert.match(
  await readFile(receipt("negative-summary.log"), "utf8"),
  /missing real Up rejects departure/,
);
const negative = await readFile(receipt("negative-browser.log"), "utf8");
assert.match(negative, /Unfinished office door entry/);
assert.match(negative, /1 failed/);
assert.doesNotMatch(
  negative,
  /SETUP:|Test timeout|TimeoutError|No tests found/,
);
const source = await json(receipt("source-revision.json"));
assert.ok(Object.keys(source.sha256).length > 60);
for (const [path, hash] of Object.entries(source.sha256))
  assert.equal(
    sha(await required(path)),
    hash,
    `Changed current office browser source ${path}`,
  );
for (let i = 0; i < 19; i++) {
  const name =
    i === 0
      ? "initial"
      : i <= 13
        ? `pendulum-${i - 1}`
        : ["door-open", "door-pause", "roof-1", "roof-2", "roof-3"][i - 14];
  const actual = PNG.sync.read(await required(receipt(`office-${i}.png`)));
  assert.equal(actual.width, 320);
  assert.equal(actual.height, 200);
  assert.deepEqual(
    actual.data,
    bitmaps.get(name).png.data,
    `Archived original browser picture ${name}`,
  );
}
const hard = JSON.parse(
  (await readFile(receipt("hard-game-replay.log"), "utf8")).trim(),
);
assert.equal(hard.checked, 25);
assert.equal(hard.consumed, 3350);
console.log(
  "Office:20 exact native pictures/sprite tuples and8368 relocated bytes; carried19-flip/255-count departure,4 comparison negatives;2 browser cases/19 exact pictures,9 regressions/117 unit cases and missing-Up control pinned. Full branch/elapsed-time parity remains unproven.",
);
