// Replay recorded external browser events without an output-guided controller.
// --diagnose permits an incomplete exploratory capture and a declared100ms tail;
// that mode can locate a failure but cannot satisfy acceptance.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { Scheduler } from "../src/game/scheduler.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
const root = process.argv[2],
  diagnose = process.argv.includes("--diagnose");
const contractPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/hard-campaign.json";
let strictContract = null;
assert.ok(root, "SETUP: supply a recorded campaign directory");
const json = async (n) => {
  const bytes = await readFile(`${root}/${n}`).catch(() => {
    throw Error(`SETUP: missing recorded campaign artifact ${root}/${n}`);
  });
  try {
    return JSON.parse(bytes);
  } catch {
    throw Error(`Corrupt recorded campaign artifact ${n}`);
  }
};
const [environment, events, checkpoints, timeline] = await Promise.all([
  json("environment.json"),
  json("captured-events.json"),
  json("campaign-checkpoints.json"),
  json("timeline.json"),
]);
assert.equal(environment.hard, true);
assert.equal(environment.displayMilliseconds, 8);
if (!diagnose)
  assert.equal(
    environment.completed,
    true,
    "Incomplete exploratory capture is not acceptance",
  );
assert.ok(
  events.length > 0 && checkpoints.length > 0,
  "Zero replay cases/events/checkpoints",
);
const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
const hash = (v) => createHash("sha256").update(v).digest("hex");
const negative = process.argv
  .find((a) => a.startsWith("--negative="))
  ?.slice(11);
if (!diagnose) {
  const contract = JSON.parse(await readFile(contractPath));
  strictContract = contract;
  for (const name of [
    "environment",
    "captured-events",
    "campaign-checkpoints",
    "timeline",
  ]) {
    const spec = contract.artifacts[name];
    assert.ok(spec, `SETUP: missing required ${name} fixture`);
    assert.equal(
      hash(await readFile(`${root}/${name}.json`)),
      spec.sha256,
      `Corrupt ${name} fixture`,
    );
  }
  if (negative === "wrong-difficulty") {
    const e = events.find((e) => e.type === "keydown" && e.key === "ArrowUp");
    assert.ok(e, "Missing difficulty input");
    e.key = "ArrowDown";
  } else if (negative === "alter-checkpoint")
    checkpoints[0].stateSha256 = "0".repeat(64);
  else if (negative === "omit-checkpoint") checkpoints.splice(1, 1);
  else assert.equal(negative, undefined, "Unknown negative control");
  assert.equal(
    events.length,
    contract.requiredEventCount,
    "Missing required input events",
  );
  assert.equal(
    checkpoints.length,
    contract.expectedCheckpointCount,
    "Missing required checkpoints",
  );
  assert.deepEqual(
    checkpoints.map((c) => c.name),
    contract.checkpointNames,
  );
  assert.equal(
    timeline.observations.length,
    contract.expectedCheckpointCount,
    "Missing required observations",
  );
  assert.equal(timeline.clockOrigin, environment.clockOrigin);
  assert.equal(timeline.displayMilliseconds, environment.displayMilliseconds);
  const endAt = timeline.endAt;
  for (let i = 0; i < events.length; i++)
    assert.ok(
      Number.isFinite(events[i].time) &&
        events[i].time >= environment.clockOrigin &&
        events[i].time <= endAt &&
        (!i || events[i].time >= events[i - 1].time),
      "Unconsumable or unordered required input event",
    );
  assert.equal(environment.capturePhase, "before-target-handler");
}
const { game, archives } = await originalGame(),
  held = new Set();
let nextFrame = environment.clockOrigin + 8,
  consumed = 0,
  checked = 0,
  failure = null,
  lastTime = environment.clockOrigin,
  lastCommands = null,
  rendered = 0,
  flagAliasPresentations = 0;
