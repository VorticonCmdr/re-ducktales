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
