import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import {
  officeInvestmentFrames,
  officeSelectionCommands,
} from "../src/game/office.js";
import { OfficeInvestmentDeparture } from "../src/game/office-investments.js";
import m from "../reference/office-investments.json" with { type: "json" };
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(
      `SETUP: missing office investment fixture ${p}; see docs/office-investments.md`,
    );
  });
const json = async (p) => JSON.parse(await required(p));
assert.equal(m.expectedArtifactCount, 26);
assert.equal(Object.keys(m.artifacts).length, m.expectedArtifactCount);
for (const a of Object.values(m.artifacts)) {
  const b = await required(a.path);
  assert.equal(b.length, a.bytes, `Truncated ${a.path}`);
  assert.equal(sha(b), a.sha256, `Corrupt ${a.path}`);
}
assert.equal(sha(await required(m.buildManifest)), m.buildManifestSha256);
assert.equal(sha(await required(m.captureRecipe)), m.captureRecipeSha256);
assert.equal(
  sha(execFileSync("git", ["show", `${m.captureCommit}:${m.captureRecipe}`])),
  m.captureRecipeSha256,
);
const build = await json(m.buildManifest),
  originals = {};
for (const name of ["DUCKTALE.EXE", "MAIN.ARC", "IT.DRV"]) {
  const b = await required(`game/${name}`);
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(sha(b), build.files[name].sha256);
  originals[name] = b;
}
const capture = await json(`${m.artifactRoot}/capture.json`);
assert.equal(capture.completed, true);
assert.equal(capture.expectedCheckpointCount, 7);
assert.equal(capture.returnCode, 39);
assert.deepEqual(capture.injections, []);
assert.equal(capture.partialRestore, false);
assert.equal(capture.scriptSha256, m.captureRecipeSha256);
const cleanup = await json(`${m.artifactRoot}/cleanup.json`);
assert.equal(cleanup.pid, capture.pid);
assert.equal(cleanup.processAbsent, true);
assert.equal(cleanup.captureExitCode, 0);
const live = await json(`${m.artifactRoot}/live-overlay.json`),
  mapping = live.mapping;
assert.equal(live.read.aborted, false);
assert.equal(live.read.results.length, 1);
assert.equal(live.read.results[0].status, "ok");
assert.equal(live.read.results[0].addr, mapping.overlay * 16);
const exe = originals["DUCKTALE.EXE"],
  at = 0xf600;
assert.equal(exe.readUInt16LE(at + 26), 2);
assert.equal(exe.readUInt16LE(at + 6), 180);
const length =
  (exe.readUInt16LE(at + 4) - 1) * 512 + (exe.readUInt16LE(at + 2) || 512);
const body = Buffer.from(
  exe.subarray(at + exe.readUInt16LE(at + 8) * 16, at + length),
);
assert.equal(body.length, 8368);
for (let i = 0; i < 180; i++) {
  const r = at + exe.readUInt16LE(at + 24) + i * 4;
  const p = exe.readUInt16LE(r) + 16 * exe.readUInt16LE(r + 2) - 0xc170;
  assert.ok(p >= 0 && p + 1 < body.length);
  body.writeUInt16LE((body.readUInt16LE(p) + mapping.load) & 65535, p);
}
const sameCode = (b) =>
  assert.deepEqual(b, body, "Original office overlay identity");
sameCode(Buffer.from(live.read.results[0].data, "base64"));
for (const [p, hex] of [
  [0x571, "b81300"],
  [0x5e2, "b80300"],
  [0x629, "b80e00"],
  [0x638, "837efa03"],
  [0x652, "c606244e03"],
  [0x66e, "b80e00"],
  [0x698, "c746f62700"],
  [0x6bf, "9aa519"],
])
  assert.equal(
    body.subarray(p, p + hex.length / 2).toString("hex"),
    hex,
    `Original rule ${p.toString(16)}`,
  );
const entries = parseArchive(originals["MAIN.ARC"]),
  image = unpackImage(exe),
  frames = [...officeInvestmentFrames()];
const pixels = (commands) =>
  Buffer.from(
    renderFlightPixels(commands, entries, entries[42].data, "MAIN.ARC"),
  );
