import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import {
  advanceJungleMotion,
  moveJunglePlatformRider,
  jungleVinePoint,
} from "../src/game/jungle-motion.js";
import {
  rememberJungleActor,
  composeJungleActor,
} from "../src/game/jungle-animation.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

const ids = Array.from({ length: 25 }, (_, i) => String(i).padStart(2, "0"));
const actorWords = [
  0x88ae, 0x7164, 0x8b56, 0x4cf0, 0x6d9a, 0x797a, 0x5f46, 0x6858, 0x6882,
  0x544c, 0x5462, 0x8e26, 0x8d64, 0x8924, 0x7158, 0x7166, 0x3d12, 0x3a44,
  0x3a46, 0x5b24,
];
const hash = (b) => createHash("sha256").update(b).digest("hex");
function decode(raw, cs, ip, count = 2) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.deepEqual([cpu.cs, cpu.eip, cpu.ds, cpu.ss], [cs, ip, 0x1403, 0x1403]);
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes, results: r.results };
}
function compareActor(m, bytes, label) {
  for (const at of actorWords)
    assert.equal(
      m.i(at),
      bytes.readInt16LE(at),
      `${label}: actor divergence at ${at.toString(16)}`,
    );
  const sprite = m.view.getUint16(0x797a, true);
  assert.equal(
    m.b(sprite + 18),
    bytes[sprite + 18],
    `${label}: sprite divergence`,
  );
}
export async function verifyJungleMotion(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-motion.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 25);
  assert.equal(manifest.expectedCheckpointCount, 25);
  assert.equal(manifest.expectedCarriedCheckpointCount, 21);
  assert.equal(manifest.expectedInputCount, 0);
  assert.deepEqual(manifest.inputEvents, []);
  assert.deepEqual(
    manifest.routineSchedule.map((c) => c.id),
    ids,
  );
  assert.deepEqual(manifest.carriedSegments, [
    [2, 6],
    [8, 10],
    [12, 24],
  ]);
  assert.deepEqual(manifest.stackExclusion, [0x9e3a, 0x9e6e]);
  assert.deepEqual(manifest.injections, [
    {
      at: "01f5:04ca after unrelated flight/repair",
      segment: 0x1403,
      offset: 0x9f5e,
      width: 1,
      before: 22,
      after: 25,
    },
  ]);
  const local = {};
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const raw = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/jungle.md`);
    });
    assert.equal(hash(raw), artifact.sha256, `corrupt ${artifact.path}`);
    local[key] = JSON.parse(raw);
  }
  assert.equal(Object.keys(local).length, 55, "missing motion artifact");
  assert.deepEqual(manifest.setupInputProvenance, [
    { artifact: "walk-input", al: 3, stop: 167 },
    { artifact: "up-input", al: 1, stop: 180 },
    { artifact: "down-input", al: 5, stop: 189 },
  ]);
  for (const event of manifest.setupInputProvenance)
    assert.equal(
      decode(local[event.artifact], 0xe0c, 0x680).cpu.eax & 255,
      event.al,
      "setup input provenance disagreement",
    );
  function identity(alterCode = false) {
    const target = decode(local["before-target"], 0x1f5, 0x4ca, 3),
      entry = decode(local.entry, 0xe0c, 0, 3);
    assert.equal(target.bytes[0x9f5e], 22);
    assert.equal(entry.bytes[0x9f5e], 25);
    assert.equal(entry.bytes[0x4e0e], 22);
    assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 4), 0);
    assert.equal(entry.bytes.readUInt16LE(0x2229), 37850);
    const exe = resources.executableRaw,
      overlay = 0x1fa00;
    assert.equal(exe.readUInt16LE(overlay), 0x5a4d);
    assert.equal(exe.readUInt16LE(overlay + 6), 436);
    assert.equal(exe.readUInt16LE(overlay + 8) * 16, 2048);
    const body = Buffer.from(exe.subarray(overlay + 2048, overlay + 26104));
    const table = exe.readUInt16LE(overlay + 24);
    for (let i = 0; i < 436; i++) {
      const at = overlay + table + 4 * i,
        off = (exe.readUInt16LE(at + 2) - 0xc17) * 16 + exe.readUInt16LE(at);
      assert.ok(off >= 0 && off + 2 <= body.length);
      body.writeUInt16LE((body.readUInt16LE(off) + 0x1f5) & 65535, off);
    }
    const live = Buffer.from(entry.results[2].data, "base64");
    if (alterCode) live[0] ^= 1;
    assert.equal(live.length, 24056);
    assert.deepEqual(live, body, "live jungle overlay identity");
    // Unpatched resident software-FPU helper: OR AH,0c sets x87 rounding
    // toward zero before FISTP qword, then restores the control word.
    const ftol = Buffer.from(resources.image).subarray(
      0x40e * 16 + 0x52c2,
      0x40e * 16 + 0x52f5,
    );
    assert.equal(
      hash(ftol),
      manifest.ftolOriginalSha256,
      "resident integer conversion identity",
    );
  }
  const cache = new WeakMap();
  function render(m) {
    const pose = new FlightMemory(m.bytes);
    rememberJungleActor(pose);
    const assets = new Map(
      [
        [0x957e, 0],
        [0x9762, 5],
        [0x5f2c, 6],
        [0x5f90, 17],
      ].map(([at, id]) => [pose.view.getUint16(at, true), id]),
    );
    renderFlightPixels(
      composeJungleActor(pose, assets),
      resources.entries,
      resources.mainEntries[42].data,
      "JG.ARC",
      cache,
    );
  }
  function routines({
    omitCase = false,
    omitAdvance = false,
    alterResult = false,
  } = {}) {
    let executed = 0,
      rendered = 0;
    for (const c of manifest.routineSchedule) {
      if (omitCase && c.id === "03") continue;
      const before = decode(local[c.id + "-before"], 0xe0c, 0xc98),
        after = decode(local[c.id + "-after"], 0xe0c, 0x11c0);
      assert.equal(before.cpu.esp, 0x9e6e);
      assert.equal(after.cpu.ebp, before.cpu.esp - 2);
      const m = new FlightMemory(before.bytes);
      if (!(omitAdvance && c.id === "02")) advanceJungleMotion(m);
      if (alterResult && c.id === "03") after.bytes[0x5f46] ^= 1;
      for (const [start, end] of [
        [0, 0x9e3a],
        [0x9e6e, 65536],
      ])
        assert.deepEqual(
          Buffer.from(m.bytes.subarray(start, end)),
          after.bytes.subarray(start, end),
          `${c.id}: DS divergence`,
        );
      compareActor(m, after.bytes, c.id);
      render(m);
      executed++;
      rendered++;
    }
    assert.equal(executed, 25, "unfinished motion sequence");
    assert.equal(rendered, 25, "unrendered motion pose");
  }
  function carried(omitReset = false) {
    let checkpoints = 0;
    for (const [start, end] of manifest.carriedSegments) {
      const m = new FlightMemory(
        decode(local[ids[start] + "-before"], 0xe0c, 0xc98).bytes,
      );
      for (let i = start; i <= end; i++) {
        // Main00fe unconditionally clears the fresh-selection latch each
        // outer iteration. No expected state supplies this scheduling value.
        if (i > start && !omitReset) m.i(0x8b56, 0);
        advanceJungleMotion(m);
        compareActor(
          m,
          decode(local[ids[i] + "-after"], 0xe0c, 0x11c0).bytes,
          `carried ${i}`,
        );
        checkpoints++;
      }
    }
    assert.equal(checkpoints, 21, "unfinished carried motion sequence");
  }
  identity();
  routines();
  carried();
  assert.throws(() => identity(true), /overlay identity/);
  assert.throws(
    () => routines({ omitCase: true }),
    /unfinished motion sequence/,
  );
  assert.throws(() => routines({ omitAdvance: true }), /DS divergence/);
  assert.throws(() => routines({ alterResult: true }), /DS divergence/);
  assert.throws(() => carried(true), /actor divergence/);

  // Authored static-rule checks, not original runtime evidence for these paths.
  const fresh = () =>
    new FlightMemory(decode(local["00-before"], 0xe0c, 0xc98).bytes);
  const p = fresh(),
    at = 0x6040 + 50,
    frame = 0x9000;
  p.view.setUint16(at + 34, frame, true);
  p.view.setFloat64(0x33ce, 104, true);
  p.i(at + 42, 100);
  p.i(0x5f46, 91);
  p.i(frame + 6, 13);
  p.i(frame + 2, 0);
  p.i(0x3a44, 0);
  p.i(0x3a46, 0);
  p.i(0x6858, 20);
  moveJunglePlatformRider(p, 1);
  assert.equal(p.i(0x3a46), -1, "negative platform slope truncation");
  assert.equal(p.i(0x6858), 19);
  p.view.setFloat64(0x33ce, 105, true);
  assert.throws(() => moveJunglePlatformRider(p, 1), /slope constant/);
  const v = fresh();
  for (const [off, value] of [
    [0x5d4c, 1],
    [0x5d4e, 2],
    [0x5d52, 3],
    [0x5d54, 4],
  ])
    v.i(off + 34, value);
  assert.deepEqual(jungleVinePoint(v, 1), {
    anchorX: 1,
    anchorY: 2,
    x: 3,
    y: 4,
  });
  console.log(
    "Jungle motion: 25 exact original routine cases,21 carried actor checkpoints,25 rendered poses; five negative controls. Walking,short step,drop,fall and water death covered. Other motion branches have static evidence; no whole-scene/browser/timing parity claimed.",
  );
}
