// Strict conditional native line-work evidence. No elapsed-time/pixel claim.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import {
  egaDriverLineWork,
  egaLinePrimitiveWork,
} from "./lib/ega-line-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/ega-line-work.json"));
assert.equal(m.expectedCases, 32);
assert.equal(m.expectedInstructions, 3722);
assert.equal(
  Object.keys(m.artifacts).length,
  39,
  "Unexpected line artifact inventory",
);
const artifacts = {};
for (const [role, spec] of Object.entries(m.artifacts)) {
  const b = await readFile(spec.path).catch(() => {
    throw Error(
      `SETUP: missing line evidence ${spec.path};see docs/ega-line-work.md`,
    );
  });
  assert.equal(b.length, spec.bytes, `Corrupt ${role} size`);
  assert.equal(sha(b), spec.sha256, `Corrupt ${role}`);
  artifacts[role] = role === "capture-source" ? b : JSON.parse(b);
}
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, `Changed line evidence source ${p}`);
const { archives, image } = await originalGame();
const driver = archives.get("IT.DRV")[1].data;
assert.equal(driver.length, 2599);
assert.equal(sha(driver), m.driverSHA256);
const a = artifacts.capture;
assert.equal(a.completed, true);
assert.equal(a.caseCount, 32);
assert.equal(a.segment * 16, artifacts.allocation.addr);
assert.equal(a.captureToolSHA256, sha(artifacts["capture-source"]));
assert.equal(a.pid, artifacts.engine.pid);
assert.equal(a.instanceId, artifacts.engine.instance_id);
assert.equal(
  artifacts.engine.capabilities.debugger.limits.effective_core,
  "normal",
);
const dis = artifacts.disassembly;
assert.equal(dis.success, true);
assert.equal(dis.truncated, false);
assert.equal(dis.bytes_disassembled, 778);
assert.equal(dis.program, "ducktales-ega-driver.bin");
function checkInstructions(list) {
  let next = 0x515;
  for (const i of list) {
    const ip = parseInt(i.address.split(":").at(-1), 16);
    assert.equal(ip, next);
    assert.equal(
      Buffer.from(driver.subarray(ip, ip + i.length)).toString("hex"),
      i.bytes,
      "Static original line bytes",
    );
    next += i.length;
  }
  assert.equal(next, 0x81f);
}
checkInstructions(dis.instructions);
const changedBytes = structuredClone(dis.instructions);
changedBytes[0].bytes = "90";
assert.throws(
  () => checkInstructions(changedBytes),
  /Static original line bytes/,
);
const resident = artifacts["resident-disassembly"];
assert.equal(resident.success, true);
assert.equal(resident.truncated, false);
let residentIP = 0xb0;
for (const ins of resident.instructions) {
  const ip = parseInt(ins.address.split(":").at(-1), 16);
  assert.equal(ip, residentIP);
  assert.equal(
    Buffer.from(image.subarray(0x40e0 + ip, 0x40e0 + ip + ins.length)).toString(
      "hex",
    ),
    ins.bytes,
    "Original resident line dispatcher bytes",
  );
  residentIP += ins.length;
}
assert.equal(residentIP, 0x1a1);
const outIPs = new Set(
  dis.instructions
    .filter((i) => i.mnemonic === "OUT")
    .map((i) => parseInt(i.address.split(":").at(-1), 16)),
);
const expectedEntries = {
  point: 0x515,
  diagonal: 0x589,
  vertical: 0x69b,
  horizontal: 0x73f,
};
function compare({
  records = artifacts,
  inputs = artifacts.inputs,
  alterWork = false,
} = {}) {
  assert.equal(inputs.cases.length, 32, "Missing required native cases");
  let instructions = 0,
    ports = 0;
  const memory = Uint8Array.from(driver);
  const w = (at, v) => {
    memory[at] = v & 255;
    memory[at + 1] = (v >>> 8) & 255;
  };
  w(0x1e, 0x2000);
  memory[0x24] = 6;
  for (let index = 0; index < 32; index++) {
    const c = inputs.cases[index],
      n = records[`case-${String(index).padStart(2, "0")}`];
    assert.ok(n, "Missing native case");
    assert.equal(n.index, index);
    assert.deepEqual(n.input, c, "Changed native input schedule");
    const trace = [];
    const work = egaDriverLineWork(c.kind, c.args, {
      instruction: (ip) => trace.push(ip),
    });
    if (alterWork && index === 25) work.instructions++;
    assert.deepEqual(trace, n.trace, "Native line control flow differs");
    assert.equal(
      work.instructions,
      n.trace.length,
      "Native instruction count differs",
    );
    assert.equal(trace[0], expectedEntries[c.kind]);
    assert.deepEqual(
      n.ports.map((p) => p.ip),
      trace.filter((ip) => outIPs.has(ip)),
      "Missing or reordered native OUT",
    );
    assert.equal(work.portWrites, n.ports.length);
    for (const p of n.ports) {
      assert.equal(
        p.port,
        [0x56a, 0x714, 0x791, 0x601].includes(p.ip) ? 0x3c4 : 0x3ce,
      );
      assert.ok(Number.isInteger(p.word) && p.word >= 0 && p.word <= 65535);
    }
    const final = n.final;
    assert.equal(final.protected_mode, false);
    assert.equal(final.registers.cs, a.segment);
    assert.equal(final.registers.ss, a.segment);
    assert.equal(final.registers.esp, 0xfef0);
    assert.equal(final.registers.eip, 0x4007 + c.args.length * 3);
    assert.equal(final.registers.flags & 0x600, 0);
    if (c.kind === "diagonal") {
      const [axis, majorStep, minorStep, , twiceMajor, twiceMinor] = c.args;
      w(0x62e, 200);
      memory[0x650] = (minorStep & 255) === 255 ? 0x48 : 0x40;
      w(0x653, twiceMajor);
      w(0x657, twiceMinor);
      w(0x659, axis ? 0xc00b : 0x1aeb);
      memory[0x66d] = majorStep & 255;
      w(0x67c, majorStep);
    }
    assert.equal(n.driver.aborted, false);
    assert.equal(n.driver.results.length, 1);
    assert.equal(n.driver.results[0].status, "ok");
    assert.deepEqual(
      Buffer.from(n.driver.results[0].data, "base64"),
      Buffer.from(memory),
      "Unexplained native driver change",
    );
    instructions += work.instructions;
    ports += work.portWrites;
  }
  assert.equal(instructions, 3722);
  assert.equal(ports, m.expectedPortWrites);
  return { instructions, ports };
}
const result = compare();
// Static resident dispatch translated separately from the native primitive oracle.
for (const [index, c] of [
  [0, { x: 12, y: 10, x2: 12, y2: 10 }],
  [5, { x: 10, y: 12, x2: 10, y2: 15 }],
  [13, { x: 15, y: 10, x2: 12, y2: 10 }],
  [25, { x: 12, y: 10, x2: 19, y2: 13 }],
  [26, { x: 12, y: 10, x2: 5, y2: 7 }],
  [27, { x: 12, y: 10, x2: 15, y2: 17 }],
  [28, { x: 12, y: 10, x2: 9, y2: 3 }],
  [29, { x: 12, y: 10, x2: 19, y2: 3 }],
  [30, { x: -2, y: -2, x2: 5, y2: 1 }],
  [31, { x: 318, y: 198, x2: 315, y2: 205 }],
]) {
  const work = egaLinePrimitiveWork(c),
    native = artifacts[`case-${String(index).padStart(2, "0")}`];
  assert.equal(work.kind, native.input.kind);
  assert.deepEqual(work.args, native.input.args);
  assert.equal(work.instructions, native.trace.length);
  assert.equal(work.portWrites, native.ports.length);
}
assert.equal(
  egaLinePrimitiveWork({ x: -5, y: 1, x2: -2, y2: 5 }).kind,
  "rejected",
);
assert.throws(
  () => egaLinePrimitiveWork({ x: 0, y: 0, x2: 1, y2: 1 }, 1),
  /mode/,
);

