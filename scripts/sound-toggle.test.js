// Conditional device/caller boundaries. Actual browser exploration is separate.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { SpeakerGameStream } from "../src/speaker-game.js";
import { SpeakerDriver } from "../src/speaker-driver.js";
import { TandyGameStream } from "../src/tandy-game.js";
import { GameAudioDevice } from "../src/game/audio-device.js";
import { RivalReport } from "../src/game/rival.js";
const { archives } = await originalGame();
const speaker = () =>
  new SpeakerGameStream(archives.get("IT.DRV")[5].data, { sampleRate: 48000 });
const tandy = () =>
  new TandyGameStream(archives.get("IT.DRV")[4].data, { sampleRate: 48000 });
const batch = (start = 1) =>
  [0, 0x24].map((argument, i) => ({
    sequence: start + i,
    argument,
    token: null,
  }));
test("speaker consecutive0/24 calls preserve original rejection and driver bytes with no injected IRQ", () => {
  const s = speaker(),
    native = new SpeakerDriver(archives.get("IT.DRV")[5].data);
  assert.deepEqual([native.request(0), native.request(0x24)], [true, false]);
  s.requestBatch(batch());
  const events = s.drainEvents();
  assert.deepEqual(
    events.map((e) => [e.argument, e.accepted, e.frame]),
    [
      [0, true, 0],
      [0x24, false, 0],
    ],
  );
  assert.deepEqual(s.driver.memory, native.memory);
  assert.equal(
    s.renderFrames(4800).some((v) => v !== 0),
    false,
  );
  for (let i = 0; i < s.driver.interrupts; i++) native.interrupt();
  assert.deepEqual(s.driver.memory, native.memory);
  // Negative:the legacy browser stop/start barrier changes this native case.
  const wrong = speaker();
  wrong.request({ sequence: 1, argument: 0 });
  wrong.request({ sequence: 2, argument: 0x24 });
  wrong.renderFrames(4800);
  const ack = wrong.drainEvents();
  assert.equal(ack[1].accepted, true);
  assert.ok(ack[1].frame > 0);
  assert.notDeepEqual(wrong.driver.memory, s.driver.memory);
});
test("Tandy0/24 preserves translated primitive bytes and click PCM without an intermediate completion", () => {
  const s = tandy(),
    primitive = tandy();
  for (const x of [s, primitive])
    x.request({ sequence: 1, argument: 0x6e, token: "speech" });
  s.drainEvents();
  primitive.drainEvents();
  s.requestBatch(batch(2));
  primitive.playback.start(0);
  primitive.playback.start(0x24);
  assert.deepEqual(s.playback.driver.memory, primitive.playback.driver.memory);
  const ack = s.drainEvents();
  assert.equal(
    ack.some((e) => e.type === "complete"),
    false,
  );
  assert.deepEqual(
    ack.map((e) => [e.argument, e.busy, e.frame]),
    [
      [0, false, 0],
      [0x24, true, 0],
    ],
  );
  const pcm = s.renderFrames(4800),
    other = primitive.renderFrames(4800);
  assert.deepEqual(pcm, other);
  assert.ok(pcm.some((v) => v !== 0));
});
for (const [name, create] of [
  ["speaker", speaker],
  ["Tandy", tandy],
]) {
  test(
    name +
      " status query changes no driver bytes and tracks real global completion",
    () => {
      const s = create();
      s.request({ sequence: 1, argument: 0x6e, token: "speech" });
      s.drainEvents();
      const before = (s.driver ?? s.playback.driver).memory.slice();
      s.query({ sequence: 2, argument: null, token: "query" });
      assert.deepEqual((s.driver ?? s.playback.driver).memory, before);
      assert.equal(s.drainEvents()[0].busy, true);
      s.requestBatch(batch(3));
      let complete = [];
      for (
        let i = 0;
        i < 100 && !complete.some((e) => e.token === "query");
        i++
      ) {
        s.renderFrames(1024);
        complete.push(...s.drainEvents().filter((e) => e.type === "complete"));
      }
      assert.deepEqual(complete.map((e) => e.token).sort(), [
        "query",
        "speech",
      ]);
      assert.equal(s.stats().pendingTokens, 0);
    },
  );
  test(
    name +
      " native batches and queries reject malformed or duplicated input without partial execution",
    () => {
      const s = create();
      assert.throws(
        () => s.requestBatch([batch()[0], { ...batch()[1], sequence: 8 }]),
        /batch/,
      );
      assert.equal(s.sequence, 0);
      assert.throws(
        () => s.query({ sequence: 1, argument: 0, token: "x" }),
        /query/,
      );
      assert.equal(s.sequence, 0);
      s.request({ sequence: 1, argument: 0x6e, token: "x" });
      assert.throws(
        () => s.query({ sequence: 2, argument: null, token: "x" }),
        /query/,
      );
    },
  );
}
test("browser adapter sends the original call batch as one message and accounts for status-query tokens", () => {
  const sent = [];
  const d = new GameAudioDevice(new Uint8Array(), {
    status: () => {},
    stats: () => {},
    fail: (e) => {
      throw e;
    },
    workletURL: "unused",
    processorName: "unused",
    label: "conditional",
  });
  d.unlock = () => {};
  d.node = { port: { postMessage: (r) => sent.push(r) } };
  d.requestBatch([0, 0x24]);
  d.query("rival-query");
  assert.equal(sent.length, 2);
  assert.equal(sent[0].type, "request-batch");
  assert.deepEqual(
    sent[0].requests.map((r) => [r.sequence, r.argument]),
    [
      [1, 0],
      [2, 0x24],
    ],
  );
  assert.equal(sent[1].type, "query");
  assert.equal(sent[1].sequence, 3);
  assert.equal(sent[1].argument, null);
  assert.equal(d.inflight.size, 3);
  assert.equal(d.tokens.get("rival-query"), 3);
  assert.throws(() => d.requestBatch([0, NaN]), /batch/);
  assert.equal(d.sequence, 3);
});
test("ordinary S emits off0/24 and on0 at its reader while mute flag gates later cues", async () => {
  const { game: g } = await originalGame();
  g.scene = "office";
  g.officeMenu = null;
  g.drainEffects();
  g.input({ type: "audio-enabled", enabled: true });
  g.drainEffects();
  g.input({ type: "toggle-sound" });
  assert.equal(g.audioEnabled, false);
  assert.deepEqual(g.drainEffects(), [
    { type: "sound-batch", arguments: [0, 0x24] },
  ]);
  g.input({ type: "toggle-sound" });
  assert.equal(g.audioEnabled, true);
  assert.deepEqual(g.drainEffects(), [{ type: "sound-batch", arguments: [0] }]);
});
test("rival mute changes new-call enable only;actual completion releases the busy loop", () => {
  const r = new RivalReport({
    target: 1,
    variant: 0,
    audioEnabled: true,
    token: "speech",
  });
  r.begin();
  r.setAudioStatus("speech", true);
  r.resumeAudioStatus();
  r.setAudioEnabled(false);
  for (let i = 0; i < 28; i++) assert.equal(r.advanceTick(), false);
  assert.equal(r.busy, true);
  r.setAudioStatus("speech", false);
  for (let i = 0; i < 13; i++) assert.equal(r.advanceTick(), false);
  assert.equal(r.advanceTick(), true);
  assert.equal(r.phase, "speech");
});
test("muted rival can query residual device playback instead of inventing idle", () => {
  const r = new RivalReport({
    target: 1,
    variant: 0,
    audioEnabled: false,
    queryAudio: true,
    token: "query",
  });
  r.begin();
  assert.equal(r.waitingForAudio, true);
  r.setAudioStatus("query", true);
  r.resumeAudioStatus();
  assert.equal(r.phase, "speech");
  assert.equal(r.busy, true);
  r.setAudioStatus("query", false);
  for (let i = 0; i < 14; i++) r.advanceTick();
  assert.equal(r.complete, true);
});
test("speaker query observes a native stop while the legacy restart barrier is active", () => {
  const s = speaker();
  s.requestBatch(batch());
  s.drainEvents();
  const before = s.driver.memory.slice();
  s.query({ sequence: 3, argument: null, token: "query" });
  const ack = s.drainEvents();
  assert.equal(ack.length, 1);
  assert.equal(ack[0].busy, true);
  assert.equal(ack[0].frame, 0);
  assert.deepEqual(s.driver.memory, before);
  assert.equal(s.stats().queuedRequests, 0);
});
test("muted forced-claim caller queries the existing host device and waits for its actual completion", async () => {
  const { game: g } = await originalGame();
  g.hasAudioDevice = () => true;
  g.scene = "flight";
  g.securityPending = false;
  g.departure = { racing: true, from: 0, target: 32 };
  g.flight = {
    memory: g.marketMemory,
    setControls: () => {},
    drainEvents: () => [],
    outcome: { code: 0, day: 7, seed: 40797, money: 0 },
  };
  g.drainEffects();
  g.collectFlight();
  const r = g.claim;
  assert.equal(r.waitingForAudio, true);
  assert.equal(r.statusKnown, false);
  assert.deepEqual(
    g.drainEffects().filter((e) => e.type !== "flushControls"),
    [{ type: "audio-query", token: r.token }],
  );
  g.input({ type: "audio-status", token: r.token, busy: true });
  assert.equal(r.busy, true);
  assert.equal(r.phase, "speech");
  for (let i = 0; i < 14; i++) g.advanceTick();
  assert.equal(g.scene, "rival-claim");
  g.input({ type: "audio-status", token: r.token, busy: false });
  for (let i = 0; i < 14; i++) g.advanceTick();
  assert.equal(g.scene, "map");
  assert.equal(g.campaign.rival.location, 32);
});
test("rapid native batches do not wait for a previous speaker stop to finish", () => {
  const s = speaker(),
    native = new SpeakerDriver(archives.get("IT.DRV")[5].data);
  for (const n of [0, 0x24, 0]) native.request(n);
  s.requestBatch(batch());
  s.requestBatch([{ sequence: 3, argument: 0, token: null }]);
  assert.deepEqual(
    s.drainEvents().map((e) => [e.sequence, e.frame]),
    [
      [1, 0],
      [2, 0],
      [3, 0],
    ],
  );
  assert.equal(s.stats().queuedRequests, 0);
  assert.deepEqual(s.driver.memory, native.memory);
});
test("queued native calls and queries stay ordered without inserting a second stop barrier", () => {
  const s = speaker();
  s.request({ sequence: 1, argument: 0 });
  s.request({ sequence: 2, argument: 1 });
  s.requestBatch(batch(3));
  s.requestBatch([{ sequence: 5, argument: 0, token: null }]);
  s.query({ sequence: 6, argument: null, token: "query" });
  assert.deepEqual(
    s.drainEvents().map((e) => e.sequence),
    [1],
  );
  s.renderFrames(4800);
  const ack = s.drainEvents().filter((e) => e.type === "ack");
  assert.deepEqual(
    ack.map((e) => e.sequence),
    [2, 3, 4, 5, 6],
  );
  assert.equal(new Set(ack.map((e) => e.frame)).size, 1);
  assert.equal(ack.at(-1).busy, true);
  assert.equal(ack[2].accepted, false);
});
