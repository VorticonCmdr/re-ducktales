// Independent source-input schedules. No after-state selects a replay input.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Cave } from "../../src/game/cave.js";
import { renderFlightPixels } from "../../src/game/flight-raster.js";
import { canonical } from "../../tests/browser/helpers/entry-recording.js";
const digest = (b) => createHash("sha256").update(b).digest("hex");
const directions = [
  ["up", 8, -8],
  ["right", 2, 1],
  ["down", 4, 8],
  ["left", 1, -1],
];
export function planCaveVariant(map, variant) {
  let start = -1,
    goal = -1;
  map.forEach((cell, i) => {
    if (cell & 32) goal = i;
    else if (cell & 16) start = i;
  });
  assert.ok(start >= 0 && goal >= 0, "Missing original cave endpoints");
  const queue = [[start, []]],
    seen = new Set([start]);
  let route = null;
  while (queue.length) {
    const [room, path] = queue.shift();
    if (room === goal) {
      route = path;
      break;
    }
    for (const [d, bit, delta] of directions) {
      const next = room + delta;
      if (
        map[room] & bit &&
        next >= 0 &&
        next < 64 &&
        !seen.has(next) &&
        (!(map[next] & 64) || next === goal)
      ) {
        seen.add(next);
        queue.push([next, [...path, d]]);
      }
    }
  }
  assert.ok(route?.length, "No safe original cave route");
  return {
    variant,
    start,
    goal,
    seed: 0,
    difficulty: 0,
    currentDrive: 2,
    money: 0,
    events: [null, ...route].map((direction, i) => ({
      input: i + 1,
      controls: { direction, fire: direction !== null },
    })),
  };
}
export function runCaveVariant(resources, input, expected = null) {
  let cave,
    consumed = 0;
  cave = new Cave({
    ...resources,
    ...input,
    pollInput: () => {
      const event = input.events[consumed++];
      assert.equal(
        event?.input,
        cave.inputs.length + 1,
        "Missing cave input ordinal",
      );
      cave.setControls(event.controls);
      return true;
    },
  });
  const checkpoints = [];
  let shown = 0;
  for (let step = 0; step < 15000 && !cave.outcome; step++) {
    cave.advanceTick();
    cave.advanceRetrace();
    if (cave.presentations !== shown) {
      assert.equal(cave.presentations, shown + 1, "Skipped cave presentation");
      shown++;
      const pixels = renderFlightPixels(
        cave.current,
        resources.entries,
        resources.font,
        "EXP.ARC",
      );
      assert.equal(pixels.length, 256000);
      const state = cave.snapshot(),
        check = {
          step: step + 1,
          presentation: shown,
          state,
          stateSha256: digest(canonical(state)),
          pixelsSha256: digest(pixels),
        };
      if (expected)
        assert.deepEqual(
          check,
          expected.checkpoints[checkpoints.length],
          `Cave variant${input.variant} checkpoint${shown}`,
        );
      checkpoints.push(check);
    }
  }
  assert.ok(cave.outcome, "Unfinished cave variant " + input.variant);
  assert.equal(consumed, input.events.length, "Unconsumed required cave input");
  assert.equal(cave.room, input.goal);
  assert.equal(cave.outcome.status, "treasure");
  assert.equal(cave.outcome.code, 1);
  assert.equal(
    cave.outcome.money,
    (input.events.length - 2) * 50,
    "Source new-room coin rule",
  );
  assert.equal(
    cave.snapshot().torch,
    input.events.length - 1,
    "Source torch entry rule",
  );
  assert.ok(shown > 100, "Cave animations omitted");
  const result = {
    variant: input.variant,
    consumed,
    presentations: shown,
    outcome: cave.outcome,
    finalState: cave.snapshot(),
    checkpoints,
  };
  if (expected) {
    assert.equal(
      checkpoints.length,
      expected.checkpoints.length,
      "Missing cave checkpoints",
    );
    assert.deepEqual(result, expected, "Cave closed-loop result");
  }
  return result;
}
