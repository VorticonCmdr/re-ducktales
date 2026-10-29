import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { OfficeMenu } from "../src/game/office-menu.js";
import m from "../reference/office-menu.json" with { type: "json" };
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(
      `SETUP: missing office menu fixture ${p}; see docs/office-menu.md`,
    );
  });
const json = async (p) => JSON.parse(await required(p));
assert.equal(Object.keys(m.currentTools).length, 7);
for (const [p, h] of Object.entries(m.currentTools))
  assert.equal(sha(await required(p)), h, `Changed office menu tool ${p}`);
assert.equal(m.expectedArtifactCount, 117);
assert.equal(Object.keys(m.artifacts).length, 117);
for (const a of Object.values(m.artifacts)) {
  const b = await required(a.path);
  assert.equal(b.length, a.bytes, `Truncated ${a.path}`);
  assert.equal(sha(b), a.sha256, `Corrupt ${a.path}`);
}
assert.equal(sha(await required(m.buildManifest)), m.buildSha256);
assert.equal(sha(await required(m.inputProfile)), m.inputProfileSha256);
assert.equal(sha(await required(m.captureRecipe)), m.captureRecipeSha256);
assert.equal(
  sha(execFileSync("git", ["show", `${m.captureCommit}:${m.captureRecipe}`])),
  m.captureRecipeSha256,
);
const build = await json(m.buildManifest),
  files = {};
for (const name of ["DUCKTALE.EXE", "MAIN.ARC", "IT.DRV"]) {
  const b = await required(`game/${name}`);
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(sha(b), build.files[name].sha256);
  files[name] = b;
}
const cap = await json(`${m.artifactRoot}/capture.json`);
assert.equal(cap.completed, true);
assert.equal(cap.inputCount, 63);
assert.equal(cap.bandCount, 10);
assert.equal(cap.keyboardScenarioCount, 8);
assert.equal(cap.returnCode, 40);
assert.deepEqual(cap.injections, []);
assert.equal(cap.partialRestore, false);
assert.equal(cap.scriptSha256, m.captureRecipeSha256);
assert.equal(sha(await required("src/game/executable.js")), cap.decoderSha256);
assert.equal(sha(await required("src/assets.js")), cap.archiveDecoderSha256);
const cleanup = await json(`${m.artifactRoot}/cleanup.json`);
assert.equal(cleanup.pid, cap.pid);
assert.equal(cleanup.processAbsent, true);
assert.equal(cleanup.exitCode, 0);
const setup = await json(`${m.artifactRoot}/startup-inputs.json`);
assert.equal(setup.afterCancel.active, false);
assert.ok(setup.scope.startsWith("Conditional setup"));
// An explicitly cancelled SETUP tail is not a required experiment input.
assert.equal(
  setup.dispatchedPrefix.dispatched + setup.dispatchedPrefix.remaining,
  10,
);
const endInputs = await json(`${m.artifactRoot}/input-cleanup.json`);
for (const r of [endInputs.beforeCleanup, endInputs.releaseReceipt]) {
  assert.equal(r.active, false);
  assert.equal(r.remaining, 0);
}
const original = files["DUCKTALE.EXE"],
  at = 0xf600;
assert.equal(original.readUInt16LE(at + 26), 2);
assert.equal(original.readUInt16LE(at + 6), 180);
const size =
  (original.readUInt16LE(at + 4) - 1) * 512 +
  (original.readUInt16LE(at + 2) || 512);
const body = Buffer.from(
  original.subarray(at + original.readUInt16LE(at + 8) * 16, at + size),
);
assert.equal(body.length, 8368);
const live = await json(`${m.artifactRoot}/live-overlay.json`),
  map = live.mapping;
assert.equal(live.read.aborted, false);
assert.equal(live.read.results.length, 1);
assert.equal(live.read.results[0].status, "ok");
assert.equal(live.read.results[0].addr, map.overlay * 16);
for (let i = 0; i < 180; i++) {
  const p = at + original.readUInt16LE(at + 24) + i * 4;
  const off =
    original.readUInt16LE(p) + 16 * original.readUInt16LE(p + 2) - 0xc170;
  assert.ok(off >= 0 && off + 1 < body.length);
  body.writeUInt16LE((body.readUInt16LE(off) + map.load) & 65535, off);
}
const checkCode = (b) =>
  assert.deepEqual(b, body, "Original office code identity");
