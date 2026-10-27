import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/application.js";
import { SystemControls } from "../src/game/system-controls.js";
import { MoneyBin } from "../src/game/money-bin.js";

test("pause requires its35-tick entry lock and7-tick resume delay; unrelated actions cannot close it", () => {
  const p = new SystemControls("pause");
  p.input({ type: "pause" });
  assert.equal(p.phase, "lock");
  for (let i = 0; i < 34; i++) p.advanceTick();
  assert.equal(p.phase, "lock");
  p.advanceTick();
  assert.equal(p.phase, "waiting");
  for (const type of ["fire", "back", "quit", "quit-yes", "quit-no"])
    p.input({ type });
  assert.equal(p.phase, "waiting");
  p.input({ type: "pause" });
  for (let i = 0; i < 6; i++) p.advanceTick();
  assert.equal(p.result, null);
  p.advanceTick();
  assert.equal(p.result, "resume");
  assert.throws(() => new SystemControls("save"), /Unsupported system dialog/);
});

test("pause and cancelled quit freeze activity clocks, input, cash and RNG,then flush held controls", () => {
  const g = new Game();
  g.scene = "money-bin";
  g.bin = new MoneyBin();
  for (let i = 0; i < 50; i++) g.advanceTick();
  const before = g.bin.snapshot(),
    money = g.money,
    seed = g.seed;
  g.input({ type: "pause" });
  for (let i = 0; i < 1000; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  g.input({ type: "fire" });
  g.input({ type: "controls", fire: true, direction: "up" });
  assert.deepEqual(g.bin.snapshot(), before);
  assert.equal(g.money, money);
  assert.equal(g.seed, seed);
  g.input({ type: "pause" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.systemOverlay, null);
  assert.deepEqual(g.controls, { fire: false, direction: null });
  assert.deepEqual(g.bin.snapshot(), before);
  g.input({ type: "quit" });
  g.input({ type: "fire" });
  for (let i = 0; i < 1000; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.deepEqual(g.bin.snapshot(), before);
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.scene, "money-bin");
  assert.deepEqual(g.bin.snapshot(), before);
  assert.equal(g.money, money);
  assert.equal(g.seed, seed);
  assert.equal(
    g.drainEffects().filter((e) => e.type === "flushControls").length,
    2,
  );
  g.advanceTick();
  assert.notDeepEqual(g.bin.snapshot(), before);
});

test("sound settings and device results remain explicit while a global dialog blocks gameplay", () => {
  const g = new Game();
  g.input({ type: "pause" });
  g.input({ type: "toggle-sound" });
  assert.equal(g.audioEnabled, true);
  g.input({ type: "toggle-sound" });
  assert.equal(g.audioEnabled, false);
  for (let i = 0; i < 35; i++) g.advanceTick();
  g.input({ type: "audio-enabled", enabled: true });
  g.input({ type: "pause" });
  assert.ok(g.drainEffects().some((e) => e.type === "sound" && e.id === 0x24));
  g.input({ type: "restart" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.exiting, false);
});

test("confirmed quit skips scores,bank deposits and replay and enters the original credits route", () => {
  const g = new Game();
  g.money = 1234;
  const seed = g.seed;
  g.input({ type: "quit" });
  g.input({ type: "quit-yes" });
  assert.equal(g.scene, "ending");
  assert.equal(g.ending.phase, "credits");
  assert.equal(g.exiting, true);
  assert.equal(g.money, 1234);
  assert.equal(g.seed, seed);
  g.input({ type: "pause" });
  g.input({ type: "quit" });
  assert.equal(g.systemOverlay, null);
  g.input({ type: "fire" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.ending.phase, "farewell");
  g.input({ type: "fire" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.ending.phase, "closed");
  g.input({ type: "restart" });
  assert.equal(g.exiting, false);
  assert.equal(g.scene, "title");
});
