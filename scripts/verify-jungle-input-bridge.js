import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Jungle } from "../src/game/jungle.js";
import { sha, replayJungleComponent } from "./jungle-component-replay.js";
const BASE = "590a2fa31a0de2bcc6b4228d29b041df2bd93226";
const imports = /\bfrom\s+["'](\.[^"']+)["']/g;
async function historicalJungleInput() {
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
      throw Error(`SETUP: missing historical jungle source ${BASE}:${path}`);
    }
    graph[path] = sha(b);
    if (path !== "src/game/jungle.js")
      assert.equal(
        sha(await readFile(path)),
        graph[path],
        `Changed jungle bridge dependency ${path}`,
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
  const source = await visit("src/game/jungle.js"),
    rewritten = source.replace(imports, (all, dep) =>
      all.replace(dep, pathToFileURL(resolve("src/game", dep)).href),
    );
  return {
    Jungle: (
      await import(
        `data:text/javascript;base64,${Buffer.from(rewritten).toString("base64")}`
      )
    ).Jungle,
    graph,
  };
}
let verified;
export function verifyJungleInputBridge(resources) {
  return (verified ??= verify(resources));
}
async function verify(resources) {
  const bridge = JSON.parse(
    await readFile("reference/jungle-input-bridge.json"),
  );
  assert.equal(bridge.historicalRevision, BASE);
  assert.equal(bridge.expectedValuesChanged, false);
  assert.deepEqual(bridge.exclusions, []);
  assert.deepEqual(
    bridge.scenarios.map((s) => [
      s.parent.path,
      s.expectedInputBoundaries,
      s.expectedPublications,
    ]),
    [
      ["reference/jungle-component-drawing-time.json", 824, 875],
      ["reference/jungle-treasure-drawing-time.json", 792, 839],
    ],
  );
  const historical = await historicalJungleInput();
  for (const [path, hash] of Object.entries(bridge.runtimeSources))
    assert.equal(
      sha(await readFile(path)),
      hash,
      `Changed jungle input bridge source ${path}`,
    );
  let polls = 0,
    publications = 0;
  for (const spec of bridge.scenarios) {
    const bytes = await readFile(spec.parent.path);
    assert.equal(sha(bytes), spec.parent.sha256);
    const timing = JSON.parse(bytes);
    assert.deepEqual(
      Object.keys(bridge.runtimeSources),
      Object.keys(timing.runtimeSources),
    );
    for (const [path, hash] of Object.entries(timing.runtimeSources)) {
      assert.equal(historical.graph[path], hash);
      if (path !== "src/game/jungle.js")
        assert.equal(bridge.runtimeSources[path], hash);
    }
    const inputBytes = await readFile(timing.parent.path);
    assert.equal(sha(inputBytes), timing.parent.sha256);
    const manifest = JSON.parse(inputBytes);
    function replay(Class) {
      let instance;
      class Observed extends Class {
        constructor(...args) {
          super(...args);
          instance = this;
        }
      }
      const boundaries = [],
        pictures = [];
      const result = replayJungleComponent({
        resources,
        manifest,
        JungleClass: Observed,
        onPoll({ inputCount, bytes }) {
          boundaries.push({
            inputCount,
            bytes,
            snapshot: structuredClone(instance.snapshot()),
          });
        },
        onPresentation(p) {
          pictures.push(p);
        },
      });
      assert.equal(boundaries.length, spec.expectedInputBoundaries);
      assert.equal(pictures.length, spec.expectedPublications);
      return { boundaries, pictures, result };
    }
    const old = replay(historical.Jungle),
      current = replay(Jungle);
    function exact() {
      assert.deepEqual(
        current.boundaries,
        old.boundaries,
        "Jungle bridge entire input-boundary DS/state changed",
      );
      assert.deepEqual(
        current.pictures,
        old.pictures,
        "Jungle bridge ordered pixels/modes/wipes changed",
      );
      assert.deepEqual(
        current.result,
        old.result,
        "Jungle bridge timing/checkpoints/final state changed",
      );
    }
    exact();
    current.boundaries[0].bytes[0x2221] ^= 1;
    assert.throws(exact, /Jungle bridge entire input-boundary/);
    current.boundaries[0].bytes[0x2221] ^= 1;
    const original = current.pictures[10].sha256;
    current.pictures[10].sha256 = "changed";
    assert.throws(exact, /Jungle bridge ordered pixels/);
    current.pictures[10].sha256 = original;
    exact();
    polls += current.boundaries.length;
    publications += current.pictures.length;
  }
  assert.equal(polls, 1616);
  assert.equal(publications, 1714);
  console.log(
    "Jungle input bridge:1616 entire source-boundary DS/states,1714 ordered pixels/modes/wipes and all clocks/final states match historical source exactly;four negative controls. No exclusions;existing historical and drawing-time expectations remain required.",
  );
}
