import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { capture, sameBytes } from "./verify-investments.js";
import {
  tradeInvestment,
  advanceInvestmentDays,
} from "../src/game/investments.js";
import build from "../reference/build.json" with { type: "json" };

const manifest = JSON.parse(
  await readFile("reference/investment-trading.json", "utf8"),
);
assert.equal(manifest.expectedCheckpointCount, 5);
assert.equal(Object.keys(manifest.artifacts).length, 11);
const local = {};
for (const [key, artifact] of Object.entries(manifest.artifacts)) {
  const bytes = await readFile(artifact.path).catch(() => {
    throw Error(`SETUP: missing ${artifact.path}; see docs/investments.md`);
  });
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    artifact.sha256,
    `corrupt ${artifact.path}`,
  );
  local[key] = JSON.parse(bytes);
}
for (const key of ["cashSetup", "daySetup"]) {
  assert.equal(local[key].isError, false);
  const result = JSON.parse(local[key].content[0].text);
  assert.equal(result.aborted, false);
  assert.ok(result.results.every((r) => r.status === "ok"));
  assert.equal(result.results[0].op, "mem_cas");
  assert.equal(
    result.results[0].addr,
    0x14030 + (key === "cashSetup" ? 0x8cc0 : 0x4e0e),
  );
}
let checked = 0;
function compareTrade(name, alter = false) {
  const before = capture(
    local[`${name}Before`],
    2,
    0xe0c0 + (name === "sell" ? 0x629 : 0x5c0),
  );
  const after = capture(local[`${name}After`], 2, 0xe0c0 + 0x5b1);
  const { m, cpu } = before;
  assert.equal(m.i(cpu.ebp + 6), 10);
  assert.equal(m.i(cpu.ebp - 0x68), 3);
  assert.equal(before.cpu.ebp, after.cpu.ebp);
  const message = tradeInvestment(
    m,
    10,
    name === "sell" ? "sell" : "buy",
    m.i(cpu.ebp - 0x68),
  );
  m.i(cpu.ebp - (name === "sell" ? 0xa : 0xc), name === "sell" ? 6 : 5);
  m.i(cpu.ebp - 0x14, message);
  if (message === 2 || message === 3) m.i(cpu.ebp - 2, 0);
  if (alter) m.view.setUint32(0x8cc0, m.view.getUint32(0x8cc0, true) + 1, true);
  assert.equal(message, after.m.i(cpu.ebp - 0x14), `${name} message`);
  // Caller locals are compared too. Only the10-byte IRQ stack below SP and
  // the resident IRQ8 clock word are excluded at this branch boundary.
  for (let at = 0; at < 65536; at++) {
    if ((at >= cpu.esp - 10 && at < cpu.esp) || (at >= 0x2225 && at < 0x2227))
      continue;
    assert.equal(m.b(at), after.m.b(at), `${name} DS${at.toString(16)}`);
  }
}
for (const name of ["failedBuy", "buy", "sell"]) {
  compareTrade(name);
  assert.throws(() => compareTrade(name, true), /DS8cc0/);
  checked++;
}
assert.equal(capture(local.buyBefore, 2).m.view.getUint32(0x8cc0, true), 1000);
assert.equal(capture(local.sellBefore, 2).m.view.getUint32(0x8cc0, true), 997);
const exit = capture(local.exit, 2, 0x1f50 + 0x310);
assert.equal(exit.m.b(0x4e0e), 1, "trading must not spend a day");
assert.equal(exit.m.view.getUint32(0x8cc0, true), 1000);
assert.equal(exit.m.i(0x92d4 + 10 * 46), 0);
assert.equal(exit.m.b(0x3bb4), 1);
checked++;

const executable = await readFile("game/DUCKTALE.EXE");
assert.equal(
  createHash("sha256").update(executable).digest("hex"),
  build.files["DUCKTALE.EXE"].sha256,
);
const overlay = executable.subarray(0x26e00, 0x26e00 + 5986),
  body = Buffer.from(overlay.subarray(512));
assert.equal(overlay.readUInt16LE(6), 101);
for (let i = 0; i < 101; i++) {
  const at = overlay.readUInt16LE(24) + i * 4;
  const target =
    overlay.readUInt16LE(at) + overlay.readUInt16LE(at + 2) * 16 - 0xc170;
  body.writeUInt16LE((body.readUInt16LE(target) + 0x1f5) & 65535, target);
}
function compareDays(alterSeed = false) {
  const before = capture(local.daysBefore, 3, 0xe0c0 + 0x10d1);
  const after = capture(local.daysAfter, 2, 0xe0c0 + 0x145a);
  sameBytes(
    Buffer.from(before.results[2].data, "base64"),
    body,
    "reloaded trading body",
  );
  assert.equal(before.m.b(0x7162), 1);
  assert.equal(before.m.b(0x4e0e), 30);
  if (alterSeed) before.m.i(0x2229, before.m.i(0x2229) ^ 1);
  const result = advanceInvestmentDays(before.m);
  assert.equal(result.days, 29);
  for (let at = 0; at < 65536; at++) {
    if ((at >= 0x9f22 && at < 0x9f58) || (at >= 0x2225 && at < 0x2227))
      continue;
    assert.equal(before.m.b(at), after.m.b(at), `market DS${at.toString(16)}`);
  }
  return result;
}
const result = compareDays();
assert.throws(() => compareDays(true), /market DS/);
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);
console.log(
  `Investment trading: 3 exact transaction branches, unchanged day/cash return, 29 carried market days (${result.draws} translated RNG draws); conditional setup and negative controls verified.`,
);
