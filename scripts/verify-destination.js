import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { OrdinaryKeyboard } from "../src/game/ordinary-keyboard.js";
import { destinationInput } from "../src/game/destination-input.js";
import { destinationCommands } from "../src/game/destination-presentation.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(
      `SETUP: missing destination evidence ${p};see docs/destination.md`,
    );
  });
const manifestPath =
  new URL(import.meta.url).searchParams.get("manifest") ??
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/destination.json";
const m = JSON.parse(await required(manifestPath));
assert.equal(m.completed, true);
assert.equal(m.expectedReads, 5);
assert.equal(m.expectedPictures, 2);
assert.ok(Number.isInteger(m.sourceFileCount) && m.sourceFileCount > 0);
assert.match(m.captureCommit, /^[a-f0-9]{40}$/);
assert.equal(Object.keys(m.artifacts).length, m.expectedArtifacts);
assert.deepEqual(m.injections, []);
assert.equal(m.partialRestore, false);
assert.deepEqual(m.fittedInputs, []);
assert.equal(
  sha(await required("reference/build.json")),
  m.buildManifestSha256,
);
for (const [p, h] of Object.entries(m.verificationTools))
  assert.equal(sha(await required(p)), h, `Changed destination tool ${p}`);
for (const [name, s] of Object.entries(m.artifacts)) {
  const bytes = await required(s.path);
  assert.equal(bytes.length, s.bytes, `Truncated ${name}`);
  assert.equal(sha(bytes), s.sha256, `Corrupt ${name}`);
}
const load = async (name) => JSON.parse(await required(m.artifacts[name].path));
const source = await load("source");
assert.equal(source.captureCommit, m.captureCommit);
assert.equal(Object.keys(source.files).length, m.sourceFileCount);
assert.deepEqual(
  Object.keys(source.files).sort(),
  execFileSync("git", ["ls-tree", "-r", "--name-only", m.captureCommit], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .sort(),
);
assert.equal(source.sourceArchiveSha256, m.artifacts.zip.sha256);
const archive = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      "import zipfile,json,hashlib,sys\nz=zipfile.ZipFile(sys.argv[1]);names=z.namelist()\nassert len(names)==len(set(names))\nprint(json.dumps({p:hashlib.sha256(z.read(p)).hexdigest() for p in names}))",
      m.artifacts.zip.path,
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  ),
);
assert.deepEqual(archive, source.files);
for (const [p, h] of Object.entries(source.files))
  assert.equal(
    sha(execFileSync("git", ["show", `${m.captureCommit}:${p}`])),
    h,
    `Git producer ${p}`,
  );
const runner = await load("runner"),
  capture = await load("capture.json"),
  notice = await load("notice-capture.json"),
  cleanup = await load("cleanup");
assert.equal(runner.exitCode, 0);
assert.equal(runner.status, "finished");
assert.equal(runner.sourceCommit, m.captureCommit);
assert.equal(capture.scriptSha256, source.files["scripts/capture-security.py"]);
for (const record of [capture, notice]) {
  assert.equal(record.completed, true);
  assert.deepEqual(record.injections, []);
  assert.equal(record.partialRestore, false);
}
assert.equal(notice.inputReads, 5);
assert.equal(notice.returnCode, 1);
assert.equal(notice.replay.active, false);
assert.equal(notice.replay.remaining, 0);
assert.equal(cleanup.pid, capture.pid);
assert.equal(cleanup.instanceId, capture.instanceId);
assert.equal(cleanup.processAbsent, true);
// This scenario's complete live map overlay must be the relocated original.
const { game, image, archives } = await originalGame(); // Independently verifies all22 original files.
const exe = await required("game/DUCKTALE.EXE"),
  mapping = await load("map-resident-mapping.json"),
  overlay = await load("map-live-overlay.json");
