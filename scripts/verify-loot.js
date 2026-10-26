import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { assignLoot, parseLoot } from "../src/game/campaign.js";
import { parseArchive } from "../src/assets.js";
function capture(raw, ip, count) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.equal(cpu.cs * 16 + cpu.eip, 0x1f5 * 16 + ip);
  assert.equal(cpu.ds, 0x1403);
  assert.equal(cpu.ss, 0x1403);
  const ds = Buffer.from(r.results[1].data, "base64");
  assert.equal(ds.length, 65536);
  if (count === 3)
    assert.equal(
      Buffer.from(r.results[2].data, "base64").toString("hex"),
      "558becb868009a9e1e0306c746fa0000",
    );
  return ds;
}
export function compareLoot(
  local,
  loot,
  { omitDraw = false, alterId = false } = {},
) {
  const b = capture(local.before, 0x18b4, 3),
    a = capture(local.after, 0x1a30, 2);
  // All routine inputs come from the BEFORE state, independent of outputs.
  const locations = Array.from({ length: 35 }, (_, i) => ({
    treasure: b.readUInt16LE(0x721c + i * 40),
  }));
  const seed = b.readUInt16LE(0x2229);
  const result = assignLoot(locations, seed);
  if (omitDraw) result.seed = seed;
  if (alterId) result.locations[1].treasure++;
  assert.equal(result.draws, 20, "unexpected loot RNG count");
  assert.equal(result.seed, a.readUInt16LE(0x2229), "loot RNG divergence");
  assert.equal(result.atomicLocation, a[0x5fbe], "atomic location divergence");
  for (let i = 1; i < 35; i++) {
    const id = result.locations[i].treasure;
    assert.equal(
      id,
      a.readUInt16LE(0x721c + i * 40),
      `loot ID divergence at slot${i}`,
    );
    assert.equal(
      id - 1,
      a.readUInt16LE(0x6f52 + i * 6),
      `loot resource divergence at slot${i}`,
    );
    assert.equal(
      loot[id - 1].value,
      a.readInt16LE(0x6f54 + i * 6),
      `loot value divergence at slot${i}`,
    );
  }
  return 1;
}
export async function verifyLoot() {
  const m = JSON.parse(
    await readFile("reference/loot-initialization.json", "utf8"),
  );
  assert.equal(m.expectedCheckpointCount, 1);
  assert.equal(Object.keys(m.artifacts).length, 2);
  const local = {};
  for (const [key, f] of Object.entries(m.artifacts)) {
    const bytes = await readFile(f.path).catch(() => {
      throw Error(`SETUP: missing ${f.path}; see docs/treasure-assignment.md`);
    });
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      f.sha256,
      `corrupt ${f.path}`,
    );
    local[key] = JSON.parse(bytes);
  }
  const build = JSON.parse(await readFile("reference/build.json", "utf8"));
  const bytes = await readFile("game/LOOT.ARC");
  assert.equal(bytes.length, build.files["LOOT.ARC"].bytes);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    build.files["LOOT.ARC"].sha256,
  );
  const loot = parseLoot(parseArchive(bytes, "LOOT.ARC"));
  assert.equal(compareLoot(local, loot), m.expectedCheckpointCount);
  assert.throws(
    () => compareLoot(local, loot, { omitDraw: true }),
    /loot RNG divergence/,
  );
  assert.throws(
    () => compareLoot(local, loot, { alterId: true }),
    /loot ID divergence/,
  );
  assert.throws(() => compareLoot({ ...local, after: null }, loot));
  console.log(
    "Loot initialization: 34 exact IDs/resources/values, RNG and special location; 1 conditional checkpoint, 3 negative controls.",
  );
}
if (process.argv[1]?.endsWith("verify-loot.js")) await verifyLoot();
