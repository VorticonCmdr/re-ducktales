import { expect } from "@playwright/test";

// Exploratory player policy: steering observes the presently published pose,
// not an expected result. Strict acceptance replays the resulting independent
// DOM input stream and never calls this controller.
export async function exploreFlight({
  page,
  state,
  until,
  hard = false,
  policy = null,
}) {
  const trace = [];
  const altitude = policy?.altitude ?? (hard ? [10, 25] : [75, 90]);
  const climbHeading = policy?.climbHeading ?? 1;
  expect(altitude.length).toBe(2);
  expect(
    altitude.every(Number.isFinite) &&
      altitude[0] >= 0 &&
      altitude[0] <= altitude[1] &&
      altitude[1] <= 139,
  ).toBe(true);
  expect([1, 2, 3]).toContain(climbHeading);
  const negative = process.env.DUCKTALES_FLIGHT_NEGATIVE;
  if (negative && negative !== "omit-first-turn")
    throw Error("SETUP: unknown flight-input negative mode");
  let omitted = false,
    negativeChecked = false;
  let active = [];
  async function controls(direction) {
    for (const key of active) await page.keyboard.up(key);
    active = ["Space", ...(direction ? [direction] : [])];
    for (const key of active) {
      if (negative && !omitted && key.startsWith("Arrow")) {
        omitted = true;
        continue;
      }
      await page.keyboard.down(key);
    }
  }
  await controls(null);
  let s = await until((v) => v.scene === "flight");
  expect(
    s.flight.inputReads,
    "First flight input boundary must be observed",
  ).toBeLessThanOrEqual(1);
  for (let n = 0; n < 1500; n++) {
    const f = s.flight;
    if (s.scene !== "flight" || ["landing", "complete"].includes(f.phase))
      break;
    const desired =
      f.tile > f.tiles - 5
        ? f.y < 135
          ? 15
          : 0
        : f.y > altitude[1]
          ? climbHeading
          : f.y < altitude[0]
            ? 15
            : 0;
    const delta = (desired - f.heading + 16) % 16;
    const direction =
      f.speed < 4 || !delta ? null : delta < 8 ? "ArrowDown" : "ArrowUp";
    trace.push({
      before: f,
      submitted: 192 | ({ ArrowDown: 5, ArrowUp: 1 }[direction] ?? 0),
    });
    await controls(direction);
    s = await until(
      (v) =>
        v.scene !== "flight" ||
        v.flight.inputReads > f.inputReads ||
        v.flight.phase !== f.phase,
    );
    if (
      negative &&
      omitted &&
      !negativeChecked &&
      s.flight.inputReads > f.inputReads
    ) {
      negativeChecked = true;
      expect(
        s.flight.lastInputCode,
        `Consumed flight input${s.flight.inputReads}`,
      ).toBe(192 | ({ ArrowDown: 5, ArrowUp: 1 }[direction] ?? 0));
    }
    if (n === 1499) throw Error("Unfinished exploratory flight policy");
  }
  for (const key of active) await page.keyboard.up(key);
  return trace;
}

// Exploratory physical-key pilot. The published read/frame ordinals expose
// whether the last sampled turn is still pending. A one-step turn is a tap:
// original mode0 consumes its release once, then clears it. No expected state,
// timer fitting, memory initialization or game-logic override supplies controls.
export async function explorePhysicalFlight({ page, state, until, policy }) {
  const altitude = policy.altitude,
    climb = policy.climbHeading;
  expect(altitude).toHaveLength(2);
  expect(altitude[0]).toBeGreaterThanOrEqual(0);
  expect(altitude[1]).toBeGreaterThanOrEqual(altitude[0]);
  expect(altitude[1]).toBeLessThanOrEqual(139);
  expect([1, 2, 3]).toContain(climb);
  expect(
    (await state()).flight.inputReads,
    "First physical flight boundary",
  ).toBeLessThanOrEqual(1);
  const trace = [];
  let active = null;
  await page.keyboard.down("Space");
  for (let n = 0; n < 1500; n++) {
    const s = await state(),
      f = s.flight;
    if (s.scene !== "flight" || ["landing", "complete"].includes(f.phase))
      break;
    const band = policy.altitudeForState?.(s) ?? altitude;
    const desired =
      f.tile > f.tiles - 5
        ? f.y < 135
          ? 15
          : 0
        : f.y > band[1]
          ? climb
          : f.y < band[0]
            ? 15
            : 0;
    const pending = f.frames === f.inputReads ? (f.lastInputCode ?? 0) & 63 : 0;
    const future =
      (f.heading + (pending === 5 ? 1 : pending === 1 ? -1 : 0) + 16) % 16;
    const delta = (desired - future + 16) % 16;
    const direction =
      f.speed < (policy.minimumTurnSpeed ?? 4) || !delta
        ? null
        : delta < 8
          ? "ArrowDown"
          : "ArrowUp";
    const distance = Math.min(delta, 16 - delta);
    await page.keyboard.down("Space");
    if (active && active !== direction) {
      await page.keyboard.up(active);
      active = null;
    }
    if (direction) {
      await page.keyboard.down(direction);
      active = direction;
      if (distance === 1) {
        await page.keyboard.up(direction);
        active = null;
      }
    }
    trace.push({ before: f, desired, future, direction, distance });
    await until(
      (v) =>
        v.scene !== "flight" ||
        v.flight.phase === "landing" ||
        v.flight.inputReads > f.inputReads,
    );
    if (n === 1499)
      throw Error("Unfinished exploratory physical flight policy");
  }
  if (active) await page.keyboard.up(active);
  await page.keyboard.up("Space");
  return trace;
}