checkCode(Buffer.from(live.read.results[0].data, "base64"));
for (const [p, hex] of [
  [0x347, "ff1ee01f"],
  [0x352, "b80600"],
  [0x35d, "ff1edc1f"],
  [0x3c2, "9a0200"],
  [0x3cc, "253f00"],
  [0x415, "b80100"],
  [0x419, "9acc0d"],
  [0x6bf, "9aa519"],
])
  assert.equal(
    body.subarray(p, p + hex.length / 2).toString("hex"),
    hex,
    `Original office rule${p.toString(16)}`,
  );
const drv = await json(`${m.artifactRoot}/driver-mapping.json`),
  driver = parseArchive(files["IT.DRV"])[1].data;
assert.equal(drv.codeStart, 0x64);
assert.deepEqual(
  Buffer.from(drv.code, "base64"),
  Buffer.from(driver.subarray(0x64, 0x1b0)),
);
const table = Buffer.from(drv.table, "base64");
assert.equal(table.length, 16);
for (const [i, offset] of [0xe5, 0x1b0, 0x101, 0x155].entries()) {
  assert.equal(table.readUInt16LE(i * 4), offset);
  assert.equal(table.readUInt16LE(i * 4 + 2), drv.segment);
}
const entries = parseArchive(files["MAIN.ARC"]),
  image = unpackImage(original),
  profile = await json(m.inputProfile);
assert.equal(profile.expectedPollCount, 63);
assert.equal(profile.events.length, 19);
assert.deepEqual(profile.initialKeys, []);
const observations = await json(`${m.artifactRoot}/consumption.json`);
assert.equal(observations.length, 63);
let previousStop = observations[0].stopId - 1;
for (const [index, o] of observations.entries()) {
  const r = await json(`${m.artifactRoot}/${o.name}.json`);
  assert.equal(r.state.aborted, false);
  assert.equal(r.state.results.length, 2);
  assert.ok(r.state.results.every((v) => v.status === "ok"));
  const cpu = r.state.results[0].registers,
    mem = r.state.results[1];
  assert.equal(cpu.cs, map.overlay);
  assert.equal(cpu.ds, map.ds);
  assert.equal(cpu.ss, map.ds);
  assert.equal(cpu.eip, 0x3c7);
  assert.equal(cpu.eax & 255, o.byte);
  assert.equal(r.stop.stop_id, o.stopId);
  assert.equal(r.stop.protected_mode, false);
  assert.equal(o.index, index + 1);
  assert.equal(o.stopId, previousStop + 1);
  previousStop = o.stopId;
  assert.equal(mem.addr, map.ds * 16);
  assert.equal(Buffer.from(mem.data, "base64").length, 65536);
}
for (const phase of ["wipe", "reveal"])
  for (let band = 0; band < 5; band++) {
    const r = await json(`${m.artifactRoot}/${phase}-${band}.json`);
    assert.equal(r.stop.protected_mode, false);
    assert.equal(r.state.aborted, false);
    assert.equal(r.state.results.length, 2);
    assert.ok(r.state.results.every((v) => v.status === "ok"));
    const cpu = r.state.results[0].registers,
      ds = Buffer.from(r.state.results[1].data, "base64");
    assert.equal(cpu.cs, drv.segment);
    assert.equal(cpu.ss, map.ds);
    assert.equal(cpu.eip, phase === "wipe" ? 0x1aa : 0x14e);
    assert.equal(ds.length, 65536);
    assert.equal(ds.readUInt16LE(cpu.esp & 65535), 40 * (band + 1));
  }