const body = Buffer.from(exe.subarray(0xfa00, 0x11ab0));
assert.equal(body.length, 8368);
assert.equal(exe.readUInt16LE(0xf606), 180);
for (let i = 0; i < 180; i++) {
  const p = 0xf600 + exe.readUInt16LE(0xf618) + 4 * i,
    at = exe.readUInt16LE(p) + (exe.readUInt16LE(p + 2) - 0xc17) * 16;
  assert.ok(at >= 0 && at < body.length - 1);
  body.writeUInt16LE((body.readUInt16LE(at) + mapping.load) & 65535, at);
}
assert.equal(overlay.read.aborted, false);
assert.equal(overlay.read.results[0].status, "ok");
assert.deepEqual(Buffer.from(overlay.read.results[0].data, "base64"), body);
assert.equal(notice.segment, overlay.entrySegment);
assert.equal(overlay.entrySegment, overlay.segment + 0xca);
const snapshots = new Map();
async function snapshot(name, ip, mode = 1) {
  const s = await load(name),
    regs = s.state.results[0].registers,
    ds = Buffer.from(s.state.results[1].data, "base64");
  assert.equal(s.state.aborted, false);
  assert.equal(s.state.results.length, 2);
  assert.ok(s.state.results.every((r) => r.status === "ok"));
  assert.equal(s.stop.protected_mode, false);
  assert.equal(regs.cs, notice.segment);
  assert.equal(regs.ds, mapping.ds);
  assert.equal(regs.ss, mapping.ds);
  assert.equal(regs.eip, ip);
  assert.equal(ds.length, 65536);
  assert.equal(ds[0x3c1], mode, "Original destination reader mode");
  const record = { s, regs, ds };
  snapshots.set(name, record);
  return record;
}
const entry = await snapshot("notice-before-entry-flush.json", 0xc11),
  afterEntry = await snapshot("notice-after-entry-flush.json", 0xc16);
const ret = await snapshot("notice-return.json", 0x1227);
const consumption = await load("notice-consumption.json"),
  rows = consumption.filter((r) => r.index !== undefined);
assert.equal(rows.length, 5);
assert.equal(consumption.length, 7);
for (const [index, row] of rows.entries())
  for (const [stage, ip] of Object.entries({
    flush: 0x1193,
    before: 0x11e9,
    input: 0x11ee,
  })) {
    assert.equal(row.index, index);
    const { s, regs, ds } = await snapshot(row[stage].artifact, ip);
    assert.equal(s.stop.stop_id, row[stage].stopId);
    assert.equal(ds.readUInt32LE(0x2225), row[stage].clock);
    assert.equal(regs.eax & 65535, row[stage].ax);
    assert.equal(ds[0x3c1], row[stage].mode);
    assert.equal(ds.readUInt16LE((regs.ebp - 0x7c) & 65535), row[stage].choice);
  }
const profile = JSON.parse(await required("reference/map-notice-inputs.json"));
assert.equal(
  sha(await required("reference/map-notice-inputs.json")),
  m.profileSha256,
);
const inputs = await load("inputs.json"),
  scan = { KBD_space: 0x39, KBD_kp6: 0x4d };
const flags = (ds) => ds.subarray(0x276c, 0x27ec);
function replay(negative) {
  const keyboard = new OrdinaryKeyboard(0);
  const handoff = profile.events.find((e) => e.beforeRead === 35);
  assert.equal(handoff.keys.length, 1);
  for (const e of handoff.keys) keyboard.event(scan[e.key], e.pressed);
  keyboard.mode = 1;
  assert.deepEqual(Buffer.from(keyboard.bytes()), flags(entry.ds));
  keyboard.flush();
  assert.deepEqual(Buffer.from(keyboard.bytes()), flags(afterEntry.ds));
  let choice = 0,
    consumed = 0,
    result = null;
  const choices = [];
  for (const [index, row] of rows.entries()) {
    const event = profile.noticeEvents[index] ?? {};
    const flush = snapshots.get(row.flush.artifact),
      before = snapshots.get(row.before.artifact),
      input = snapshots.get(row.input.artifact);
    assert.equal(
      flush.ds.readUInt16LE((flush.regs.ebp - 0x7c) & 65535),
      choice,
      `Carried choice ${index}`,
    );
    keyboard.flush();
    assert.deepEqual(Buffer.from(keyboard.bytes()), flags(flush.ds));
    choices.push(choice);
    for (const [role, recordId] of [
      ["keys", row.scheduledInputRecord],
      ["afterKeys", row.afterInputRecord],
    ])
      if (event[role]) {
        assert.ok(Number.isInteger(recordId));
        assert.deepEqual(
          inputs[recordId].events,
          event[role].map((e) => ({ type: "key", ...e, t: 0 })),
        );
        consumed++;
      }
    for (const e of event.keys ?? [])
      if (
        !(negative === "omit-choice" && index === 2) &&
        !(negative === "omit-confirm" && index === 4)
      )
        keyboard.event(scan[e.key], e.pressed);
    assert.deepEqual(
      Buffer.from(keyboard.bytes()),
      flags(before.ds),
      `Before flags ${index}`,
    );
    const byte = keyboard.poll();
    assert.equal(byte, input.regs.eax & 65535, `Original input ${index}`);
    assert.deepEqual(
      Buffer.from(keyboard.bytes()),
      flags(input.ds),
      `Reader flags ${index}`,
    );
    result = destinationInput(choice, byte, !!entry.ds[0x8eb4]);
    choice = result.choice;
    for (const e of event.afterKeys ?? [])
      keyboard.event(scan[e.key], e.pressed);
  }
  assert.equal(consumed, 3);
  assert.equal(result.returnCode, notice.returnCode);
  assert.equal(ret.regs.eax & 65535, result.returnCode);
  assert.equal(choice, 1);
  keyboard.flush();
  assert.deepEqual(Buffer.from(keyboard.bytes()), flags(ret.ds));
  return choices;
}
const choices = replay();
assert.throws(() => replay("omit-choice"), /Before flags 2/);
assert.throws(() => replay("omit-confirm"), /Before flags 4/);
// Capture caller/resource arguments before any destination page is drawn.
// They are conditional segment inputs, not an independently replayed campaign.
const ds = entry.ds,
  bp = entry.regs.ebp & 65535,
  target = ds.readUInt16LE(bp + 6),
  at = 0x4e2a + target * 8;
