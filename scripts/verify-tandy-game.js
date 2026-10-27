import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { flightEngineArgument } from "../src/game/flight.js";
import { runTandyGameCase } from "./tandy-game-runner.js";
import input from "../reference/tandy-game-inputs.json" with { type: "json" };
import expected from "../reference/tandy-game.json" with { type: "json" };
import build from "../reference/build.json" with { type: "json" };
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(sha(await readFile(expected.inputs)), expected.inputsSHA256);
assert.equal(
  sha(await readFile("scripts/tandy-game-runner.js")),
  expected.runnerSHA256,
);
assert.deepEqual(input.environment, {
  sampleRate: 44100,
  port61: 0,
  firstInterruptFrame: 0,
  sequencerDivider: 12,
  virtualClock: 0,
  biosFlags: 0,
  chip: "Default TandyPlayback/NCR8496 digital initial state, as pinned by reference/tandy-psg.json; output gain/phase is a provider choice, not a recovered original machine phase.",
});
const files = {};
for (const name of ["IT.DRV", "DUCKTALE.EXE"]) {
  files[name] = await readFile(`game/${name}`).catch(() => {
    throw Error(`SETUP: missing game/${name}; see docs/tandy-audio.md`);
  });
  assert.equal(sha(files[name]), build.files[name].sha256, `corrupt ${name}`);
}
const bytes = parseArchive(files["IT.DRV"], "IT.DRV")[4].data;
assert.equal(sha(bytes), expected.driverSHA256);
const source = expected.staticSource,
  exe = files["DUCKTALE.EXE"];
assert.equal(exe.readUInt16LE(0x12c00), 0x5a4d);
assert.equal(exe.readUInt16LE(0x12c00 + 26), 4);
assert.equal(exe.readUInt16LE(0x12c00 + 8) * 16, 1024);
assert.equal(source.flightBodyOffset, 0x13000);
for (const c of [source.engineStart, source.speedRequest])
  assert.equal(
    sha(
      exe.subarray(
        source.flightBodyOffset + c.offset,
        source.flightBodyOffset + c.offset + c.length,
      ),
    ),
    c.sha256,
  );
const image = unpackImage(exe),
  conversion = source.conversion;
assert.equal(conversion.imageOffset, 0x93a2);
assert.equal(
  sha(
    image.subarray(
      conversion.imageOffset,
      conversion.imageOffset + conversion.length,
    ),
  ),
  conversion.sha256,
);
assert.equal(exe.readUInt16LE(source.flightBodyOffset + 0x1df), 9);
assert.deepEqual(
  exe.subarray(
    source.flightBodyOffset + 0x21f,
    source.flightBodyOffset + 0x225,
  ),
  Buffer.from([0xb1, 11, 0xd3, 0xe0, 0x0c, 8]),
);
// Original compiler helper ORs the saved control word with0c00 (truncate),
// converts to an integer through the software-FPU escape, then returns the low32 bits in DX:AX.
assert.deepEqual(
  Buffer.from(image.subarray(0x93a2 + 19, 0x93a2 + 22)),
  Buffer.from([0x80, 0xcc, 12]),
);
assert.deepEqual(
  Buffer.from(image.subarray(0x93a2 + 29, 0x93a2 + 33)),
  Buffer.from([0xcd, 0x3b, 0x7e, 0xf4]),
);
assert.equal(input.flightConversions.length, 11);
for (const c of input.flightConversions)
  assert.equal(flightEngineArgument(c.speed), c.argument);

function compare(stream = input, golden = expected, chunk = 256) {
  assert.equal(stream.cases.length, 3, "missing game replay");
  assert.equal(golden.cases.length, 3, "missing game replay");
  const actual = stream.cases.map((c) =>
    runTandyGameCase(bytes, c, stream.environment, chunk),
  );
  const counts = {
    cases: actual.length,
    inputs: actual.reduce((n, c) => n + c.inputs, 0),
    checkpoints: actual.reduce((n, c) => n + c.checkpoints.length, 0),
    completions: actual.reduce(
      (n, c) => n + c.events.filter((e) => e.type === "complete").length,
      0,
    ),
    flightConversions: stream.flightConversions.length,
  };
  assert.deepEqual(
    counts,
    {
      cases: 3,
      inputs: 13,
      checkpoints: 16,
      completions: 6,
      flightConversions: 11,
    },
    "game replay counts",
  );
  assert.deepEqual(golden.counts, counts, "game replay counts");
  assert.deepEqual(
    actual,
    golden.cases,
    "game replay checkpoint/event divergence",
  );
  return actual;
}
compare();
compare(input, expected, 127); // Native audio blocks must not change the stream.
const missing = structuredClone(expected);
missing.cases.pop();
assert.throws(() => compare(input, missing), /missing game replay/);
const pcm = structuredClone(expected);
pcm.cases[0].checkpoints.at(-1).pcmSHA256 = "0".repeat(64);
assert.throws(() => compare(input, pcm), /game replay checkpoint/);
const omitted = structuredClone(input);
omitted.cases[0].events.shift();
assert.throws(() => compare(omitted), /game replay counts/);
const skipped = structuredClone(expected);
skipped.cases[1].checkpoints.pop();
assert.throws(() => compare(input, skipped), /game replay checkpoint/);
const completion = structuredClone(expected);
completion.cases[0].events.find((e) => e.type === "complete").busy = true;
assert.throws(() => compare(input, completion), /game replay checkpoint/);
const late = structuredClone(input);
late.cases[0].events.push({ frame: 100000, argument: 0 });
assert.throws(() => compare(late), /unconsumed Tandy game inputs/);
const unfinished = structuredClone(input);
unfinished.cases[0].frames = 100;
assert.throws(() => compare(unfinished), /unconsumed Tandy game inputs/);
console.log(
  "Tandy game: 3 carried provider routes, 13 consumed requests, 16 exact checkpoints, 6 completion events, 11 static flight-word boundaries and 7 negative controls; independent chunk sizes agree. Port/provider regression, not original full-game audio or IRQ-phase parity.",
);
