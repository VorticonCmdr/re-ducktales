import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Mountain } from "../src/game/mountain.js";
import {
  renderMountainPixels,
  createMountainRasterCache,
} from "../src/game/mountain-scene.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const BASE = "590a2fa31a0de2bcc6b4228d29b041df2bd93226";
const imports = /\bfrom\s+["'](\.[^"']+)["']/g;
async function historicalMountain() {
  const graph = {},
    root = process.cwd();
  async function visit(path) {
    if (graph[path]) return;
    let b;
    try {
      b = execFileSync("git", ["show", `${BASE}:${path}`], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      throw Error(`SETUP: missing historical mountain source ${BASE}:${path}`);
    }
    graph[path] = sha(b);
    if (path !== "src/game/mountain.js")
      assert.equal(
        sha(await readFile(path)),
        graph[path],
        `Changed mountain bridge dependency ${path}`,
      );
    const source = b.toString();
    assert.doesNotMatch(source, /\bimport\s*\(/);
    for (const match of source.matchAll(imports)) {
      const dep = relative(root, resolve(dirname(path), match[1]));
      assert.ok(dep.startsWith("src/"));
      await visit(dep);
    }
    return source;
  }
  const source = await visit("src/game/mountain.js"),
    rewritten = source.replace(imports, (all, dep) =>
      all.replace(dep, pathToFileURL(resolve("src/game", dep)).href),
    );
  return {
    Mountain: (
      await import(
        `data:text/javascript;base64,${Buffer.from(rewritten).toString("base64")}`
      )
    ).Mountain,
    graph,
  };
}
export async function verifyMountainInputBridge(resources, timing) {
  const bridge = JSON.parse(
    await readFile("reference/mountain-ascent-input-bridge.json").catch(() => {
      throw Error(
        "SETUP: missing mountain input bridge;see docs/expedition-keyboard.md",
      );
    }),
  );
  assert.equal(bridge.historicalRevision, BASE);
  assert.equal(bridge.expectedValuesChanged, false);
  assert.equal(bridge.expectedInputBoundaries, 764);
  assert.equal(bridge.expectedPublications, 870);
  const parentBytes = await readFile(bridge.parent.path);
  assert.equal(
    bridge.parent.path,
    "reference/mountain-ascent-sprite-work.json",
  );
  assert.equal(sha(parentBytes), bridge.parent.sha256);
  assert.deepEqual(JSON.parse(parentBytes), timing);
  assert.deepEqual(
    Object.keys(bridge.runtimeSources),
    Object.keys(timing.runtimeSources),
  );
  for (const [path, hash] of Object.entries(bridge.runtimeSources)) {
    assert.equal(
      sha(await readFile(path)),
      hash,
      `Changed mountain input bridge source ${path}`,
    );
    assert.equal(
      sha(execFileSync("git", ["show", `${BASE}:${path}`])),
      timing.runtimeSources[path],
    );
    if (path !== "src/game/mountain.js")
      assert.equal(hash, timing.runtimeSources[path]);
  }
  const baseline = JSON.parse(await readFile(timing.baseline));
  assert.equal(sha(await readFile(timing.baseline)), timing.baselineSha256);
  const stream = baseline.inputEvents.flatMap((e) =>
    Array(e.count).fill(e.byte),
  );
  assert.equal(stream.length, 764);
  const historical = await historicalMountain();
  assert.equal(
    historical.graph["src/game/mountain.js"],
    timing.runtimeSources["src/game/mountain.js"],
  );
  function replay(Class) {
    const g = new Class({ ...resources, ...baseline.initial }),
      cache = createMountainRasterCache(),
      boundaries = [],
      pictures = [];
    let shown = g.presentations;
    assert.equal(shown, 0);
    Object.defineProperty(g, "presentations", {
      get: () => shown,
      set: (n) => {
        assert.equal(n, shown + 1, "Skipped mountain publication");
        shown = n;
        pictures.push({
          commands: structuredClone(g.current),
          pixels: sha(
            renderMountainPixels(
              g.current,
              g.entries,
              resources.mainEntries[42].data,
              g.memory,
              cache,
            ),
          ),
        });
      },
    });
    for (let step = 0; step < 20000 && !g.outcome; step++) {
      const index = g.inputs.length,
        byte = stream[index] ?? 0;
      g.setControls({
        fire: Boolean(byte & 0xc0),
        direction:
          { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 63] ?? null,
      });
      g.advanceTick();
      g.advanceRetrace();
      if (g.inputs.length !== index) {
        assert.equal(g.inputs.length, index + 1);
        assert.ok(index < 764);
        assert.equal(g.inputs.at(-1).input, byte);
        boundaries.push({
          memory: Uint8Array.from(g.memory.bytes),
          locals: Uint8Array.from(g.locals.bytes),
          snapshot: structuredClone(g.snapshot()),
        });
      }
    }
    assert.ok(g.outcome, "Unfinished mountain input bridge");
    assert.equal(g.inputs.length, 764);
    assert.equal(boundaries.length, 764);
    assert.equal(pictures.length, 870);
    return { g, boundaries, pictures, finalEvents: g.drainEvents() };
  }
  const old = replay(historical.Mountain),
    current = replay(Mountain);
  function exact() {
    assert.deepEqual(
      current.boundaries,
      old.boundaries,
      "Mountain source-boundary memory/locals/state changed",
    );
    assert.deepEqual(
      current.pictures,
      old.pictures,
      "Mountain ordered commands/pixels changed",
    );
    assert.deepEqual(current.g.memory.bytes, old.g.memory.bytes);
    assert.deepEqual(current.g.locals.bytes, old.g.locals.bytes);
    assert.deepEqual(current.g.snapshot(), old.g.snapshot());
    assert.deepEqual(current.finalEvents, old.finalEvents);
  }
  exact();
  current.boundaries[0].memory[0x2229] ^= 1;
  assert.throws(exact, /Mountain source-boundary memory/);
  current.boundaries[0].memory[0x2229] ^= 1;
  const picture = current.pictures[10].pixels;
  current.pictures[10].pixels = "changed";
  assert.throws(exact, /Mountain ordered commands\/pixels/);
  current.pictures[10].pixels = picture;
  exact();
  console.log(
    "Mountain input bridge:764 complete DS/locals/snapshot boundaries and870 ordered command/pixel publications match historical source exactly,including every timer byte;two negative controls. All26 ascent checkpoints and old timing outputs remain required separately.",
  );
}
