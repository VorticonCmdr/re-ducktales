import test from "node:test";
import assert from "node:assert/strict";
import { CampaignEnding } from "../src/game/ending.js";
import { endingTransitionPixels } from "../src/game/ending-presentation.js";
import { Scheduler } from "../src/game/scheduler.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import build from "../reference/build.json" with { type: "json" };
import manifest from "../reference/ending-presentation.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function original(name) {
  const b = await readFile(`game/${name}`).catch(() => {
    throw Error(`SETUP: missing game/${name}`);
  });
  assert.equal(hash(b), build.files[name].sha256);
  assert.equal(b.length, build.files[name].bytes);
  return b;
}
const executable = Buffer.from(unpackImage(await original("DUCKTALE.EXE")));
const graphics = parseArchive(await original("IT.DRV"))[1].data;
assert.equal(manifest.unitCases, 8);
assert.equal(manifest.browserCases, 1);
assert.equal(hash(graphics), manifest.graphics.sha256);
for (const r of manifest.ranges)
  assert.equal(
    hash(executable.subarray(r.offset, r.offset + r.length)),
    r.sha256,
    r.purpose,
  );
const ending = (options = {}) =>
  new CampaignEnding({ banked: 0, rivalBanked: 0, day: 31, ...options });
const retraces = (e, n) => {
  for (let i = 0; i < n; i++) e.advanceRetrace();
};
const ticks = (e, n) => {
  for (let i = 0; i < n; i++) e.advanceTick();
};

test("EGA five row groups preserve incoming pixels and reject altered results", () => {
  const incoming = new Uint8ClampedArray(256000),
    target = new Uint8ClampedArray(256000);
  for (let i = 0; i < incoming.length; i += 4) {
    incoming.set([i % 251, 70, 80, 255], i);
    target.set([20, (i >> 2) % 239, 30, 255], i);
  }
  function check(actual, kind, band) {
    for (let y = 0; y < 200; y++) {
      const at = y * 1280;
      const changed = [0, 1, 2, 3, 4].slice(0, band + 1).includes(y % 5);
      const source = kind === "wipe" ? incoming : target;
      const black = kind === "wipe" ? changed : !changed;
      for (let x = 0; x < 1280; x++)
        assert.equal(
          actual[at + x],
          black ? (x % 4 === 3 ? 255 : 0) : source[at + x],
          `row ${y}, byte ${x}`,
        );
    }
  }
  for (const kind of ["wipe", "reveal"])
    for (let band = 0; band < 5; band++) {
      const actual = endingTransitionPixels({ kind, band }, incoming, target);
      check(actual, kind, band);
      actual[0] ^= 1;
      assert.throws(() => check(actual, kind, band), assert.AssertionError);
    }
  assert.deepEqual(
    endingTransitionPixels({ kind: "flip" }, incoming, target),
    incoming,
  );
  assert.throws(
    () => endingTransitionPixels({ kind: "wipe", band: 5 }, incoming, target),
    /Unsupported/,
  );
  assert.throws(
    () =>
      endingTransitionPixels(
        { kind: "wipe", band: 0 },
        incoming.subarray(1),
        target,
      ),
    /Invalid/,
  );
});

test("resident helper table selects both correct cover and score pictures", () => {
  const base = 0x1c40;
  for (const [helper, target, operand, asset] of [
    [11, 0x100, 0x104, 38],
    [12, 0x130, 0x134, 39],
    [13, 0x139, 0x13d, 36],
    [14, 0x142, 0x146, 37],
  ]) {
    assert.equal(
      executable.readUInt16LE(base + 0x151 + (helper - 1) * 2),
      target,
    );
    assert.equal(executable[base + operand], 0xb8);
    assert.equal(executable.readUInt16LE(base + operand + 1), asset);
  }
  for (const lost of [false, true]) {
    const e = ending({ rivalBanked: lost ? 1 : 0 });
    assert.equal(e.asset, lost ? 37 : 36);
    retraces(e, 50);
    ticks(e, 700);
    retraces(e, 1);
    assert.equal(e.phase, "celebration");
    assert.equal(e.asset, lost ? 38 : 39);
  }
});

test("picture consumes exactly fifty retraces and no dialogue ticks before first poll", () => {
  const e = ending();
  for (let r = 0; r < 50; r++) {
    assert.deepEqual(
      [e.transition.kind, e.transition.band],
      [r < 25 ? "wipe" : "reveal", Math.floor((r % 25) / 5)],
    );
    ticks(e, 2);
    assert.equal(e.remaining, 700);
    assert.equal(e.inputReads, 0);
    e.advanceRetrace();
  }
  assert.equal(e.transition, null);
  assert.equal(e.inputReads, 1);
  ticks(e, 699);
  assert.equal(e.phase, "cover");
  assert.equal(e.dialogueReads, 100);
  e.advanceTick();
  assert.equal(e.transition.kind, "flip");
  assert.equal(e.dialogueReads, 100);
  retraces(e, 1);
  assert.equal(e.phase, "celebration");
});

