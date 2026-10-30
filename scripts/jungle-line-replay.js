// Retain the exact pre-line runtime as a comparison, never as production code.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { sha, replayJungleComponent } from "./jungle-component-replay.js";
import { checkpointTiming } from "./verify-jungle-component-timing.js";
const imports = /\bfrom\s+["'](\.[^"']+)["']/g;
export async function preLineJungle() {
  const revision = execFileSync("git", ["rev-parse", "a20ca90"], {
    encoding: "utf8",
  }).trim();
  const graph = {};
  function bytes(path) {
    return execFileSync("git", ["show", `${revision}:${path}`], {
      maxBuffer: 4 * 1024 * 1024,
    });
  }
  async function visit(path) {
    if (graph[path]) return;
    const b = bytes(path);
    graph[path] = sha(b);
    if (!["src/game/jungle-work.js"].includes(path))
      assert.equal(
        sha(await readFile(path)),
        graph[path],
        `Changed pre-line dependency ${path}`,
      );
    for (const m of b.toString().matchAll(imports)) {
      const dep = relative(process.cwd(), resolve(dirname(path), m[1]));
      assert.ok(dep.startsWith("src/"));
      await visit(dep);
    }
  }
  await visit("src/game/jungle.js");
  function rewrite(path, overrides = {}) {
    return bytes(path)
      .toString()
      .replace(imports, (all, p) =>
        all.replace(
          p,
          overrides[relative(process.cwd(), resolve(dirname(path), p))] ??
            pathToFileURL(resolve(dirname(path), p)).href,
        ),
      );
  }
  const work = `data:text/javascript;base64,${Buffer.from(rewrite("src/game/jungle-work.js")).toString("base64")}`;
  const source = rewrite("src/game/jungle.js", {
    "src/game/jungle-work.js": work,
  });
  return {
    Jungle: (
      await import(
        `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
      )
    ).Jungle,
    graph,
    revision,
  };
}
export async function verifyPreLine(resources, parent, fixturePath, profile) {
  const old = await preLineJungle(),
    fixture = JSON.parse(await readFile(fixturePath));
  const run = replayJungleComponent({
    resources,
    manifest: parent,
    JungleClass: old.Jungle,
  });
  assert.equal(
    run.events,
    fixture.expectedClockEventCount,
    "Pre-line event count",
  );
  assert.equal(
    run.clockTraceSha256,
    fixture.clockTraceSha256,
    "Pre-line clock trace",
  );
  assert.equal(
    run.presentationTimingSha256,
    fixture.presentationTimingSha256,
    "Pre-line presentation timing",
  );
  assert.deepEqual(
    run.checkpoints.map(checkpointTiming),
    fixture.checkpoints,
    "Pre-line timing checkpoints",
  );
  assert.deepEqual(
    {
      ...checkpointTiming({ inputCount: profile.inputs, ...run.final }),
      clockWords: run.finalClockWords,
    },
    fixture.finalTiming,
  );
  return { ...old, run };
}
