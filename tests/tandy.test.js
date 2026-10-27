import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import { TandyTones, renderTandyPreview } from "../src/tandy-preview.js";

test("Tandy tone counter gives clock/(32*period), with 2dB attenuation", () => {
  const chip = new TandyTones({ periods: [427, 1, 1], counters: [427, 1, 1] });
  chip.write(0x90);
  let last = chip.sample(),
    transitions = 0;
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

test("Tandy unsupported chip paths and invalid inputs fail explicitly", () => {
  assert.throws(() => new TandyTones({ sampleRate: 0 }), /sample rate/);
  const chip = new TandyTones();
  assert.throws(() => chip.write(256), /register byte/);
  assert.throws(() => chip.write(0xe0), /noise synthesis/);
  chip.write(0xf0);
  assert.throws(() => chip.sample(), /noise channel/);
  chip.write(0xff);
  chip.write(0x80);
  chip.write(0);
  assert.throws(() => chip.sample(), /zero-period/);
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
  assert.throws(() => renderTandyPreview(bytes, 35), /supports sound036 only/);
  const engine = new TandyDriver(bytes, { writePort() {} });
  engine.reset(0);
  engine.start(0x4008);
  assert.throws(
    () => engine.processTick({ clearBiosFlags() {} }),
    /engine sequencing is not implemented/,
  );
});
