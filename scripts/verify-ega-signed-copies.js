// Conditional original primitive execution. No elapsed-time or pixel claim.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { egaSignedCopyWork } from "./lib/ega-signed-copy-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/ega-signed-copy-work.json")),
  data = {};
assert.equal(m.id, "original-ega-signed-copy-work");
assert.equal(m.expectedCases, 16);
assert.equal(m.expectedNegativeControls, 8);
assert.equal(Object.keys(m.artifacts).length, 23);
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing signed-copy evidence " + s.path);
  });
  assert.equal(b.length, s.bytes, "Corrupt signed-copy evidence size");
  assert.equal(sha(b), s.sha256, "Corrupt signed-copy evidence");
  data[role] = role === "source" ? b : JSON.parse(b);
}
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, "Changed signed-copy source " + p);
const driver = Buffer.from(parseArchive(await readFile("game/IT.DRV"))[1].data);
assert.equal(sha(await readFile("game/IT.DRV")), m.containerSHA256);
assert.equal(sha(await readFile("game/DUCKTALE.EXE")), m.executableSHA256);
assert.equal(sha(driver), m.driverSHA256);
assert.equal(driver.length, 2599);
let next = 0x1ef;
const instructionIPs = new Set();
for (const i of data.disassembly.instructions) {
  const ip = parseInt(i.address.split(":").at(-1), 16);
  assert.equal(ip, next, "Copy instruction coverage gap");
  assert.equal(
    driver.subarray(ip, ip + i.length).toString("hex"),
    i.bytes,
    "Original copy opcode",
  );
  instructionIPs.add(ip);
  next += i.length;
}
assert.equal(next, 0x35d);
assert.equal(data.disassembly.truncated, false);
assert.equal(data.capture.completed, true);
assert.equal(data.capture.caseCount, 16);
assert.equal(data.capture.driverSHA256, sha(driver));
assert.equal(data.capture.captureToolSHA256, sha(data.source));
assert.equal(data.capture.pid, data.engine.pid);
assert.equal(data.capture.instanceId, data.engine.instance_id);
assert.equal(data.engine.capabilities.debugger.limits.effective_core, "normal");
assert.equal(data.allocations.length, 4);
for (let i = 0; i < 4; i++)
  assert.equal(
    data.allocations[i].addr,
    [
      data.capture.segment,
      data.capture.sourceSegment,
      data.capture.destinationSegment,
      data.capture.jumpSegment,
    ][i] * 16,
  );
