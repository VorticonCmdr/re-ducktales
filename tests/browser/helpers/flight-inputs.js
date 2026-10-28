import { createHash } from "node:crypto";
import { expect } from "@playwright/test";

// Values come from an independent consumed-input stream, never expected actor
// positions or results. Real keys are submitted before the next game input read.
export async function replayFlightInputs({ page, until, profile }) {
  const codes = profile.events.flatMap(({ byte, count }) => {
    expect(Number.isInteger(count) && count > 0).toBe(true);
    expect([0, 1, 5, 192, 193, 197]).toContain(byte);
    return Array(count).fill(byte);
  });
  expect(
    createHash("sha256").update(Buffer.from(codes)).digest("hex"),
    "Corrupt consumed flight input stream",
  ).toBe(profile.sha256);
  expect(codes.length).toBe(profile.inputCount);
  expect(codes.length).toBeGreaterThan(0);
  const trace = [];
  const active = new Set();
  const negative = process.env.DUCKTALES_FLIGHT_NEGATIVE;
  if (negative && negative !== "omit-first-turn")
    throw Error("SETUP: unknown flight-input negative mode");
  let omitted = false;
  async function keys(code) {
    const next = new Set([
      ...(code & 192 ? ["Space"] : []),
      ...((code & 63) === 1
        ? ["ArrowUp"]
        : (code & 63) === 5
          ? ["ArrowDown"]
          : []),
    ]);
    // Refresh physical keys so a previous game's keyboard-matrix flush cannot
    // leave the browser holding a key that the simulation no longer sees.
    for (const key of active) await page.keyboard.up(key);
    active.clear();
    for (const key of next) {
      if (negative && !omitted && key.startsWith("Arrow")) {
        omitted = true;
        continue;
      }
      await page.keyboard.down(key);
      active.add(key);
    }
  }
  await keys(codes[0]);
  let s = await until((value) => value.scene === "flight");
  expect(
    s.flight.inputReads,
    "First flight input boundary must not be skipped",
  ).toBeLessThanOrEqual(1);
  while (s.flight.inputReads < codes.length) {
    const used = s.flight.inputReads;
    if (used)
      expect(s.flight.lastInputCode, `Consumed flight input${used}`).toBe(
        codes[used - 1],
      );
    trace.push(s.flight);
    await keys(codes[used]);
    s = await until(
      (value) => value.scene !== "flight" || value.flight.inputReads > used,
    );
    expect(
      s.scene,
      "Flight must remain active until all required inputs are consumed",
    ).toBe("flight");
    expect(s.flight.inputReads, "No flight input read may be skipped").toBe(
      used + 1,
    );
    expect(s.flight.lastInputCode, `Consumed flight input${used + 1}`).toBe(
      codes[used],
    );
  }
  expect(s.flight.inputReads).toBe(codes.length);
  for (const key of active) await page.keyboard.up(key);
  trace.push(s.flight);
  return trace;
}
