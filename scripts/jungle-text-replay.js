// Preserve historical runtimes when the new source formatter changes a shared
// presentation module. Only these three translated modules may differ.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { sha } from "./jungle-component-replay.js";
const imports = /\bfrom\s+["'](\.[^"']+)["']/g;
export async function frozenJungle(revision) {
  const graph = {},
    sources = {},
    overrides = new Set([
      "src/game/jungle.js",
      "src/game/jungle-work.js",
      "src/game/jungle-presentation.js",
    ]);
  const commit = execFileSync("git", ["rev-parse", revision], {
    encoding: "utf8",
  }).trim();
  async function visit(path) {
    if (graph[path]) return;
    const b = execFileSync("git", ["show", commit + ":" + path]);
    graph[path] = sha(b);
    sources[path] = b.toString();
    if (!overrides.has(path))
      assert.equal(
        sha(await readFile(path)),
        graph[path],
        "Changed frozen jungle dependency " + path,
      );
    assert.doesNotMatch(sources[path], /\bimport\s*\(/);
    for (const m of sources[path].matchAll(imports)) {
      const dep = relative(process.cwd(), resolve(dirname(path), m[1]));
      assert.ok(dep.startsWith("src/"));
      await visit(dep);
    }
  }
  await visit("src/game/jungle.js");
  const cache = {};
  function module(path) {
    if (cache[path]) return cache[path];
    const body = sources[path].replace(imports, (all, p) => {
      const dep = relative(process.cwd(), resolve(dirname(path), p));
      return all.replace(
        p,
        overrides.has(dep) ? module(dep) : pathToFileURL(resolve(dep)).href,
      );
    });
    return (cache[path] =
      "data:text/javascript;base64," + Buffer.from(body).toString("base64"));
  }
  return {
    Jungle: (await import(module("src/game/jungle.js"))).Jungle,
    graph,
    revision: commit,
  };
}
