// Scoped source-component and independent actual-browser acceptance.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
import { planCaveVariant, runCaveVariant } from "./lib/easy-cave-variants.js";
import {
  captureCarlsbad,
  replayCarlsbad,
  CARLSBAD_POINTS,
} from "./lib/carlsbad-browser.js";
const mode = process.argv[2] ?? "verify",
  arg = (k) =>
    process.argv.find((s) => s.startsWith("--" + k + "="))?.slice(k.length + 3),
  sha = (b) => createHash("sha256").update(b).digest("hex");
const json = async (p) =>
  JSON.parse(
    await readFile(p).catch(() => {
      throw Error(
        "SETUP: missing Easy cave fixture " +
          p +
          ";see docs/easy-cave-variants.md",
      );
    }),
  );
async function spec(p) {
  const b = await readFile(p);
  return { path: p, bytes: b.length, sha256: sha(b) };
}
async function output(p) {
  assert.ok(
    p && resolve(p).startsWith(resolve(".local") + "/"),
    "Output must be a fresh ignored local directory",
  );
  await mkdir(p, { recursive: false });
  return p;
}
const captureFiles = [
  "source-revision.json", "sources.zip", "component-inputs.json",
  "component-checkpoints.json", "captured-events.json",
  "campaign-checkpoints.json", "environment.json", "timeline.json",
  "capture-status.json",
];
async function captureInventory(root) {
  return Object.fromEntries(await Promise.all(captureFiles.map(async name =>
    [name, await spec(root + "/" + name)])));
}
const loaded = (p) =>
  p.startsWith("src/") ||
  [
    "scripts/easy-cave-variants.js",
    "scripts/lib/easy-cave-variants.js",
    "scripts/lib/carlsbad-browser.js",
    "tests/helpers/original-game.js",
    "tests/browser/helpers/clock.js",
    "tests/browser/helpers/security.js",
    "tests/browser/helpers/bank-trips.js",
    "tests/browser/helpers/entry-recording.js",
    "tests/browser/helpers/recorded-dom-input.js",
    "vite.config.js",
    "vite.campaign.config.js",
    "index.html",
    "package.json",
    "package-lock.json",
    "reference/build.json",
  ].includes(p);
