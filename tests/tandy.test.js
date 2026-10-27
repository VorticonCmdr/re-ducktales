import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import {
  TandyTones,
  TandyPlayback,
  renderTandyPreview,
} from "../src/tandy-preview.js";

test("Tandy tone counter gives clock/(32*period), with 2dB attenuation", () => {
  const chip = new TandyTones({ periods: [427, 1, 1], counters: [427, 1, 1] });
  chip.write(0x90);
  let last = chip.sample(),
    transitions = 0;
  assert.equal(last, -0.18); // NCR negation, with the authored initial output1.
  for (let i = 1; i < 44100; i++) {
    const sample = chip.sample();
    if (Math.sign(last) !== Math.sign(sample)) transitions++;
    last = sample;
  }
  assert.equal(transitions, 523); // floor(3579545/(16*427)) in one second
  chip.write(0x91);
  assert.ok(Math.abs(Math.abs(chip.sample()) / 0.18 - 10 ** (-2 / 20)) < 1e-12);
  chip.write(0x9f);
  assert.equal(chip.sample(), 0);
});

test("Tandy invalid device inputs fail explicitly", () => {
  assert.throws(() => new TandyTones({ sampleRate: 0 }), /sample rate/);
  const chip = new TandyTones();
  assert.throws(() => chip.write(256), /register byte/);
  assert.throws(() => new TandyTones({ noise: {} }), /noise state/);
  assert.throws(() => chip.advanceClocks(-1), /clock count/);
  chip.write(0xe0);
  chip.write(0xf0);
  assert.ok(Number.isFinite(chip.sample()));
  chip.write(0xff);
  chip.write(0x80);
  chip.write(0);
  assert.ok(Number.isFinite(chip.sample()));
  assert.equal(chip.digitalState().periods[0], 1024);
});

test("original Tandy036 ends after six ticks with exact sequence writes", async () => {
  const bytes = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
  const result = renderTandyPreview(bytes, 36);
  assert.equal(result.ticks, 6);
  assert.equal(result.pcm.length, 3027);
  assert.equal(result.duration, 3027 / 44100);
  assert.equal(result.truncated, false);
  assert.equal(result.approximate, true);
  assert.deepEqual(result.biosFlags, Array(6).fill(0xf7));
  assert.deepEqual(
    result.bus
      .filter((w) => w.tick >= 0)
      .map(({ tick, port, value }) => [tick, port, value]),
    [
      [0, 192, 148],
      [0, 192, 139],
      [0, 192, 26],
      [2, 192, 133],
      [2, 192, 13],
      [4, 192, 138],
      [4, 192, 6],
      [5, 192, 159],
    ],
  );
  assert.ok(result.pcm.every(Number.isFinite));
  assert.ok(result.pcm.some((v) => v > 0) && result.pcm.some((v) => v < 0));

  assert.throws(
    () => renderTandyPreview(bytes, 121),
    /Unsupported Tandy public sound ID/,
  );
  const engine = new TandyDriver(bytes, { writePort() {} });
  engine.reset(0);
  engine.start(0x4008);
  engine.processTick({ clearBiosFlags() {} });
  assert.equal(engine.word(0x2e6), 0x4008);
  assert.equal(renderTandyPreview(bytes, 8).pcm.length, 0);
});

test("original pitch deltas are big-endian and both complete cues terminate", async () => {
  const bytes = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
  for (const [id, delta, period] of [
    [67, 65535, 16],
    [68, 1, 30],
  ]) {
    const d = new TandyDriver(bytes, { writePort() {} });
    d.reset(0);
    d.start(id);
    for (let i = 0; i < 16; i++) d.processTick({ clearBiosFlags() {} });
    // Native fixtures67/68, checkpoint16; these values catch a little-endian
    // interpretation even when the negative delta's ff/ff bytes are symmetric.
    assert.equal(d.word(0x1ef), delta);
    assert.equal(d.word(0x1d9), period);
    const preview = renderTandyPreview(bytes, id);
    assert.equal(preview.ticks, 17);
    assert.equal(preview.pcm.length, 9686);
    assert.equal(preview.bus.length, 42);
    assert.equal(preview.truncated, false);
    assert.ok(preview.pcm.every(Number.isFinite));
  }
});

test("falling Tandy envelopes preserve the original nonzero-target quirk", async () => {
  const bytes = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
  const d = new TandyDriver(bytes, {
    writePort() {
      throw Error("unexpected I/O");
    },
  });
  const at = 0x1d1;
  d.byte(0x1b3, 0);
  d.byte(at + 10, 3);
  d.byte(at + 11, 90);
  d.byte(at + 12, 3);
  d.byte(at + 15, 246);
  d.byte(at + 16, 100);
  d.word(at + 13, 0x5000);
  d.byte(0x5004, 2);
  d.processEnvelope(at);
  assert.equal(d.byte(at + 16), 100);
  assert.equal(d.byte(at + 10), 4);
  assert.equal(d.byte(at + 11), 2);
  d.byte(at + 10, 3);
  d.byte(at + 11, 0);
  d.byte(at + 16, 5);
  d.processEnvelope(at);
  assert.equal(d.byte(at + 16), 0);
  assert.equal(d.byte(at + 10), 0);
  assert.equal(d.byte(0x2c1), 255);
});

test("complete original noise cues and zero-period cue render finite PCM", async () => {
  const bytes = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
  for (const [id, ticks, samples] of [
    [10, 3, 1211],
    [35, 3, 1211],
    [69, 195, 117449],
  ]) {
    const r = renderTandyPreview(bytes, id);
    assert.equal(r.ticks, ticks);
    assert.equal(r.pcm.length, samples);
    assert.equal(r.truncated, false);
    assert.equal(r.approximate, true);
    assert.ok(r.pcm.every(Number.isFinite));
    assert.ok(r.pcm.some((v) => v !== 0));
  }
});

test("Tandy device clock is independent of render block boundaries", async () => {
  const bytes = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
  const a = new TandyPlayback(bytes),
    b = new TandyPlayback(bytes);
  a.start(9);
  b.start(9);
  const full = a.renderFrames(556).pcm;
  const parts = [
    b.renderFrames(1).pcm,
    b.renderFrames(127).pcm,
    b.renderFrames(428).pcm,
  ];
  assert.deepEqual(Float32Array.from(parts.flatMap((p) => [...p])), full);
  assert.deepEqual(a.driver.memory, b.driver.memory);
  assert.deepEqual(a.chip.digitalState(), b.chip.digitalState());
  assert.equal(a.interrupts, 12);
  assert.equal(a.ticks, 1);
  assert.equal(a.clock, 1);
  assert.equal(a.chains, 1);
  assert.equal(a.acks, 11);
  assert.equal(a.driver.byte(0x1ca), 12);
  assert.equal(a.driver.byte(0x2dd), 40);
});

test("unknown Tandy command paths stop explicitly", async () => {
  const bytes = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
  const d = new TandyDriver(bytes, { writePort() {} });
  d.reset(0);
  d.start(36);
  d.word(0x1d1, 0x3000);
  d.byte(0x3000, 0xab);
  assert.throws(
    () => d.processTick({ clearBiosFlags() {} }),
    /Unsupported Tandy command ab/,
  );
});
