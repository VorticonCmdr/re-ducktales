import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { unpackImage } from "../src/game/executable.js";
import build from "../reference/build.json" with { type: "json" };
import evidence from "../reference/title-audio.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
const exe = await readFile("game/DUCKTALE.EXE");
assert.equal(exe.length, build.files["DUCKTALE.EXE"].bytes);
assert.equal(hash(exe), build.files["DUCKTALE.EXE"].sha256);
const image = unpackImage(exe);
assert.equal(evidence.source.ranges.length, 2);
assert.equal(evidence.scenario.unitCases, 5);
for (const r of evidence.source.ranges)
  assert.equal(
    hash(image.subarray(r.at, r.at + r.length)),
    r.sha256,
    r.purpose,
  );

function enabledTitle(mutate = () => {}) {
  const g = new Game();
  mutate(g);
  assert.deepEqual(g.drainEffects(), []);
  g.input({ type: "audio-enabled", enabled: true });
  assert.deepEqual(g.drainEffects(), [{ type: "sound", id: 1 }]);
  return g;
}
test("title starts original request1 once when its initially muted sound provider activates", () => {
  const g = enabledTitle();
  g.input({ type: "audio-enabled", enabled: true });
  for (let i = 0; i < 5000; i++) g.advanceTick();
  assert.equal(g.scene, "title");
  assert.deepEqual(g.drainEffects(), []);
});
test("title request checker rejects a missing startup call", () => {
  assert.throws(
    () =>
      enabledTitle((g) => {
        g.startTitleMusic = () => {};
      }),
    assert.AssertionError,
  );
});
test("keyboard sound starts in reset/start order and re-enabling never loops the intro", () => {
  const g = new Game();
  g.input({ type: "toggle-sound" });
  assert.deepEqual(g.drainEffects(), [
    { type: "stopAudio" },
    { type: "sound", id: 1 },
  ]);
  g.input({ type: "toggle-sound" });
  g.input({ type: "toggle-sound" });
  assert.deepEqual(g.drainEffects(), [
    { type: "stopAudio" },
    { type: "stopAudio" },
  ]);
});
test("skipping title resets its music and later sound activation cannot start title music", () => {
  const g = enabledTitle();
  g.input({ type: "fire" });
  assert.equal(g.scene, "difficulty");
  assert.deepEqual(g.drainEffects(), [{ type: "sound", id: 0 }]);
  g.input({ type: "audio-enabled", enabled: false });
  g.input({ type: "audio-enabled", enabled: true });
  assert.deepEqual(g.drainEffects(), []);
  const muted = new Game();
  muted.input({ type: "fire" });
  assert.deepEqual(muted.drainEffects(), []);
});
test("sound enabled at construction and explicit Restart each initialize one fresh title", () => {
  const g = new Game({ audioEnabled: true });
  assert.deepEqual(g.drainEffects(), [{ type: "sound", id: 1 }]);
  g.input({ type: "fire" });
  g.drainEffects();
  g.input({ type: "restart" });
  assert.equal(g.scene, "title");
  assert.deepEqual(g.drainEffects(), [
    { type: "stopAudio" },
    { type: "sound", id: 1 },
  ]);
});