const missing = structuredClone(artifacts);
delete missing["case-15"];
assert.throws(() => compare({ records: missing }), /Missing native case/);
const wrongTrace = structuredClone(artifacts);
wrongTrace["case-25"].trace[70] ^= 1;
assert.throws(() => compare({ records: wrongTrace }), /control flow/);
const missingOUT = structuredClone(artifacts);
missingOUT["case-25"].ports.pop();
assert.throws(() => compare({ records: missingOUT }), /native OUT/);
assert.throws(() => compare({ alterWork: true }), /instruction count/);
const wrongInput = structuredClone(artifacts.inputs);
wrongInput.cases[25].args[3]--;
assert.throws(() => compare({ inputs: wrongInput }), /input schedule/);
assert.throws(
  () => egaDriverLineWork("diagonal", [1, 1, 1, 0, 0, 0, 0, 0]),
  /Unsupported/,
);
assert.throws(() => egaDriverLineWork("point", [0, NaN]), /Unsupported/);
const analysis = m.jungleAnalysis;
assert.ok(analysis, "Missing jungle line workload declaration");
const reportBytes = await readFile(analysis.path).catch(() => {
  throw Error(`SETUP: missing ${analysis.path}`);
});
assert.equal(reportBytes.length, analysis.bytes);
assert.equal(
  sha(reportBytes),
  analysis.sha256,
  "Corrupt derived line workload",
);
for (const [p, h] of Object.entries(analysis.sources))
  assert.equal(sha(await readFile(p)), h, `Changed line analysis source ${p}`);
const inspected = spawnSync(
  process.execPath,
  ["scripts/inspect-jungle-line-work.js"],
  { encoding: "utf8", timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
);
assert.ifError(inspected.error);
assert.equal(inspected.status, 0, inspected.stderr);
assert.equal(
  sha(inspected.stdout),
  analysis.sha256,
  "Changed derived workload;not an original timing golden",
);
assert.equal(JSON.parse(inspected.stdout).rows.length, 6);
console.log(
  `Original line work:32 carried private native calls,${result.instructions} exact executed IPs,${result.ports} ordered OUT sites;all2599 driver bytes including explicit self-modification match;6 comparison negatives plus invalid-path checks. Not pixels,natural cadence or browser timing.`,
);
