// Source-derived conditional boundaries;browser probes earn the transmitter.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { GameAudioDevice } from "../src/game/audio-device.js";
import { SpeakerGameStream } from "../src/speaker-game.js";
import { TandyGameStream } from "../src/tandy-game.js";
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
async function fixture({ audio = false, seed = 0x6db8, device = false } = {}) {
  const { game: g } = await originalGame();
  g.securityPending = false;
  g.audioEnabled = audio;
  g.seed = g.campaign.seed = seed;
  g.campaign.atomicAvailable = true;
  g.campaign.aircraft = "atomic";
  g.hasAudioDevice = () => device;
  g.drainEffects();
  g.travel(30);
  return { g, a: g.atomicTransport };
}
test("both original providers initialize idle and stay idle without requests", async () => {
  const { archives } = await originalGame();
  for (const stream of [
    new SpeakerGameStream(archives.get("IT.DRV")[5].data, {
      sampleRate: 48000,
    }),
    new TandyGameStream(archives.get("IT.DRV")[4].data, { sampleRate: 48000 }),
  ]) {
    assert.equal(stream.state().busy, false);
    assert.equal(
      stream.renderFrames(48000).some((v) => v !== 0),
      false,
    );
    assert.equal(stream.state().busy, false);
    assert.equal(stream.sequence, 0);
  }
});
test("unlock-only device is distinguished from any queued request before ACK", () => {
  const d = new GameAudioDevice(new Uint8Array(), {
    status: () => {},
    stats: () => {},
    fail: (e) => {
      throw e;
    },
    workletURL: "test",
    processorName: "test",
    label: "test",
  });
  d.unlock = () => {};
  assert.equal(d.hasRequests, false);
  d.request(0);
  assert.equal(d.hasRequests, true);
  assert.equal(d.acknowledged, 0);
  assert.equal(d.pending.length, 1);
  // Negative:an unacknowledged reset must not be treated as known idle.
  assert.notEqual(d.hasRequests, d.acknowledged > 0);
});
for (const audio of [false, true])
  test("atomic initial0 and success54 are guarded audio=" + audio, async () => {
    const { g, a } = await fixture({ audio, seed: 0, device: true });
    assert.deepEqual(
      g
        .drainEffects()
        .filter((e) => ["sound", "stopAudio", "audio-query"].includes(e.type)),
      audio ? [{ type: "sound", id: 0 }] : [],
    );
    ticks(g, 7);
    assert.equal(a.outcome.misdirected, false);
    assert.deepEqual(
      g
        .drainEffects()
        .filter((e) => ["sound", "stopAudio", "audio-query"].includes(e.type)),
      audio ? [{ type: "sound", id: 0x54 }] : [],
    );
  });
test("muted failure with a live used device queries at consumption and waits for actual status", async () => {
  const { g, a } = await fixture({ device: true });
  assert.deepEqual(g.drainEffects(), []);
  ticks(g, 6);
  assert.equal(a.phase, "charge");
  ticks(g, 1);
  assert.equal(a.phase, "sound");
  assert.equal(a.busy, null);
  assert.equal(a.statusKnown, false);
  assert.deepEqual(g.drainEffects(), [{ type: "audio-query", token: a.token }]);
  g.input({ type: "pause" });
  g.input({ type: "quit" });
  ticks(g, 20);
  assert.equal(g.systemOverlay, null);
  g.input({ type: "audio-status", token: "old", busy: false });
  assert.equal(a.statusKnown, false);
  g.input({ type: "audio-status", token: a.token, busy: true });
  ticks(g, 20);
  assert.equal(a.phase, "sound");
  g.input({ type: "audio-enabled", enabled: false });
  assert.equal(a.busy, true);
  g.input({ type: "audio-status", token: a.token, busy: false });
  assert.equal(a.phase, "report");
  assert.equal(a.remaining, 420);
  assert.equal(a.inputPolls, 1);
  assert.equal(g.pendingAtomicSystemKeys.size, 0);
  assert.equal(g.systemOverlay, null);
});
test("enabled45 initial status is unknown,and mute cannot invent completion", async () => {
  const { g, a } = await fixture({ audio: true });
  g.drainEffects();
  ticks(g, 7);
  assert.deepEqual(g.drainEffects(), [
    { type: "sound", id: 0x45, token: a.token },
  ]);
  assert.equal(a.busy, null);
  ticks(g, 20);
  assert.equal(a.phase, "sound");
  g.input({ type: "audio-status", token: a.token, busy: true });
  g.input({ type: "audio-enabled", enabled: false });
  ticks(g, 20);
  assert.equal(a.busy, true);
  assert.equal(a.phase, "sound");
  g.input({ type: "audio-status", token: a.token, busy: false });
  assert.equal(a.phase, "report");
  assert.equal(a.remaining, 420);
});
test("unused/absent device is known idle;muted report keeps its original seven-count entry", async () => {
  const { g, a } = await fixture();
  ticks(g, 6);
  assert.equal(a.phase, "charge");
  ticks(g, 1);
  assert.equal(a.phase, "report");
  assert.equal(a.remaining, 420);
  assert.equal(a.inputPolls, 1);
  assert.deepEqual(
    g
      .drainEffects()
      .filter(
        (e) =>
          e.type === "audio-query" ||
          e.type === "sound" ||
          e.type === "stopAudio",
      ),
    [],
  );
});
test("device presence is sampled after charge,not fitted at constructor", async () => {
  const { g, a } = await fixture();
  let queries = 0;
  g.hasAudioDevice = () => {
    queries++;
    return true;
  };
  ticks(g, 6);
  assert.equal(queries, 0);
  ticks(g, 1);
  assert.equal(queries, 1);
  assert.equal(a.phase, "sound");
  g.input({ type: "audio-status", token: a.token, busy: false });
  assert.equal(a.phase, "report");
});
test("invalid query provider and busy-spin resumption fail explicitly", async () => {
  const { g, a } = await fixture({ device: true });
  assert.throws(() => a.resumeAudioStatus(), /outside/);
  g.hasAudioDevice = () => null;
  assert.throws(() => ticks(g, 7), /provider/);
});
