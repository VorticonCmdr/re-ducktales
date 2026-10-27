import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import {
  advanceJungleHazards,
  advanceJungleBonus,
  advanceJungleCamera,
  presentJungleProjectile,
  collideJungleProjectile,
  jungleTrig,
  advanceJungleSnake,
  collideJungleSnake,
  collideJungleTransport,
} from "../src/game/jungle-hazards.js";

const LOOPS = Array.from({ length: 12 }, (_, i) => String(i).padStart(2, "0"));
const ROUTINES = [
  ["bonus-spawn", "bonus", 0xe0c, 0x2093, 0x21fb, 268, 269, 0x9e44, 0x9e6e],
  ["camera-idle", "camera", 0xe0c, 0x591, 0x650, 275, 276, 0x9e62, 0x9e6e],
  ["camera-view", "camera", 0xe0c, 0x591, 0x650, 278, 279, 0x9e62, 0x9e6e],
  ["projectile-draw", "draw", 0x106f, 0x912, 0x97e, 289, 290, 0x9e26, 0x9e6c],
  ["projectile-miss", "miss", 0x106f, 0x9c0, 0xac0, 291, 292, 0x9e48, 0x9e6c],
  ["projectile-hit", "hit", 0x106f, 0xa39, 0xac0, 301, 306, 0x9e28, 0x9e6c],
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
function exact(actual, expected, label) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++)
    if (actual[i] !== expected[i])
      assert.fail(
        `${label}: byte ${i.toString(16)},actual ${actual[i]},expected ${expected[i]}`,
      );
}
function compareDS(m, expected, exclusions, label) {
  let start = 0;
  for (const [lo, hi] of [...exclusions, [65536, 65536]]) {
    assert.ok(start <= lo && lo <= hi);
    exact(
      m.bytes.subarray(start, lo),
      expected.subarray(start, lo),
      `${label}: DS divergence`,
    );
    start = hi;
  }
}
export async function verifyJungleAdvance(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-advance.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 18);
  assert.equal(manifest.expectedGameCheckpointCount, 18);
  assert.equal(manifest.expectedCheckpointCount, 20);
  assert.equal(manifest.expectedWaitBoundaryCount, 2);
  assert.equal(manifest.expectedInputCount, 5);
  assert.deepEqual(manifest.loopCases, LOOPS);
  assert.deepEqual(manifest.routines, ROUTINES);
  assert.deepEqual(manifest.inputEvents, [
    { case: "projectile-draw", id: 1 },
    { case: "projectile-miss", id: 1 },
    { case: "projectile-hit", id: 1 },
    { case: "projectile-hit", wait: 0, ticks: 166605 },
    { case: "projectile-hit", wait: 7, ticks: 166612 },
  ]);
  const local = {};
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const raw = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/jungle.md`);
    });
    assert.equal(hash(raw), artifact.sha256, `corrupt ${artifact.path}`);
    local[key] = JSON.parse(raw);
  }
  assert.equal(Object.keys(local).length, 45, "missing advance artifact");
  function identity() {
    // Requested-pause notification reported01ea; the atomic CPU+memory batch
    // records01e6. This is a recovery observation,not a routine boundary.
    const recovery = decode(local.recovery, 0xb83, 0x1e6, 3),
      exe = resources.executableRaw,
      overlay = 0x1fa00;
    assert.equal(recovery.bytes.readInt16LE(0x5cfc), 3);
    const body = Buffer.from(exe.subarray(overlay + 2048, overlay + 26104)),
      table = exe.readUInt16LE(overlay + 24);
    assert.equal(exe.readUInt16LE(overlay + 6), 436);
    for (let i = 0; i < 436; i++) {
      const at = overlay + table + i * 4,
        off = (exe.readUInt16LE(at + 2) - 0xc17) * 16 + exe.readUInt16LE(at);
      assert.ok(off >= 0 && off + 2 <= body.length);
      body.writeUInt16LE((body.readUInt16LE(off) + 0x1f5) & 65535, off);
    }
    exact(
      Buffer.from(recovery.results[2].data, "base64"),
      body,
      "live hazard overlay identity",
    );
    assert.equal(
      hash(
        Buffer.from(resources.image).subarray(
          0x40e * 16 + 0x14d7,
          0x40e * 16 + 0x1558,
        ),
      ),
      manifest.trigOriginalSha256,
    );
    // Pin exactly the recorded setup writes. They are not accepted gameplay.
    for (const [suffix, writes] of [
      [
        "",
        [
          [0x5f46, 8, 340],
          [0x5ed2, 0, 312],
        ],
      ],
      [
        "2",
        [
          [0x5f46, 8, 400],
          [0x6858, 16, 80],
          [0x5ed2, 0, 312],
        ],
      ],
    ]) {
      const before = decode(local["before-position" + suffix], 0xe0c, 0x651),
        after = decode(local["after-position" + suffix], 0xe0c, 0x651),
        copy = Buffer.from(before.bytes);
      for (const [at, from, to] of writes) {
        assert.equal(copy.readInt16LE(at), from);
        copy.writeInt16LE(to, at);
      }
      exact(copy, after.bytes, "conditional position setup");
    }
  }
  function compare({
    omitCase = false,
    omitAdvance = false,
    alterResult = false,
    omitDraw = false,
    omitWait = false,
    earlyWait = false,
    extraEvent = false,
  } = {}) {
    let executed = 0,
      consumed = 0,
      waits = 0;
    const events = structuredClone(manifest.inputEvents);
    if (omitWait) events.pop();
    if (earlyWait) events[4].ticks--;
    if (extraEvent) events.push({ case: "unused", ticks: 0 });
    for (const id of LOOPS) {
      if (omitCase && id === "05") continue;
      const before = decode(local[id + "-before"], 0xe0c, 0x251),
        after = decode(local[id + "-after"], 0xe0c, 0x323),
        m = new FlightMemory(before.bytes);
      assert.equal(before.cpu.ebp, 0x9f48);
      assert.equal(before.cpu.esp, 0x9e72);
      assert.deepEqual(
        [after.cpu.ebp, after.cpu.esp],
        [before.cpu.ebp, before.cpu.esp],
      );
      assert.equal(
        before.bytes.readInt16LE(0x9e78),
        Math.trunc(m.i(0x5ed2) / 104),
        "must capture whole pass,not a middle section",
      );
      assert.equal(
        after.bytes.readInt16LE(0x9e78),
        Math.trunc(m.i(0x5ed2) / 104) + (m.i(0x8e0e) === 0 ? 3 : 4),
        "unfinished original section pass",
      );
      if (!(omitAdvance && id === "01")) advanceJungleHazards(m);
      if (alterResult && id === "08") after.bytes[0x2229] ^= 1;
      compareDS(
        m,
        after.bytes,
        [
          [0x9e36, 0x9e72],
          [0x9e78, 0x9e7a],
          [0x9f44, 0x9f46],
        ],
        id,
      );
      executed++;
    }
    for (const [id, kind, cs, beforeIP, afterIP, , , lo, hi] of ROUTINES) {
      const before = decode(local[id + "-before"], cs, beforeIP),
        after = decode(local[id + "-after"], cs, afterIP),
        m = new FlightMemory(before.bytes);
      if (kind === "bonus") advanceJungleBonus(m);
      else if (kind === "camera") advanceJungleCamera(m);
      else {
        const event = events[consumed++];
        assert.deepEqual(event, { case: id, id: 1 });
        const argumentAt =
          kind === "hit" ? before.cpu.ebp + 6 : before.cpu.esp + 4;
        assert.equal(before.bytes.readUInt16LE(argumentAt), event.id);
        if (kind === "draw") {
          const draws = [];
          presentJungleProjectile(m, event.id, (at) => {
            if (!omitDraw)
              draws.push({
                resource: at,
                x: m.i(at),
                y: m.i(at + 2),
                frame: m.b(at + 18),
              });
          });
          assert.equal(draws.length, 1, "unconsumed projectile drawing event");
          assert.deepEqual(draws[0], {
            resource: before.bytes.readUInt16LE(0x8cc4),
            x: 142,
            y: 114,
            frame: 0,
          });
        } else if (kind === "miss") {
          assert.equal(after.cpu.eax & 65535, 0);
          assert.equal(collideJungleProjectile(m, event.id), false);
        } else {
          assert.equal(before.cpu.eax & 65535, 1, "original geometry result");
          assert.equal(after.cpu.eax & 65535, 1);
          const hit = collideJungleProjectile(m, event.id, {
            wait: (ticks) => {
              const incoming = events[consumed++];
              assert.ok(incoming, "missing required clock event");
              assert.equal(incoming.case, "projectile-hit");
              assert.equal(incoming.wait, ticks);
              const entry = decode(
                  local[`hit-wait${waits}-entry`],
                  0x603,
                  0xdcc,
                ),
                consume = decode(
                  local[`hit-wait${waits}-consume`],
                  0x603,
                  0xdf1,
                );
              assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 4), ticks);
              assert.equal(
                consume.bytes.readUInt16LE(consume.cpu.ebp + 6),
                ticks,
              );
              assert.equal(
                entry.bytes.readUInt32LE(0x2221),
                m.view.getUint32(0x2221, true),
                "wait must carry its own base",
              );
              assert.equal(
                consume.bytes.readUInt32LE(0x2221),
                m.view.getUint32(0x2221, true),
                "clock consumed before base store",
              );
              assert.equal(
                consume.bytes.readUInt32LE(0x2225),
                manifest.inputEvents[3 + waits].ticks,
                "clock must originate at pre-read boundary",
              );
              if (ticks)
                assert.ok(
                  incoming.ticks >=
                    (m.view.getUint32(0x2221, true) + ticks) >>> 0,
                  "clock completion before deadline",
                );
              m.view.setUint32(0x2225, incoming.ticks, true);
              m.view.setUint32(0x2221, incoming.ticks, true);
              waits++;
            },
          });
          assert.equal(hit, true);
          assert.equal(m.i(0x6882), 2);
          assert.equal(m.i(0x58f8 + 62), 0);
        }
      }
      compareDS(m, after.bytes, [[lo, hi]], id);
      executed++;
    }
    assert.equal(executed, 18, "unfinished advance cases");
    assert.equal(waits, 2, "unfinished clock boundaries");
    assert.equal(consumed, events.length, "unconsumed required event");
  }
  identity();
  compare();
  assert.throws(() => compare({ omitCase: true }), /unfinished advance cases/);
  assert.throws(() => compare({ omitAdvance: true }), /DS divergence/);
  assert.throws(() => compare({ alterResult: true }), /DS divergence/);
  assert.throws(
    () => compare({ omitDraw: true }),
    /unconsumed projectile drawing event/,
  );
  assert.throws(
    () => compare({ omitWait: true }),
    /missing required clock event/,
  );
  assert.throws(
    () => compare({ earlyWait: true }),
    /clock completion before deadline/,
  );
  assert.throws(
    () => compare({ extraEvent: true }),
    /unconsumed required event/,
  );
  const fresh = () =>
    new FlightMemory(decode(local["04-before"], 0xe0c, 0x251).bytes);
  const trig = fresh();
  for (const [angle, cosine, sine] of [
    [0, 256, 0],
    [64, 0, 256],
    [128, -256, 0],
    [192, 0, -256],
  ]) {
    assert.equal(jungleTrig(trig, angle), cosine);
    assert.equal(jungleTrig(trig, angle, true), sine);
  }
  // Authored static-rule cases,not additional original runtime comparisons.
  const snake = fresh(),
    s = 0x7034 + 38;
  snake.i(0x6882, 5);
  snake.i(0x5f46, snake.i(s + 32) + 16);
  snake.i(0x6858, snake.i(s + 34) - 16);
  assert.equal(collideJungleSnake(snake, 1), true);
  assert.equal(snake.i(0x6882), 45);
  snake.i(s + 16, snake.i(s + 20) - 1);
  advanceJungleSnake(snake, 1);
  assert.equal(snake.i(0x6882), 2);
  const transport = fresh(),
    t = 0x776e + 10;
  transport.i(0x544c, transport.i(t));
  transport.i(0x5f46, transport.i(t + 4));
  transport.i(0x6858, transport.i(t + 6));
  collideJungleTransport(transport, 1);
  assert.equal(transport.i(0x1aac), 1);
  const hit = new FlightMemory(
    decode(local["projectile-hit-before"], 0x106f, 0xa39).bytes,
  );
  assert.throws(
    () => collideJungleProjectile(hit, 1),
    /Missing jungle driver wait provider/,
  );
  console.log(
    "Jungle advancement: 12 exact conditional whole hazard passes,bonus spawn,2 camera routines,projectile draw/miss/hit;18 game checkpoints plus2 pre-read clock boundaries,5 consumed events,7 negative controls. No game-global or timer exclusions; only documented stack scratch/caller locals. Remaining branches have static evidence. No carried gameplay/browser/timing parity claim.",
  );
}