assert.equal(m.expectedLogicalFlipCount, 7);
assert.equal(frames.length, 7);
assert.equal(m.expectedDriverCounts, 70);
assert.equal(
  frames.reduce((n, f) => n + f.counts, 0),
  70,
);
assert.deepEqual(
  pixels(frames[0].commands),
  pixels(frames[1].commands),
  "First new page equals first waited pose",
);
const pictures = new Map();
async function state(name) {
  const r = await json(`${m.artifactRoot}/${name}.json`);
  assert.equal(r.state.aborted, false);
  assert.equal(r.state.results.length, 2);
  const [cpu, mem] = r.state.results;
  assert.equal(cpu.status, "ok");
  assert.equal(mem.status, "ok");
  assert.equal(cpu.registers.cs, mapping.overlay);
  assert.equal(cpu.registers.ds, mapping.ds);
  assert.equal(cpu.registers.ss, mapping.ds);
  assert.equal(mem.addr, mapping.ds * 16);
  const ds = Buffer.from(mem.data, "base64");
  assert.equal(ds.length, 65536);
  return { cpu: cpu.registers, ds };
}
assert.equal(m.expectedNativePictureCount, 7);
assert.equal(m.cases.length, 7);
for (const c of m.cases) {
  const r = await state(c.name);
  assert.equal(r.cpu.eip, c.ip);
  const png = PNG.sync.read(await required(`${m.artifactRoot}/${c.name}.png`));
  assert.deepEqual([png.width, png.height], [320, 200]);
  pictures.set(c.name, png.data);
  if (c.frameIndex !== null) {
    const positions = {
      4: 0x3d14,
      5: 0x4e12,
      6: 0x9794,
      7: 0x5f92,
      8: 0x77dc,
      19: 0x8ede,
    };
    for (const s of frames[c.frameIndex].commands.filter(
      (c) => c.op === "sprite",
    )) {
      const p = positions[s.asset];
      assert.ok(p);
      assert.deepEqual(
        [s.x, s.y, s.frame],
        [r.ds.readInt16LE(p), r.ds.readInt16LE(p + 2), r.ds[p + 18]],
        `Native sprite ${c.name}/${s.asset}`,
      );
    }
  }
}
function compare(cases) {
  assert.equal(cases.length, 7, "Missing native picture");
  assert.equal(new Set(cases.map((c) => c.name)).size, 7);
  for (const c of cases)
    assert.deepEqual(
      pixels(
        c.frameIndex === null
          ? officeSelectionCommands(image, 199)
          : frames[c.frameIndex].commands,
      ),
      pictures.get(c.name),
      `Original investment pixels ${c.name}`,
    );
  assert.deepEqual(
    pixels(frames[0].commands),
    pictures.get("pose-0"),
    "Initial new page",
  );
}
compare(m.cases);
assert.equal((await state("office-confirm")).cpu.eax & 255, 199);
const flushed = await state("after-flush"),
  returned = await state("return");
assert.deepEqual(flushed.ds.subarray(0x276c, 0x27ec), Buffer.alloc(128));
assert.equal(returned.cpu.eax & 65535, 39);
assert.equal(
  flushed.ds.readUInt16LE(0x2229),
  (await state("initial")).ds.readUInt16LE(0x2229),
);
for (const enabled of [false, true]) {
  const component = new OfficeInvestmentDeparture({ audioEnabled: enabled });
  let driver = 0;
  for (const f of frames) {
    assert.equal(component.wait.clock, "retrace");
    component.advanceRetrace();
    assert.deepEqual(component.frame, f.commands);
    for (let i = 0; i < f.counts; i++) {
      assert.equal(component.wait.clock, "driver");
      component.advanceTick();
      driver++;
    }
  }
  assert.equal(driver, 70);
  assert.equal(component.presentations, 7);
  assert.deepEqual(component.outcome, { code: 39, action: "investments" });
  assert.equal(component.wait, null);
  assert.deepEqual(
    component.drainEvents(),
    enabled ? [{ type: "sound", id: 3 }] : [],
  );
}
assert.throws(() => compare([]), /Missing native picture/);
assert.throws(() => compare(m.cases.slice(1)), /Missing native picture/);
pictures.get("pose-2")[0] ^= 1;
assert.throws(() => compare(m.cases), /Original investment pixels/);
pictures.get("pose-2")[0] ^= 1;
const changed = Buffer.from(body);
changed[0x638] ^= 1;
assert.throws(() => sameCode(changed), /Original office overlay identity/);
compare(m.cases);
console.log(
  "Office investment departure:7 exact native pictures with explicit VGA latch alignment,7 logical flips/70 driver counts,original sprite tuples,held-key flush and return39;4 comparison negatives. Native whole-scene/CPU/audio timing parity not claimed.",
);
