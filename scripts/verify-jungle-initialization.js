import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import { nextRandom, u16 } from "../src/game/integer.js";
import {
  initializeJungleFish,
  initializeJungleVines,
  initializeJungleBonus,
} from "../src/game/jungle-initialization.js";

function decode(raw, cs, ip) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, 2);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.deepEqual([cpu.cs, cpu.eip, cpu.ds, cpu.ss], [cs, ip, 0x1403, 0x1403]);
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes };
}
export async function verifyJungleInitialization() {
  const manifest = JSON.parse(
    await readFile("reference/jungle-initialization.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 2);
  assert.equal(manifest.expectedCheckpointCount, 2);
  assert.equal(manifest.expectedInputCount, 0);
  assert.equal(manifest.expectedFishRngDraws, 17);
  assert.deepEqual(manifest.inputEvents, []);
  assert.equal(manifest.codeIdentityManifest, "reference/jungle-motion.json");
  assert.deepEqual(manifest.cases, [
    {
      id: "fish",
      cs: 0x111b,
      beforeIP: 0xd4,
      afterIP: 0x1f1,
      beforeStop: 219,
      afterStop: 220,
      stackExclusion: [0x9e44, 0x9e6e],
    },
    {
      id: "bonus",
      cs: 0xe0c,
      beforeIP: 0x2013,
      afterIP: 0x208f,
      beforeStop: 221,
      afterStop: 222,
      stackExclusion: [0x9e66, 0x9e6e],
    },
  ]);
  const local = {};
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const raw = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/jungle.md`);
    });
    assert.equal(
      createHash("sha256").update(raw).digest("hex"),
      artifact.sha256,
      `corrupt ${artifact.path}`,
    );
    local[key] = JSON.parse(raw);
  }
  assert.equal(Object.keys(local).length, 4, "missing initialization artifact");
  function compare({
    omitCase = false,
    loseRng = false,
    alterResult = false,
  } = {}) {
    let executed = 0;
    for (const c of manifest.cases) {
      if (omitCase && c.id === "bonus") continue;
      const before = decode(local[c.id + "-before"], c.cs, c.beforeIP),
        after = decode(local[c.id + "-after"], c.cs, c.afterIP),
        m = new FlightMemory(before.bytes);
      assert.equal(before.cpu.esp, 0x9e6e);
      assert.equal(after.cpu.ebp, before.cpu.esp - 2);
      if (c.id === "fish") {
        assert.equal(m.i(0x882c), 16);
        initializeJungleFish(m);
        let seed = u16(before.bytes.readInt16LE(0x2229));
        for (let draw = 0; draw < 17; draw++) seed = nextRandom(seed);
        assert.equal(
          u16(after.bytes.readInt16LE(0x2229)),
          seed,
          "original fish RNG draw count",
        );
        if (loseRng) m.i(0x2229, before.bytes.readInt16LE(0x2229));
      } else initializeJungleBonus(m);
      if (alterResult && c.id === "bonus") after.bytes[0x54fa] ^= 1;
      for (const [start, end] of [
        [0, c.stackExclusion[0]],
        [c.stackExclusion[1], 65536],
      ])
        assert.deepEqual(
          Buffer.from(m.bytes.subarray(start, end)),
          after.bytes.subarray(start, end),
          `${c.id}: initialization DS divergence`,
        );
      executed++;
    }
    assert.equal(executed, 2, "unfinished initialization cases");
  }
  compare();
  assert.throws(
    () => compare({ omitCase: true }),
    /unfinished initialization cases/,
  );
  assert.throws(
    () => compare({ loseRng: true }),
    /initialization DS divergence/,
  );
  assert.throws(
    () => compare({ alterResult: true }),
    /initialization DS divergence/,
  );
  const fresh = () =>
    new FlightMemory(decode(local["fish-before"], 0x111b, 0xd4).bytes);
  const invalid = fresh();
  invalid.i(0x882c, 0);
  assert.throws(() => initializeJungleFish(invalid), /fish count/);
  invalid.i(0x882c, 16);
  invalid.i(0x5150, 0);
  assert.throws(() => initializeJungleFish(invalid), /fish type/);
  // Static-rule boundary checks remain separate from original comparisons.
  for (const [difficulty, wait] of [
    [0, 350],
    [1, 200],
    [2, 100],
  ]) {
    const m = fresh();
    m.b(0x8990, difficulty);
    initializeJungleBonus(m);
    assert.equal(m.i(0x54fa), wait);
  }
  const vines = fresh(),
    saved = Buffer.from(vines.bytes);
  initializeJungleVines(vines);
  for (let id = 0; id < 10; id++) {
    const at = 0x5d40 + id * 34;
    assert.equal(vines.i(at + 18), saved.readInt16LE(at + 12));
    assert.equal(
      vines.i(at + 20),
      ((saved.readInt16LE(at + 14) + saved.readInt16LE(at + 16)) << 16) >> 16,
    );
    assert.equal(vines.i(at + 12), saved.readInt16LE(at + 12));
    assert.equal(vines.i(at + 16), saved.readInt16LE(at + 16));
  }
  console.log(
    "Jungle initialization: 2 exact conditional original fish/bonus reset cases; complete DS except42/8 stack bytes,17 original RNG draws retained; three negative controls. Vines/difficulty boundaries have static checks. Complete hazard/scene initialization remains unfinished.",
  );
}
