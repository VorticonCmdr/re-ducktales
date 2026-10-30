import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "./helpers/original-game.js";
import { SpeakerDriver } from "../src/speaker-driver.js";
import {
  SpeakerGameStream,
  SPEAKER_PIT_HZ,
  SPEAKER_IRQ_CLOCKS,
} from "../src/speaker-game.js";
const { archives } = await originalGame();
const bytes = archives.get("IT.DRV")[5].data;
const stream = () => new SpeakerGameStream(bytes, { sampleRate: 48000 });
function render(s, count, block = 128) {
  const output = new Float32Array(count);
  for (let i = 0; i < count; i += block)
    output.set(s.renderFrames(Math.min(block, count - i)), i);
  return output;
}
test("speaker audio block partition preserves PCM, native memory, and IRQ accounting", () => {
  const a = stream(),
    b = stream(),
    native = new SpeakerDriver(bytes);
  for (const s of [a, b]) s.request({ sequence: 1, argument: 9 });
  native.request(9);
  const pcm = render(a, 48000, 128);
  assert.deepEqual(pcm, render(b, 48000, 6001));
  const interrupts = Math.floor(SPEAKER_PIT_HZ / SPEAKER_IRQ_CLOCKS);
  for (let i = 0; i < interrupts; i++) native.interrupt();
  assert.equal(a.driver.interrupts, interrupts);
  assert.deepEqual(a.driver.memory, native.memory);
  assert.deepEqual(a.stats(), b.stats());
  assert.equal(a.stats().acknowledgements + a.stats().chains, interrupts);
  assert.ok(pcm.some((v) => v !== 0));
  assert.deepEqual(a.drainEvents(), b.drainEvents());
  // Negative control: missing a required request changes both state and signal.
  const omitted = stream();
  assert.notDeepEqual(render(omitted, 48000), pcm);
  assert.notDeepEqual(omitted.driver.memory, a.driver.memory);
});
test("speaker reset barrier retains ordered starts and rejects duplicate queued tokens", () => {
  const s = stream();
  s.request({ sequence: 1, argument: 0 });
  s.request({ sequence: 2, argument: 1, token: "title" });
  assert.throws(
    () => s.request({ sequence: 3, argument: 71, token: "title" }),
    /duplicate/,
  );
  assert.equal(s.drainEvents().length, 1);
  render(s, 4800);
  const ack = s.drainEvents();
  assert.equal(ack.length, 1);
  assert.equal(ack[0].sequence, 2);
  assert.equal(ack[0].accepted, true);
  assert.ok(ack[0].frame > 0);
  assert.equal(s.stats().queuedRequests, 0);
  s.request({ sequence: 3, argument: 0 });
  render(s, 4800);
  const completion = s.drainEvents().find((e) => e.type === "complete");
  assert.equal(completion.token, "title");
  assert.equal(completion.busy, false);
  assert.equal(s.stats().pendingTokens, 0);
});
test("speaker engine consumes original speed words and finite cue completion without WAV duration", () => {
  const s = stream();
  s.request({ sequence: 1, argument: 0x2808 });
  assert.equal(s.driver.w(0x2a5), 0);
  s.request({ sequence: 2, argument: 9 });
  render(s, 4800);
  assert.equal(s.stats().engineActive, true);
  s.request({ sequence: 3, argument: 0x2808 });
  render(s, 4800);
  assert.equal(s.stats().speedWord, 0x2808);
  s.request({ sequence: 4, argument: 0 });
  s.request({ sequence: 5, argument: 71, token: "entry" });
  let complete;
  for (let i = 0; i < 1000 && !complete; i++) {
    s.renderFrames(1024);
    complete = s
      .drainEvents()
      .find((e) => e.type === "complete" && e.token === "entry");
  }
  assert.ok(complete, "required entry completion missing");
  assert.equal(complete.busy, false);
  assert.equal(s.stats().pendingTokens, 0);
  assert.throws(() => s.request({ sequence: 6, argument: 65536 }), /word/);
  assert.throws(() => s.renderFrames(0), /frame/);
});
