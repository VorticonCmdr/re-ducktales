import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Photography } from "../src/game/photography.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/timing.js";
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const PHOTO_BASELINE = "1dc128516bbf56bac002ac3c582cbb2772e469a5";
const imports = /\bfrom\s+["'](\.[^"']+)["']/g;
export async function historicalPhotography() {
  // Load the complete archived graph. Importing today's dependencies would
  // silently change the historical reference as shared rendering evolves.
  const graph = {},
    root = process.cwd();
  const scratch = await mkdtemp(resolve(tmpdir(), "ducktales-photo-history-"));
  async function visit(path) {
    if (graph[path]) return;
    let bytes;
    try {
      bytes = execFileSync("git", ["show", `${PHOTO_BASELINE}:${path}`], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      throw Error(
        `SETUP: missing historical source ${PHOTO_BASELINE}:${path}; see docs/photography-timing.md`,
      );
    }
    graph[path] = sha(bytes);
    const source = bytes.toString();
    assert.doesNotMatch(source, /\bimport\s*\(/);
    for (const match of source.matchAll(imports)) {
      const dependency = relative(root, resolve(dirname(path), match[1]));
      assert.ok(dependency.startsWith("src/"));
      await visit(dependency);
    }
    const target = resolve(scratch, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  try {
    await writeFile(resolve(scratch, "package.json"), '{"type":"module"}');
    await visit("src/game/photography.js");
    const { Photography: HistoricalPhotography } = await import(
      pathToFileURL(resolve(scratch, "src/game/photography.js")).href
    );
    return { Photography: HistoricalPhotography, graph };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
export function comparePhotographyMemory(actual, expected, label) {
  assert.equal(actual.length, 65536);
  assert.equal(expected.length, 65536);
  // Exactly the driver wait base, IRQ clock and next-loop deadline. No RNG,
  // page pointer, actor, stack or gameplay byte is excluded.
  for (let i = 0; i < 65536; i++) {
    if ((i >= 0x2221 && i < 0x2229) || (i >= 0x27f8 && i < 0x27fc)) continue;
    assert.equal(actual[i], expected[i], `${label}: DS${i.toString(16)}`);
  }
}
function gameplay(snapshot) {
  const {
    tick,
    retrace,
    wait,
    drawingWork,
    drawingCalls,
    drawingMilliseconds,
    ...rest
  } = snapshot;
  return rest;
}
export function replayPhotographyComponent({
  resources,
  scenario,
  PhotographyClass = Photography,
  mutation = null,
}) {
  const inputs = scenario.inputEvents
    ? scenario.inputEvents.flatMap((e) => Array(e.count).fill(e.byte))
    : Array(scenario.inputs).fill(scenario.inputByte);
  const dialogue =
    scenario.dialogueEvents && Array.isArray(scenario.dialogueEvents)
      ? scenario.dialogueEvents.flatMap((e) => Array(e.count).fill(e.fire))
      : Array(scenario.dialogueEvents).fill(scenario.dialogueFire);
  const inputCount = inputs.length,
    dialogueCount = dialogue.length;
  if (mutation === "removeInput") inputs.pop();
  if (mutation === "extraInput") inputs.push(0);
  let elapsed = 0,
    driver = 0,
    retrace = 0,
    events = 0,
    used = 0,
    polls = 0;
  const boundaries = [],
    presentations = [],
    clocks = [];
  let p;
  function boundary(kind) {
    const memory = Uint8Array.from(p.memory.bytes),
      locals = Uint8Array.from(p.locals.bytes);
    if (mutation === "rng" && boundaries.length === 0) memory[0x2229] ^= 1;
    boundaries.push({ kind, memory, locals, state: gameplay(p.snapshot()) });
    clocks.push([
      kind,
      elapsed,
      ...[0x2221, 0x2225, 0x27f8].map((at) =>
        p.memory.view.getUint32(at, true),
      ),
    ]);
  }
  p = new PhotographyClass({
    ...resources,
    ...scenario.initial,
    clock: () => elapsed,
    readInput: () => {
      boundary("joystick");
      return inputs[used++];
    },
    readDialogueFire: () => {
      boundary("dialogue");
      return dialogue[polls++];
    },
  });
  function observe() {
    presentations.push({
      pixels: sha(p.current),
      mode: p.presentationMode,
      wipe: p.wipeToken,
    });
    clocks.push(["present", elapsed, p.presentations, p.tick, p.retrace]);
  }
  if (p.presentations) {
    assert.equal(p.presentations, 1);
    observe();
  }
  let shown = p.presentations;
  Object.defineProperty(p, "presentations", {
    configurable: true,
    get: () => shown,
    set: (value) => {
      assert.equal(value, shown + 1, "Skipped source publication");
      shown = value;
      observe();
    },
  });
  while (!p.outcome && events < 50000) {
    const tickAt = ((driver + 1) * 1000) / DRIVER_HZ,
      retraceAt = ((retrace + 1) * 1000) / RETRACE_HZ;
    const work = p.wait?.clock === "graphics" ? p.wait.until : Infinity;
    assert.ok(
      work === Infinity || (Number.isFinite(work) && work >= elapsed),
      "Invalid component work deadline",
    );
    elapsed = Math.min(tickAt, retraceAt, work);
    if (tickAt <= retraceAt && tickAt <= work) {
      driver++;
      p.advanceTick();
    } else if (retraceAt <= work) {
      retrace++;
      p.advanceRetrace();
    } else {
      p.advanceGraphics();
      assert.notEqual(p.wait?.until, work, "Unfinished component drawing work");
    }
    events++;
  }
  assert.ok(p.outcome, "Unfinished photography component replay");
  assert.equal(p.audioEnabled, false, "Component audio contract is muted");
  assert.deepEqual(p.drainEvents(), [], "Unexpected component audio effect");
  assert.equal(used, inputs.length, "Unconsumed required photography input");
  assert.equal(
    polls,
    dialogue.length,
    "Unconsumed required photography dialogue",
  );
  assert.equal(used, inputCount);
  assert.equal(polls, dialogueCount);
  assert.equal(p.presentations, presentations.length);
  if (mutation === "picture") presentations[10].pixels = "changed";
  if (mutation === "mode") presentations[10].mode = "changed";
  if (mutation === "omitPicture") presentations.pop();
  const final = {
    ds: sha(p.memory.bytes),
    locals: sha(p.locals.bytes),
    pixels: sha(p.current),
    state: p.snapshot(),
    events,
    driver,
    retrace,
    elapsed,
  };
  const timing = {
    final,
    boundaries: boundaries.length,
    presentations: presentations.length,
    clockTrace: sha(JSON.stringify(clocks)),
  };
  return { p, boundaries, presentations, timing };
}
export function comparePhotographyComponents(actual, historical, label) {
  assert.equal(
    actual.boundaries.length,
    historical.boundaries.length,
    `${label}: boundary count`,
  );
  for (let i = 0; i < actual.boundaries.length; i++) {
    const a = actual.boundaries[i],
      b = historical.boundaries[i];
    assert.equal(a.kind, b.kind);
    comparePhotographyMemory(a.memory, b.memory, `${label} boundary${i}`);
    assert.deepEqual(a.locals, b.locals, `${label} locals${i}`);
    assert.deepEqual(a.state, b.state, `${label} gameplay${i}`);
  }
  assert.deepEqual(
    actual.presentations,
    historical.presentations,
    `${label}: ordered image/mode/wipe sequence`,
  );
  comparePhotographyMemory(
    actual.p.memory.bytes,
    historical.p.memory.bytes,
    `${label} final`,
  );
  assert.deepEqual(actual.p.locals.bytes, historical.p.locals.bytes);
  assert.deepEqual(
    gameplay(actual.p.snapshot()),
    gameplay(historical.p.snapshot()),
  );
}