assert.equal(data.configuration.headless, true);
assert.equal(data.configuration.mute, true);
assert.equal(data.configuration.isolatedConfiguration, true);
assert.notEqual(data.configuration.port, 8386);
assert.match(data.configuration.binary.sha256, /^[0-9a-f]{64}$/);
assert.ok(data.configuration.binary.bytes > 0);
assert.equal(data.configuration.bridgeFiles.length, 3);
for (const f of data.configuration.bridgeFiles) {
  assert.match(f.sha256, /^[0-9a-f]{64}$/);
  assert.ok(f.bytes > 0);
}
assert.deepEqual(data.configuration.argv.slice(0, 7), [
  data.configuration.binary.path,
  "--noprimaryconf",
  "--nolocalconf",
  "--set",
  "webserver_enabled=true",
  "--set",
  `webserver_port=${data.configuration.port}`,
]);
const repIPs = new Set([0x313, 0x325, 0x329]);
function observedWork(trace) {
  assert.ok(trace.length > 0, "No original copy instructions");
  assert.equal(trace[0][0], 0x1ef);
  let instructions = 0,
    repeatOpcodes = 0,
    repeatIterations = 0,
    portWrites = 0;
  for (let i = 0; i < trace.length; i++) {
    const [ip, cx] = trace[i];
    assert.ok(instructionIPs.has(ip), "Unsupported copy instruction");
    assert.ok(
      Number.isInteger(cx) && cx >= 0 && cx <= 65535,
      "Invalid recorded CX",
    );
    instructions++;
    if (driver[ip] === 0xef) portWrites++;
    if (repIPs.has(ip)) {
      repeatOpcodes++;
      repeatIterations += cx;
      // Verified debugger behavior: one REP iteration per step;zero CX still
      // visits the instruction once. This normalization does not use model counts.
      for (let n = cx - 1; n > 0; n--) {
        i++;
        assert.deepEqual(trace[i], [ip, n], "Unfinished REP sequence");
      }
      assert.ok(
        trace[i + 1] && trace[i + 1][0] !== ip,
        "Unfinished REP sequence",
      );
      assert.equal(trace[i + 1][1], 0, "REP left unconsumed count");
    }
  }
  return { instructions, portWrites, repeatOpcodes, repeatIterations };
}
function compare(records = data, cases = data.inputs.cases) {
  assert.equal(cases.length, 16, "Missing required signed-copy cases");
  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const event = cases[i],
      r = records["case-" + String(i).padStart(2, "0")];
    assert.equal(r.index, i);
    assert.deepEqual(r.input, event, "Native copy input changed");
    const from = event.sourceVideo ? 0x2000 : 0x2020,
      to = event.destinationVideo ? 0x2000 : 0x2040;
    assert.deepEqual(r.args, [
      event.height,
      event.width,
      event.destinationY,
      event.destinationX,
      to,
      event.sourceY,
      event.sourceX,
      from,
    ]);
    assert.equal(r.entry.protected_mode, false);
    assert.equal(r.entry.registers.cs, data.capture.segment);
    assert.equal(r.entry.registers.eip, 0x1ef);
    assert.equal(r.entry.registers.esp, 0xfedc);
    assert.equal(r.final.registers.cs, data.capture.segment);
    assert.equal(r.final.registers.eip, 0x401f);
    assert.equal(r.final.registers.esp, 0xfef0);
    assert.equal(r.final.registers.flags & 0x600, 0);
    assert.equal(r.final.protected_mode, false);
    const actual = observedWork(r.trace),
      expected = egaSignedCopyWork(event);
    assert.deepEqual(actual, expected, "Native copy work differs");
    const expectedPorts = [];
    if (actual.portWrites) {
      if (event.sourceVideo)
        expectedPorts.push({ ip: 0x243, port: 0x3ce, word: 5 });
      if (event.destinationVideo)
        for (const [ip, word] of [
          [0x254, 5],
          [0x258, 0xff08],
          [0x25c, 1],
          [0x260, 0],
        ])
          expectedPorts.push({ ip, port: 0x3ce, word });
      for (let plane = 0; plane < 4; plane++) {
        if (event.sourceVideo)
          expectedPorts.push({
            ip: 0x2fb,
            port: 0x3ce,
            word: (plane << 8) | 4,
          });
        if (event.destinationVideo)
          expectedPorts.push({
            ip: 0x30d,
            port: 0x3c4,
            word: ((1 << plane) << 8) | 2,
          });
      }
    }
    assert.deepEqual(r.ports, expectedPorts, "Native copy ports differ");
    assert.equal(r.ports.length, actual.portWrites);
    const expectedDriver = Buffer.from(driver);
    expectedDriver.writeUInt16LE(0x2000, 0x1e);
    // Only four self-modified immediate words. Early clipping returns before
    // any operand modification. These are source-defined changes,not exclusions.
    if (actual.portWrites || actual.repeatOpcodes) {
      for (const [at, value] of [
        [0x341, 8000],
        [0x34b, 8000],
        [0x331, 40 - (event.width >>> 3)],
        [0x32d, 40 - (event.width >>> 3)],
      ])
        expectedDriver.writeUInt16LE(value & 65535, at);
    }
    assert.equal(r.driver.aborted, false);
    assert.equal(r.driver.results.length, 1);
    assert.equal(r.driver.results[0].status, "ok");
    assert.deepEqual(
      Buffer.from(r.driver.results[0].data, "base64"),
      expectedDriver,
      "Original copy code changed",
    );
    results.push({ case: i, ...actual });
  }
  return results;
}
const results = compare();
const bad = structuredClone(data);
bad["case-02"].trace.find((v) => v[0] === 0x325)[1]++;
assert.throws(() => compare(bad), /REP sequence/);
const ports = structuredClone(data);
ports["case-00"].ports[0].word ^= 1;
assert.throws(() => compare(ports), /ports differ/);
const code = structuredClone(data);
const bytes = Buffer.from(code["case-00"].driver.results[0].data, "base64");
bytes[0x1ef] ^= 1;
code["case-00"].driver.results[0].data = bytes.toString("base64");
assert.throws(() => compare(code), /code changed/);
assert.throws(
  () => compare(data, data.inputs.cases.slice(1)),
  /Missing required/,
);
const input = structuredClone(data.inputs.cases);
input[0].sourceY = 1;
assert.throws(() => compare(data, input), /input changed/);
const empty = structuredClone(data);
empty["case-00"].trace = [];
assert.throws(() => compare(empty), /No original/);
const unsupported = structuredClone(data);
unsupported["case-00"].trace.push([0, 0]);
assert.throws(() => compare(unsupported), /Unsupported copy instruction/);
const unfinished = structuredClone(data);
unfinished["case-02"].trace.splice(
  unfinished["case-02"].trace.findIndex(([ip]) => ip === 0x325) + 1,
  1,
);
assert.throws(() => compare(unfinished), /REP sequence/);
console.log(
  JSON.stringify(
    {
      scope:
        "Conditional original primitive instructions/OUT/REP counts,not pixels/natural cadence/browser acceptance",
      cases: results.length,
      negativeControls: 8,
      results,
    },
    null,
    2,
  ),
);