const args = {
  locationAsset: ds.readUInt16LE(ds.readUInt16LE(at) + 0x1e),
  treasureAsset: ds.readUInt16LE(ds.readUInt16LE(at + 2)),
  bank: target === 0,
  collected: !!(ds[at + 6] || ds[at + 7]),
  days: ds.readInt8(bp - 8),
  day: ds.readInt8(0x4e0e),
  money: ds.readInt32LE(0x8cc0),
  atomicAvailable: !!ds[0x8eb4],
};
assert.deepEqual(args, m.presentationArguments);
const params = {
  ...args,
  image,
  location: parseLocations(archives.get("LOC.ARC"))[args.locationAsset],
  treasure: parseLoot(archives.get("LOOT.ARC"))[args.treasureAsset],
};
assert.deepEqual(m.pictureReadIndices, [0, 4]);
for (const index of m.pictureReadIndices) {
  const expected = PNG.sync.read(
    await required(m.artifacts[`notice-00${index}-flush.png`].path),
  );
  assert.deepEqual([expected.width, expected.height], [320, 200]);
  const commands = destinationCommands({ ...params, choice: choices[index] });
  const render = (c) =>
    Buffer.from(
      renderFlightPixels(
        c,
        archives.get("MAIN.ARC"),
        archives.get("MAIN.ARC")[42].data,
        "MAIN.ARC",
      ),
    );
  assert.deepEqual(
    render(commands),
    expected.data,
    `Exact original destination picture ${index}`,
  );
  const altered = Buffer.from(expected.data);
  altered[0] ^= 1;
  assert.throws(() => assert.deepEqual(render(commands), altered));
  const missing = commands.filter(
    (c) => !(c.op === "text" && c.text === params.treasure.description[0]),
  );
  assert.equal(missing.length, commands.length - 1);
  assert.throws(() => assert.deepEqual(render(missing), expected.data));
}
// Source-derived uncovered branches; not additional original runtime cases.
assert.equal(destinationInput(0, 0xc3, false).choice, 0);
assert.equal(destinationInput(0, 0xc3, false).returnCode, 36);
assert.equal(destinationInput(0, 7, true).choice, 2);
assert.equal(destinationInput(2, 3, true).choice, 0);
for (const byte of [1, 2, 4, 5, 6, 8])
  assert.equal(destinationInput(1, byte, true).changed, false);
assert.throws(
  () => destinationInput(0, 256, false),
  /Invalid destination input/,
);
assert.throws(() => destinationInput(2, 0, false), /Invalid destination input/);
console.log(
  `Destination:5 carried original mode1 input/128-flag/choice comparisons and2 exact320x200 original pictures;${m.sourceFileCount} producer files/full8368-byte relocated overlay,2 missing-make and4 pixel controls. Captured caller arguments are conditional;menu/CPU timing and intermediate scanout remain unverified.`,
);

// The video-boundary audit uses the same strict capture/producer/input/picture
// checks with its own explicit manifest. No result is fed back into Game.
export {
  m as manifest,
  load,
  snapshot,
  snapshots,
  rows,
  entry,
  ret,
  choices,
  archives,
  image,
  body,
};
