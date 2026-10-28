import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
import { parseLocations } from "../src/game/campaign.js";
import build from "../reference/build.json" with { type: "json" };
import evidence from "../reference/ending-audio.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function supported(name) {
  const b = await readFile(`game/${name}`);
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(hash(b), build.files[name].sha256);
  return b;
}
const image = unpackImage(await supported("DUCKTALE.EXE"));
assert.equal(evidence.source.ranges.length, 4);
assert.equal(evidence.scenario.unitCases, 6);
for (const r of evidence.source.ranges)
  assert.equal(
    hash(image.subarray(r.offset, r.offset + r.length)),
    r.sha256,
    r.purpose,
  );
const locations = parseLocations(parseArchive(await supported("LOC.ARC")));
const sound = (id) => ({ type: "sound", id });
// Conditional application entry. Browser scenarios independently reach day31.
function fresh(audioEnabled = true, won = true) {
  const g = new Game({ locations, audioEnabled });
  g.drainEffects();
  g.campaign.day = 31;
  g.campaign.banked = won ? 1000 : 0;
  g.campaign.rival.banked = won ? 0 : 1000;
  g.showEnding();
  return g;
}
function skipToReplay(g) {
  g.input({ type: "fire" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.ending.phase, "celebration");
  assert.deepEqual(g.drainEffects(), []);
  g.input({ type: "fire" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.ending.phase, "replay");
  assert.deepEqual(g.drainEffects(), [sound(1)]);
}
test("both winner outcomes start ending music once and request it again at replay", () => {
  for (const won of [true, false]) {
    const g = fresh(true, won);
    assert.equal(g.ending.won, won);
    assert.deepEqual(g.drainEffects(), [sound(1)]);
    for (let i = 0; i < 700; i++) g.advanceTick();
    assert.equal(g.ending.phase, "celebration");
    assert.deepEqual(g.drainEffects(), []);
    for (let i = 0; i < 700; i++) g.advanceTick();
    assert.equal(g.ending.phase, "replay");
    assert.deepEqual(g.drainEffects(), [sound(1)]);
  }
});
test("replay request checker rejects a missing original song start", () => {
  const g = fresh();
  g.drainEffects();
  g.ending.sound = () => {};
  assert.throws(() => skipToReplay(g), assert.AssertionError);
});
test("Yes resets replay music and bypasses title; main reset follows difficulty confirmation", () => {
  const g = fresh();
  g.drainEffects();
  skipToReplay(g);
  g.input({ type: "fire" });
  assert.equal(g.scene, "difficulty");
  assert.equal(g.ending, null);
  assert.deepEqual(g.drainEffects(), [sound(0)]);
  g.input({ type: "down" });
  assert.deepEqual(g.drainEffects(), []);
  g.input({ type: "fire" });
  assert.equal(g.scene, "office");
  assert.deepEqual(g.drainEffects(), [sound(0)]);
  g.input({ type: "restart" });
  assert.equal(g.scene, "title");
  assert.deepEqual(g.drainEffects(), [{ type: "stopAudio" }, sound(1)]);
});
test("No consumes replay and main resets before credits without starting another song", () => {
  const g = fresh();
  g.drainEffects();
  skipToReplay(g);
  g.input({ type: "down" });
  g.input({ type: "fire" });
  assert.equal(g.scene, "ending");
  assert.equal(g.ending.phase, "credits");
  assert.deepEqual(g.drainEffects(), [sound(0), sound(0)]);
  for (let i = 0; i < 140; i++) g.advanceTick();
  assert.equal(g.ending.credit, 0);
  assert.deepEqual(g.drainEffects(), []);
});
test("ending sound guards follow mute changes without restarting music within a phase", () => {
  const g = fresh();
  g.drainEffects();
  g.input({ type: "toggle-sound" });
  g.input({ type: "toggle-sound" });
  assert.equal(g.ending.audioEnabled, true);
  assert.deepEqual(g.drainEffects(), [
    { type: "stopAudio" },
    { type: "stopAudio" },
  ]);
  skipToReplay(g);
  g.input({ type: "toggle-sound" });
  g.drainEffects();
  g.input({ type: "down" });
  g.input({ type: "fire" });
  assert.equal(g.ending.phase, "credits");
  assert.deepEqual(g.drainEffects(), []);
  const muted = fresh(false);
  assert.deepEqual(muted.drainEffects(), [{ type: "stopAudio" }]);
  for (let i = 0; i < 1400; i++) muted.advanceTick();
  assert.equal(muted.ending.phase, "replay");
  assert.deepEqual(muted.drainEffects(), []);
  assert.throws(
    () => muted.ending.setAudioEnabled(1),
    /Invalid ending audio setting/,
  );
});
test("quit before the campaign ending does not start its music and unknown effects stop", () => {
  const g = new Game({ locations, audioEnabled: true });
  g.drainEffects();
  g.scene = "office";
  g.input({ type: "quit" });
  g.input({ type: "quit-yes" });
  assert.equal(g.ending.phase, "credits");
  assert.ok(!g.drainEffects().some((e) => e.type === "sound" && e.id === 1));
  g.ending.events.push({ type: "unknown" });
  assert.throws(() => g.collectEnding(), /Unsupported ending effect/);
});