const clock = new Scheduler(game, environment.clockOrigin, {
  present: () => {
    if (game.scene !== "flight" || !game.flight.current) return;
    if (lastCommands === game.flight.current) return;
    lastCommands = game.flight.current;
    const entries = archives.get("PLANE.ARC"),
      bad = game.flight.current.find(
        (c) =>
          c.op === "sprite" &&
          c.frame >= entries[c.asset].frames &&
          c.x < 320 &&
          c.x + entries[c.asset].width > 0 &&
          c.y < 200 &&
          c.y + entries[c.asset].height > 0,
      );
    {
      try {
        renderFlightPixels(
          game.flight.current,
          entries,
          archives.get("MAIN.ARC")[42].data,
        );
        rendered++;
        if (bad?.asset === 58 && bad.frame === 255) flagAliasPresentations++;
      } catch (error) {
        failure = {
          scope:
            "Carried replay of browser input, not original native pixels or acceptance",
          message: error.message,
          command: bad ?? game.flight.current[0],
          state: game.snapshot(),
          descriptor: [...game.flight.memory.bytes.subarray(0x685a, 0x686e)],
          memory: Buffer.from(game.flight.memory.bytes).toString("base64"),
          consumed,
          checked,
          at: nextFrame,
        };
        throw error;
      }
    }
  },
});
function effects() {
  for (const e of game.drainEffects()) {
    if (e.type === "flushControls") held.clear();
    else
      assert.ok(
        ["sound", "stopAudio", "flushControls"].includes(e.type),
        `Unsupported replay effect ${e.type}`,
      );
  }
}
function advance(at) {
  assert.ok(Number.isFinite(at) && at >= lastTime, "Late replay clock");
  while (nextFrame <= at) {
    clock.advanceTo(nextFrame);
    effects();
    nextFrame += 8;
  }
  lastTime = at;
}
const send = (e) => clock.enqueue(e, lastTime);
function controls() {
  send({
    type: "controls",
    fire: held.has("Space") || held.has("Enter"),
    direction:
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
        .filter((k) => held.has(k))
        .at(-1)
        ?.slice(5)
        .toLowerCase() ?? null,
  });
  if (game.scene === "map") {
    const x = Number(held.has("ArrowRight")) - Number(held.has("ArrowLeft")),
      y = Number(held.has("ArrowDown")) - Number(held.has("ArrowUp"));
    send({
      type: "direction",
      direction:
        [
          y < 0 ? "up" : y > 0 ? "down" : null,
          x < 0 ? "left" : x > 0 ? "right" : null,
        ]
          .filter(Boolean)
          .join("-") || null,
    });
  }
}
function event(e) {
  assert.ok(
    ["keydown", "keyup", "pointerdown", "pointerup"].includes(e.type),
    `Unsupported replay input ${e.type}`,
  );
  if (e.type === "keydown" || e.type === "keyup") {
    const key = e.key === " " ? "Space" : e.key;
    assert.ok(
      [
        "Space",
        "Enter",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(key),
      `Unsupported replay key ${key}`,
    );
    if (e.type === "keyup") {
      held.delete(key);
      controls();
      return;
    }
    held.add(key);
    controls();
    if (key === "Space" || key === "Enter")
      send({
        type: "fire",
        direction: held.has("ArrowUp")
          ? "up"
          : held.has("ArrowLeft")
            ? "left"
            : held.has("ArrowRight")
              ? "right"
              : null,
      });
    else send({ type: key.slice(5).toLowerCase() });
    return;
  }
  if (e.target === "game") {
    if (
      e.type === "pointerdown" &&
      game.scene === "map" &&
      !game.campaign.info
    ) {
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
      send({ type: "point", x: e.x, y: e.y });
    }
    return;
  }
  if (e.type === "pointerup") {
    assert.ok(
      ["map", "back"].includes(e.target),
      `Unsupported replay button ${e.target}`,
    );
    send({ type: e.target });
  }
}
try {
  for (let index = 0; index < checkpoints.length; index++) {
    const c = checkpoints[index],
      point = timeline.observations[index];
    assert.deepEqual(
      { name: c.name, at: c.at, eventCount: c.eventCount },
      point,
      "Observation metadata mismatch",
    );
    assert.ok(
      point.eventCount >= consumed && point.eventCount <= events.length,
    );
    while (consumed < point.eventCount) {
      const e = events[consumed];
      advance(e.time);
      event(e);
      consumed++;
    }
    advance(point.at);
    if (hash(canonical(game.snapshot())) !== c.stateSha256) {
      const differences = [];
      const walk = (a, b, p = "") => {
        if (a && b && typeof a === "object" && typeof b === "object") {
          for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
            walk(a[k], b[k], p + "." + k);
        } else if (a !== b)
          differences.push({ path: p, actual: a, expected: b });
      };
      walk(game.snapshot(), c.state);
      console.error(
        JSON.stringify({ checkpoint: checked, name: c.name, differences }),
      );
    }
    assert.equal(
      hash(canonical(game.snapshot())),
      c.stateSha256,
      `Carried replay checkpoint${checked} ${c.name}`,
    );
    checked++;
  }
  while (consumed < events.length) {
    const e = events[consumed];
    advance(e.time);
    event(e);
    consumed++;
  }
  if (diagnose) advance(lastTime + 100); // exploratory tail only, never a fitted acceptance input
  assert.equal(consumed, events.length);
  assert.equal(checked, checkpoints.length);
  if (!diagnose) assert.equal(held.size, 0, "Unreleased recorded keys");
  assert.ok(game.scene === "ending" || diagnose, "Unfinished campaign");
  if (!diagnose) {
    assert.ok(game.ending.ready, "Unfinished ending input sequence");
    assert.ok(
      rendered > 0 && flagAliasPresentations > 0,
      "Required flight rendering path skipped",
    );
    assert.equal(clock.events.length, 0, "Unconsumed scheduler input");
    if (strictContract.expectedFlightPresentations !== undefined)
      assert.equal(
        rendered,
        strictContract.expectedFlightPresentations,
        "Missing flight presentations",
      );
    if (strictContract.expectedFlagAliasPresentations !== undefined)
      assert.equal(
        flagAliasPresentations,
        strictContract.expectedFlagAliasPresentations,
        "Unexpected flag alias coverage",
      );
  }
  console.log(
    JSON.stringify({
      mode: diagnose ? "EXPLORATORY diagnostic" : "recorded-input replay",
      consumed,
      checked,
      rendered,
      flagAliasPresentations,
      heldAtExploratoryEndpoint: [...held],
      state: game.snapshot(),
    }),
  );
} catch (error) {
  if (failure) {
    await writeFile(
      `${root}/replayed-failure.json`,
      JSON.stringify(failure, null, 2) + "\n",
    );
    console.error(
      JSON.stringify({
        message: failure.message,
        command: failure.command,
        at: failure.at,
        consumed,
        checked,
        state: failure.state.flight,
      }),
    );
  }
  throw error;
}

// Diagnostic callers can inspect the already replayed live port state. This
// does not change CLI verification or restore/inject any memory into the game.
export { game, archives, clock };