test("picture flush discards taps; physical held Fire is read immediately after reveal", () => {
  const tap = ending();
  tap.input({ type: "fire" });
  retraces(tap, 50);
  assert.equal(tap.remaining, 700);
  tap.input({ type: "fire" });
  ticks(tap, 6);
  assert.equal(tap.transition, null);
  ticks(tap, 1);
  assert.equal(tap.transition.kind, "flip");
  const held = ending();
  held.setControls({ fire: true, direction: null });
  retraces(held, 50);
  assert.equal(held.transition.kind, "flip");
  assert.equal(held.tick, 0);
  assert.equal(held.dialogueReads, 1);
  retraces(held, 1);
  assert.equal(held.phase, "celebration");
});

test("global input boundary blocks simulation and validates provider responses", () => {
  let polls = 0;
  const e = ending({
    pollInput: () => {
      polls++;
      return false;
    },
  });
  retraces(e, 50);
  assert.equal(polls, 1);
  assert.equal(e.snapshot().waitingForInputPoll, true);
  for (let i = 0; i < 30; i++) {
    e.advanceBlockedTick();
    e.advanceBlockedRetrace();
  }
  assert.equal(e.remaining, 700);
  assert.equal(e.dialogueReads, 0);
  e.resumeInputPoll();
  assert.equal(e.dialogueReads, 1);
  ticks(e, 7);
  assert.equal(polls, 2);
  assert.throws(
    () => ending({ presentationReady: true, pollInput: () => undefined }),
    /Invalid ending global input provider/,
  );
  assert.throws(
    () => e.setControls({ fire: 1, direction: null }),
    /Invalid ending controls/,
  );
});

test("menu retains committed pages and delays next read fourteen driver clocks after direction", () => {
  const e = ending({ presentationReady: true, audioEnabled: true });
  ticks(e, 700);
  retraces(e, 1);
  ticks(e, 700);
  assert.equal(e.phase, "replay");
  assert.equal(e.ready, false);
  retraces(e, 1);
  assert.equal(e.ready, true);
  assert.equal(e.visible.phase, "replay");
  e.input({ type: "down" });
  retraces(e, 1);
  assert.equal(e.choice, 1);
  assert.equal(e.ready, false);
  retraces(e, 1);
  assert.equal(e.visible.choice, 1);
  e.input({ type: "fire" });
  ticks(e, 13);
  assert.equal(e.phase, "replay");
  ticks(e, 1);
  assert.equal(e.phase, "credits");
  assert.deepEqual(e.drainEvents(), [
    { type: "sound", id: 1 },
    { type: "sound", id: 0 },
    { type: "replay-return", choice: 1 },
    { type: "sound", id: 0 },
  ]);
});

test("independent scheduler carries all twenty-six credits through exact natural poll counts", () => {
  const e = ending({ audioEnabled: true });
  e.beginCredits();
  const scheduler = new Scheduler(e);
  const seen = new Set();
  let events = 0;
  while (e.phase !== "closed" && events++ < 20000) {
    scheduler.advanceTo(Math.min(scheduler.tickAt, scheduler.retraceAt));
    if (e.phase === "credits" && e.ready && e.credit >= 0 && e.credit < 26)
      seen.add(e.credit);
  }
  assert.equal(e.phase, "closed", "unfinished natural credits");
  assert.deepEqual(
    [...seen],
    Array.from({ length: 26 }, (_, i) => i),
  );
  assert.equal(e.dialogueReads, 20 + 26 * 20 + 40);
  assert.equal(e.remaining, 0);
  assert.deepEqual(scheduler.events, []);
  assert.deepEqual(e.drainEvents(), [
    { type: "sound", id: 0 },
    { type: "sound", id: 0 },
  ]);
});

test("credits and farewell skips emit distinct click requests before final reset", () => {
  const e = ending({ audioEnabled: true });
  e.beginCredits();
  retraces(e, 50);
  e.input({ type: "fire" });
  ticks(e, 7);
  assert.equal(e.phase, "farewell");
  retraces(e, 50);
  e.input({ type: "fire" });
  ticks(e, 7);
  assert.equal(e.phase, "closed");
  assert.deepEqual(
    e.drainEvents(),
    [0, 36, 36, 0].map((id) => ({ type: "sound", id })),
  );
  assert.throws(() => e.resumeInputPoll(), /outside its input reader/);
});
