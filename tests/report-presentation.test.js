// Conditional graphics/callback contract only,not integrated browser acceptance.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "./helpers/original-game.js";
import { ReportPresentation } from "../src/game/report-presentation.js";
import { RETRACE_HZ } from "../src/game/timing.js";
const { archives } = await originalGame(),
  entries = archives.get("MAIN.ARC");
function setup(portrait = 33) {
  let now = 0;
  const calls = [],
    p = new ReportPresentation({
      entries,
      portrait,
      clock: () => now,
      flushInput: () => calls.push(["flush", p.consumedRetraces]),
      portraitReady: () => calls.push(["portrait", p.consumedRetraces]),
      readerReady: () => calls.push(["reader", p.consumedRetraces]),
      exited: () => calls.push(["exit", p.consumedRetraces]),
    });
  return {
    p,
    calls,
    setTime: (value) => {
      now = value;
    },
    work: () => {
      now = p.wait.until;
      p.advanceGraphics();
    },
    retraces: (n) => {
      for (let i = 0; i < n; i++) {
        now += 1000 / RETRACE_HZ;
        p.advanceRetrace();
      }
    },
  };
}
for (const portrait of [30, 33])
  test(`portrait${portrait}:cue after helper copy,reader after50 retraces,caller after exit75`, () => {
    const { p, calls, work, retraces } = setup(portrait);
    assert.equal(p.phase, "clearing-page");
    work();
    retraces(24);
    assert.equal(p.phase, "initial-wipe");
    assert.deepEqual(calls, []);
    retraces(1);
    assert.equal(p.phase, "copying-portrait");
    assert.deepEqual(calls, []);
    work();
    assert.deepEqual(calls, [
      ["flush", 25],
      ["portrait", 25],
    ]);
    assert.equal(p.phase, "reveal"); // No award-style extra middle wipe.
    retraces(25);
    assert.equal(p.phase, "publishing");
    assert.equal(calls.length, 2);
    work();
    assert.equal(p.phase, "reading");
    assert.deepEqual(calls.at(-1), ["reader", 50]);
    retraces(100); // External reader duration never advances a graphics phase.
    assert.equal(p.phase, "reading");
    assert.equal(p.consumedRetraces, 50);
    p.beginExit();
    retraces(24);
    assert.equal(p.phase, "exit-wipe");
    assert.equal(calls.length, 3);
    retraces(1);
    assert.equal(p.phase, "publishing-exit");
    assert.equal(calls.length, 3);
    work();
    assert.equal(p.complete, true);
    assert.equal(p.phase, "complete");
    assert.deepEqual(calls, [
      ["flush", 25],
      ["portrait", 25],
      ["reader", 50],
      ["exit", 75],
    ]);
    assert.throws(() => p.beginExit(), /outside completed reader/);
  });
test("portrait graphics cannot release early or consume a driver tick as a retrace", () => {
  const { p, calls, setTime, work } = setup();
  setTime(p.wait.until - 0.000001);
  p.advanceTick();
  assert.equal(p.phase, "clearing-page");
  assert.throws(() => p.advanceGraphics(), /Unexpected report work boundary/);
  work();
  for (let i = 0; i < 100; i++) p.advanceTick();
  assert.equal(p.phase, "initial-wipe");
  assert.equal(p.consumedRetraces, 0);
  assert.deepEqual(calls, []);
  assert.throws(() => p.beginExit(), /outside completed reader/);
  assert.throws(() => p.setClock(() => 999), /Cannot rebase active/);
});
test("report presentation rejects missing callbacks,wrong portraits and backwards time", () => {
  assert.throws(
    () => new ReportPresentation({ entries, portrait: 33 }),
    /Invalid report presentation environment/,
  );
  const { p, setTime } = setup();
  setTime(3);
  p.time();
  setTime(2);
  assert.throws(() => p.time(), /Invalid report presentation clock/);
  assert.throws(
    () =>
      new ReportPresentation({
        entries,
        portrait: 35,
        flushInput() {},
        portraitReady() {},
        readerReady() {},
        exited() {},
      }),
    /Invalid report presentation environment/,
  );
});
