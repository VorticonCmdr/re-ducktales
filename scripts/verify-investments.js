import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import {
  investmentResources,
  initializeInvestments,
  investmentPrice,
} from "../src/game/investments.js";
import build from "../reference/build.json" with { type: "json" };

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function capture(raw, count, physical) {
  assert.equal(raw?.isError, false, "missing or failed original capture");
  const result = JSON.parse(raw.content[0].text);
  assert.equal(result.aborted, false);
  assert.equal(result.results.length, count);
  assert.ok(result.results.every((r) => r.status === "ok"));
  const cpu = result.results[0].registers;
  if (physical !== undefined) assert.equal(cpu.cs * 16 + cpu.eip, physical);
  assert.equal(cpu.ds, 0x1403);
  assert.equal(cpu.ss, 0x1403);
  const bytes = Buffer.from(result.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  assert.equal(result.results[1].addr, 0x14030);
  return { cpu, bytes, results: result.results, m: new FlightMemory(bytes) };
}
export function sameBytes(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label} length`);
  for (let i = 0; i < actual.length; i++)
    assert.equal(actual[i], expected[i], `${label} byte${i.toString(16)}`);
}

export function compareInvestmentInitialization(
  local,
  resources,
  { omitDraw = false, corruptChart = false } = {},
) {
  const before = capture(local.before, 3, 0x3981);
  const after = capture(local.after, 2, 0x3b96);
  const result = initializeInvestments(before.m, resources);
  assert.equal(result.draws, 30);
  if (omitDraw) before.m.i(0x2229, before.m.i(0x2229) + 1);
  if (corruptChart) before.m.b(0x8fa6, before.m.b(0x8fa6) ^ 1);
  assert.equal(result.seed, after.bytes.readUInt16LE(0x2229));
  assert.equal(
    before.m.i(0x2229),
    after.m.i(0x2229),
    "investment RNG divergence",
  );
  sameBytes(
    before.m.bytes.subarray(0x92b2, 0x92b2 + 15 * 46),
    after.bytes.subarray(0x92b2, 0x92b2 + 15 * 46),
    "company records",
  );
  sameBytes(
    before.m.bytes.subarray(0x8fa6, 0x8fa6 + 5 * 31),
    after.bytes.subarray(0x8fa6, 0x8fa6 + 5 * 31),
    "chart divergence",
  );
  assert.equal(before.m.b(0x7162), after.m.b(0x7162));
  const location = capture(local.location, 2, 0x35c7);
  assert.equal(
    location.m.i(0x2229),
    after.m.i(0x2229),
    "market seed must reach location ordering unchanged",
  );
  return 2;
}

export async function verifyInvestments() {
  const manifest = JSON.parse(
    await readFile("reference/investments.json", "utf8"),
  );
  assert.equal(manifest.expectedCheckpointCount, 7);
  assert.equal(Object.keys(manifest.artifacts).length, 9);
  const local = {};
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const bytes = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/investments.md`);
    });
    assert.equal(hash(bytes), artifact.sha256, `corrupt ${artifact.path}`);
    local[key] = JSON.parse(bytes);
  }
  const files = {};
  for (const name of ["DUCKTALE.EXE", "INVEST.ARC", "CHART.ARC"]) {
    files[name] = await readFile(`game/${name}`);
    assert.equal(files[name].length, build.files[name].bytes);
    assert.equal(hash(files[name]), build.files[name].sha256);
  }
  const executable = files["DUCKTALE.EXE"];
  const image = Buffer.from(unpackImage(executable));
  const code = Buffer.from(image.subarray(0x1a31, 0x1c47));
  // EXEPACK relocation table, exactly as the independently retained loader.
  const packedHeader =
    executable.readUInt16LE(8) * 16 + executable.readUInt16LE(22) * 16;
  let cursor = packedHeader + 0x125;
  for (let region = 0; region < 16; region++) {
    const count = executable.readUInt16LE(cursor);
    cursor += 2;
    for (let i = 0; i < count; i++, cursor += 2) {
      const at = region * 65536 + executable.readUInt16LE(cursor) - 0x1a31;
      if (at >= 0 && at + 1 < code.length)
        code.writeUInt16LE((code.readUInt16LE(at) + 0x1f5) & 65535, at);
    }
  }
  const before = capture(local.before, 3, 0x3981);
  sameBytes(
    Buffer.from(before.results[2].data, "base64"),
    code,
    "resident routine identity",
  );
  // Validate the complete actual trading overlay, not the common dispatcher
  // previously seen at the same reusable allocation's entry point.
  const overlay = executable.subarray(0x26e00, 0x26e00 + 5986);
  assert.equal(hash(overlay), manifest.overlay.sha256);
  assert.equal(overlay.readUInt16LE(6), 101);
  const body = Buffer.from(overlay.subarray(512));
  for (let i = 0; i < 101; i++) {
    const reloc = overlay.readUInt16LE(24) + i * 4;
    const at =
      overlay.readUInt16LE(reloc) +
      overlay.readUInt16LE(reloc + 2) * 16 -
      0xc170;
    body.writeUInt16LE((body.readUInt16LE(at) + 0x1f5) & 65535, at);
  }
  assert.equal(local.live.isError, false);
  const map = JSON.parse(local.live.content[0].text);
  assert.equal(map.aborted, false);
  assert.equal(map.results.length, 2);
  assert.ok(map.results.every((r) => r.status === "ok"));
  assert.equal(map.results[1].addr, 0);
  const live = Buffer.from(map.results[1].data, "base64");
  assert.equal(live.length, 0xa0000);
  sameBytes(
    live.subarray(0xe0c0, 0xe0c0 + body.length),
    body,
    "relocated trading overlay",
  );

  const resources = investmentResources(
    parseArchive(files["INVEST.ARC"]),
    parseArchive(files["CHART.ARC"]),
  );
  let checked = compareInvestmentInitialization(local, resources);
  assert.throws(
    () => compareInvestmentInitialization(local, resources, { omitDraw: true }),
    /RNG divergence/,
  );
  assert.throws(
    () =>
      compareInvestmentInitialization(local, resources, { corruptChart: true }),
    /chart divergence/,
  );
  assert.throws(() =>
    compareInvestmentInitialization({ ...local, after: null }, resources),
  );
  for (let i = 0; i < 5; i++) {
    const { m, cpu } = capture(local[`quote${i}`], 2, 0xebbe);
    const company = m.i(cpu.ebp + 6);
    assert.equal(company, 10 + i, "quote sequence skipped or reordered");
    const expected = m.i(cpu.ebp - 4);
    assert.equal(investmentPrice(m, company), expected, `quote${company}`);
    assert.throws(() =>
      assert.equal(investmentPrice(m, company) + 1, expected),
    );
    checked++;
  }
  // Static boundary of IMUL/CWD: low-word overflow followed by minimum-price
  // correction. This is disassembly-derived, not an additional runtime case.
  const boundary = new FlightMemory(new Uint8Array(65536));
  boundary.b(0x4e0e, 1);
  boundary.b(0x8fa6, 100);
  boundary.i(0x92d2, 400);
  assert.equal(investmentPrice(boundary, 0), 1);
  boundary.b(0x8fa6, 0);
  assert.equal(investmentPrice(boundary, 0), 0);
  assert.throws(
    () => investmentPrice(boundary, 15),
    /Invalid investment company/,
  );
  assert.equal(checked, manifest.expectedCheckpointCount);
  console.log(
    "Investments: original initialization, 30 RNG draws, destination seed continuity and five exact quotes; complete relocated code identities, negative controls passed. Browser acceptance is checked separately.",
  );
}
if (process.argv[1]?.endsWith("verify-investments.js"))
  await verifyInvestments();