assert.equal(m.expectedInputCount, 63);
assert.equal(m.expectedInputEventCount, 19);
assert.equal(m.expectedPixelCount, 29);
assert.equal(m.expectedEntryRetraces, 50);
const inputPictureNames = new Set([
  "initial-input",
  "neutral-fire",
  "neutral-after-fire",
]);
for (const n of [
  "up",
  "right",
  "left",
  "down",
  "up-right",
  "up-left",
  "left-right",
  "up-down",
]) {
  inputPictureNames.add(n + "-held");
  inputPictureNames.add(n + "-neutral");
}
const pictures = new Map();
for (const n of [
  ...inputPictureNames,
  ...["wipe", "reveal"].flatMap((k) =>
    Array.from({ length: 5 }, (_, i) => `${k}-${i}`),
  ),
]) {
  const png = PNG.sync.read(await required(`${m.artifactRoot}/${n}.png`));
  assert.deepEqual([png.width, png.height], [320, 200]);
  pictures.set(n, png.data);
}
assert.equal(pictures.size, 29);
const black = new Uint8ClampedArray(320 * 200 * 4);
for (let i = 3; i < black.length; i += 4) black[i] = 255;
const incoming = PNG.sync.read(
  await required(`${m.artifactRoot}/entry-before.png`),
);
assert.deepEqual([incoming.width, incoming.height], [320, 200]);
assert.deepEqual(
  incoming.data,
  Buffer.from(black),
  "Authored incoming black page",
);
function compare(p) {
  assert.equal(p.events.length, 19, "Missing input event");
  const events = new Map(p.events.map((e) => [e.beforeRead, e]));
  assert.equal(events.size, 19);
  let eventsUsed = 0,
    pixels = 0;
  const menu = new OfficeMenu({ image, entries, audioEnabled: true });
  const keys = (k) =>
    menu.setControls({ fire: false, direction: null, officeKeys: k });
  keys(p.initialKeys);
  for (const kind of ["wipe", "reveal"])
    for (let band = 0; band < 5; band++) {
      assert.deepEqual(menu.transition, { kind, band });
      assert.deepEqual(
        Buffer.from(menu.pixels(black)),
        pictures.get(`${kind}-${band}`),
        `Original office band ${kind}-${band}`,
      );
      pixels++;
      for (let i = 0; i < 5; i++) menu.advanceRetrace();
    }
  assert.equal(menu.retrace, 50);
  for (const [index, o] of observations.entries()) {
    assert.equal(o.index, index + 1);
    assert.equal(menu.inputReads, index + 1);
    assert.equal(menu.lastInput, o.byte, `Native office input ${o.name}`);
    if (inputPictureNames.has(o.name)) {
      assert.deepEqual(
        Buffer.from(menu.pixels(black)),
        pictures.get(o.name),
        `Original office label ${o.name}`,
      );
      pixels++;
    }
    const e = events.get(index + 2);
    if (e) {
      keys(e.keys);
      eventsUsed++;
    }
    menu.advanceRetrace();
    menu.advanceTick();
  }
  assert.equal(eventsUsed, 19, "Unconsumed required event");
  assert.equal(pixels, 29, "Missing original picture comparison");
  assert.deepEqual(menu.outcome, { action: "map" });
  assert.equal(menu.inputReads, 63);
  assert.equal(menu.tick, 63);
  assert.equal(menu.retrace, 113);
  assert.equal(menu.wait, null);
  assert.deepEqual(menu.drainEvents(), [
    { type: "sound", id: 0 },
    { type: "sound", id: 6 },
  ]);
}
compare(profile);
for (const name of ["entry-before", "return-map"]) {
  const r = await json(`${m.artifactRoot}/${name}.json`);
  assert.equal(r.state.aborted, false);
  assert.equal(r.state.results.length, 2);
  assert.ok(r.state.results.every((v) => v.status === "ok"));
}
const before = await json(`${m.artifactRoot}/entry-before.json`),
  after = await json(`${m.artifactRoot}/return-map.json`);
const first = Buffer.from(before.state.results[1].data, "base64"),
  last = Buffer.from(after.state.results[1].data, "base64");
assert.equal(first.length, 65536);
assert.equal(last.length, 65536);
assert.equal(first.readUInt16LE(0x2229), last.readUInt16LE(0x2229));
assert.equal(after.state.results[0].registers.eax & 65535, 40);
assert.deepEqual(last.subarray(0x276c, 0x27ec), Buffer.alloc(128));
const missing = structuredClone(profile);
missing.events.pop();
assert.throws(() => compare(missing), /Missing input event/);
const wrongChord = structuredClone(profile);
wrongChord.events.find((e) => e.name === "up-right-make").keys = [0x48];
assert.throws(() => compare(wrongChord), /Native office input up-right-make/);
const lostRelease = structuredClone(profile);
lostRelease.events.find((e) => e.name === "up-release").keys = [0x48];
assert.throws(() => compare(lostRelease), /Native office input up-neutral/);
pictures.get("reveal-2")[0] ^= 1;
assert.throws(() => compare(profile), /Original office band reveal-2/);
pictures.get("reveal-2")[0] ^= 1;
const changed = Buffer.from(body);
changed[0x415] ^= 1;
assert.throws(() => checkCode(changed), /Original office code identity/);
compare(profile);
console.log(
  "Office menu core:29 exact original transition/label pictures,63 original input values from19 independent authored key events,eight direction/chord/release cases,50 entry retraces,return40 and flush;5 negative controls. Initial black-page/component scope,not full Game/browser/CPU timing parity.",
);