async function sourceCheck(source) {
  for (const [p, h] of Object.entries(source.files))
    if (loaded(p))
      assert.equal(
        sha(await readFile(p)),
        h,
        "Changed Easy cave scenario source " + p,
      );
  const actual = (
    await readdir("src", { recursive: true, withFileTypes: true })
  )
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  assert.deepEqual(
    actual,
    Object.keys(source.files)
      .filter((p) => p.startsWith("src/"))
      .sort(),
    "Unexpected runtime source file",
  );
}
async function resources() {
  const { image, archives } = await originalGame();
  return {
    image,
    entries: archives.get("EXP.ARC"),
    font: archives.get("MAIN.ARC")[42].data,
    maps: parseCaveMaps(archives.get("CAVEMAPS.ARC")),
  };
}
if (mode === "capture") {
  assert.equal(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    "",
    "SETUP: commit clean capture source",
  );
  const root = await output(arg("output")),
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    archive = execFileSync("git", ["archive", "--format=zip", commit], {
      maxBuffer: 32 * 1024 * 1024,
    });
  await writeFile(root + "/sources.zip", archive);
  const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
      .split("\0")
      .filter(Boolean),
    files = Object.fromEntries(
      await Promise.all(paths.map(async (p) => [p, sha(await readFile(p))])),
    ),
    source = { commit, archiveSha256: sha(archive), files };
  await writeFile(
    root + "/source-revision.json",
    JSON.stringify(source, null, 2) + "\n",
  );
  const r = await resources(),
    inputs = Array.from({ length: 8 }, (_, v) => planCaveVariant(r.maps[v], v));
  await writeFile(
    root + "/component-inputs.json",
    JSON.stringify(inputs, null, 2) + "\n",
  );
  const expected = inputs.map((c) => runCaveVariant(r, c));
  await writeFile(
    root + "/component-checkpoints.json",
    JSON.stringify(expected, null, 2) + "\n",
  );
  const browser = await captureCarlsbad(root);
  await sourceCheck(source);
  await writeFile(
    root + "/capture-status.json",
    JSON.stringify(
      {
        routeCompleted: browser.routeCompleted,
        accepted: false,
        componentCases: 8,
        browser,
        sourceCommit: commit,
        scope:
          "Exploratory source-component outputs and actual Carlsbad player capture;independent replay still required",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("EXPLORATORY Easy caves saved;not acceptance: " + root);
  process.exitCode = 1;
} else if (mode === "verify") {
  let root = arg("capture");
  if (!root) {
    const m = await json(
      arg("manifest") ?? "reference/easy-cave-variants.json",
    );
    assert.equal(m.id, "easy-cave-variants-carlsbad");
    assert.equal(m.componentCases, 8);
    assert.equal(m.browserCheckpoints, 12);
    assert.equal(m.accepted, true);
    for (const s of Object.values(m.artifacts)) {
      const b = await readFile(s.path).catch(() => {
        throw Error("SETUP: missing " + s.path);
      });
      assert.equal(b.length, s.bytes);
      assert.equal(sha(b), s.sha256, "Corrupt Easy cave fixture " + s.path);
    }
    root = m.captureRoot;
  }
  const out = await output(
    arg("output") ?? ".local/easy-cave-variants-verification-" + Date.now(),
  );
  let completed = false,
    result;
  try {
    const source = await json(root + "/source-revision.json");
    await sourceCheck(source);
    const archive = await readFile(root + "/sources.zip");
    assert.equal(sha(archive), source.archiveSha256);
    const committed = execFileSync(
      "git",
      ["archive", "--format=zip", source.commit],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    assert.equal(
      sha(committed),
      source.archiveSha256,
      "Changed capture archive",
    );
    const inv = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          "import json,zipfile,hashlib,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}))",
          root + "/sources.zip",
        ],
        { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
      ),
    );
    assert.deepEqual(inv, source.files, "Incomplete captured source inventory");
    const status = await json(root + "/capture-status.json");
    assert.equal(status.routeCompleted, true);
    assert.equal(status.accepted, false);
    assert.equal(status.componentCases, 8);
    const inputs = await json(root + "/component-inputs.json"),
      checks = await json(root + "/component-checkpoints.json"),
      r = await resources();
    assert.equal(inputs.length, 8);
    assert.equal(checks.length, 8);
    assert.deepEqual(
      inputs.map((c) => c.variant),
      [0, 1, 2, 3, 4, 5, 6, 7],
    );
    assert.deepEqual(
      checks.map((c) => c.variant),
      inputs.map((c) => c.variant),
    );
    let presentations = 0;
    for (let i = 0; i < 8; i++) {
      const c = runCaveVariant(r, inputs[i], checks[i]);
      presentations += c.presentations;
    }
    const missing = structuredClone(inputs[0]);
    missing.events.splice(1, 1);
    assert.throws(
      () => runCaveVariant(r, missing, checks[0]),
      /Missing cave input ordinal/,
    );
    const changed = structuredClone(checks[0]);
    changed.checkpoints[1].stateSha256 = "0".repeat(64);
    assert.throws(
      () => runCaveVariant(r, inputs[0], changed),
      /Cave variant0 checkpoint/,
    );
    const short = structuredClone(checks[0]);
    short.checkpoints.pop();
    assert.throws(
      () => runCaveVariant(r, inputs[0], short),
      /Cave variant0 checkpoint|Missing cave checkpoints/,
    );
    const events = await json(root + "/captured-events.json"),
      browserChecks = await json(root + "/campaign-checkpoints.json"),
      environment = await json(root + "/environment.json"),
      timeline = await json(root + "/timeline.json");
    assert.equal(environment.clockOrigin, 1);
    assert.equal(environment.displayMilliseconds, 8);
    assert.equal(environment.hard, false);
    assert.equal(environment.completed, false);
    assert.deepEqual(
      browserChecks.map((c) => c.name),
      CARLSBAD_POINTS,
    );
    assert.deepEqual(
      timeline.observations,
      browserChecks.map(({ name, at, eventCount }) => ({
        name,
        at,
        eventCount,
      })),
    );
    assert.equal(timeline.endAt, browserChecks.at(-1).at);
    const browser = await replayCarlsbad(events, browserChecks);
    await assert.rejects(
      () => replayCarlsbad(events, browserChecks, "omit-first-move"),
      /Carried alternate-cave state room-37/,
    );
    await sourceCheck(source);
    completed = true;
    result = {
      completed: true,
      componentCases: 8,
      componentPresentations: presentations,
      componentNegativeControls: 3,
      browser,
      browserNegativeControls: 1,
      sourceCommit: source.commit,
      captureRoot: root,
      captureInventory: await captureInventory(root),
      scope:
        "Port closed-loop component and independent actual-browser Carlsbad replay;not native whole-variant parity or full campaign",
    };
    console.log(JSON.stringify(result));
  } finally {
    await writeFile(
      out + "/result.json",
      JSON.stringify(
        result ?? { completed, error: "Required check failed" },
        null,
        2,
      ) + "\n",
    );
  }
} else if (mode === "register") {
  const root = arg("capture"),
    replay = arg("replay"),
    target = arg("manifest");
  assert.ok(root && replay && target);
  const result = await json(replay + "/result.json");
  assert.equal(result.completed, true);
  assert.equal(result.componentCases, 8);
  assert.equal(result.componentNegativeControls, 3);
  assert.equal(result.browser.checked, 12);
  assert.equal(result.browser.restart, true);
  assert.equal(result.browserNegativeControls, 1);
  const source = await json(root + "/source-revision.json");
  await sourceCheck(source);
  assert.equal(result.sourceCommit, source.commit);
  assert.equal(result.captureRoot, root);
  const artifacts = await captureInventory(root);
  assert.deepEqual(result.captureInventory, artifacts, "Replay/capture pairing changed");
  artifacts.replay = await spec(replay + "/result.json");
  const m = {
    id: "easy-cave-variants-carlsbad",
    accepted: true,
    captureRoot: root,
    componentCases: 8,
    browserCheckpoints: 12,
    browserEvents: result.browser.consumed,
    sourceCommit: source.commit,
    artifacts,
    scope: result.scope,
    environment: {
      difficulty: 0,
      biosSeed: 0,
      audioEnabled: false,
      componentClock:
        "one driver/retrace advance per step;zero-phase synthetic provider",
      browserClock: "recorded monotonic origin1,8ms observations;fixed BIOS0",
      inputBoundary:
        "ordinal source reads for components;actual DOM events/timestamps for browser",
    },
    injections: [],
    fittedInputs: [],
    partialRestore: false,
    verify: "node scripts/easy-cave-variants.js verify",
  };
  await writeFile(target, JSON.stringify(m, null, 2) + "\n", { flag: "wx" });
  console.log(
    "Registered8 complete Easy cave layouts and independent Carlsbad browser route: " +
      target,
  );
} else throw Error("Unsupported Easy cave command " + mode);
