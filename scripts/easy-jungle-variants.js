// Scoped Easy destination acceptance. Originals and captures remain local.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import {
  jungleCases,
  captureEasyJungle,
  readEasyJunglePlan,
  replayEasyJungle,
} from "./lib/easy-jungle-browser.js";
import {
  json,
  spec,
  fresh,
  archiveSource,
  checkSource,
  inventory,
  checkArtifacts,
} from "./lib/local-scenario-source.js";
const mode = process.argv[2] ?? "verify",
  arg = (k) =>
    process.argv.find((s) => s.startsWith("--" + k + "="))?.slice(k.length + 3);
const loaded = (p) =>
  p.startsWith("src/") ||
  p.startsWith("tests/browser/helpers/") ||
  [
    "scripts/easy-jungle-variants.js",
    "scripts/lib/easy-jungle-browser.js",
    "scripts/lib/local-scenario-source.js",
    "scripts/lib/carlsbad-browser.js",
    "tests/helpers/original-game.js",
    "reference/build.json",
    "reference/security-hard-expedition-inputs.json",
    "scripts/lib/recorded-browser-scenario.js",
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.js",
    "vite.campaign.config.js",
  ].includes(p);
const names = [
  "source-revision.json",
  "sources.zip",
  "cases.json",
  "capture-status.json",
  ...jungleCases.flatMap((c) =>
    [
      "captured-events.json",
      "campaign-checkpoints.json",
      "environment.json",
      "timeline.json",
    ].map((n) => c.key + "/" + n),
  ),
];
const write = async (p, v) => writeFile(p, JSON.stringify(v, null, 2) + "\n");
function expectedNames(recipe, c) {
  const b = new Set(recipe.boundaries);
  for (let i = 40; i <= c.inputs; i += 40) b.add(i);
  return [
    "office",
    "departure",
    "entry",
    ...[...b].sort((a, b) => a - b).map((n) => "input-" + n),
    "award",
    "map",
  ];
}
async function validateCases(root, cases) {
  assert.deepEqual(
    cases.map((c) => c.key),
    jungleCases.map((c) => c.key),
  );
  for (let i = 0; i < 2; i++) {
    const c = cases[i],
      plan = jungleCases[i],
      recipe = await readEasyJunglePlan(plan);
    assert.equal(c.completed, true);
    assert.equal(c.accepted, false);
    assert.equal(c.inputs, plan.inputs);
    assert.equal(c.restart, true);
    // Held controls can span many game reads; DOM events have their own count.
    assert.ok(c.requiredEventCount > 0);
    const checks = await json(
        root + "/" + c.key + "/campaign-checkpoints.json",
      ),
      events = await json(root + "/" + c.key + "/captured-events.json"),
      timeline = await json(root + "/" + c.key + "/timeline.json"),
      env = await json(root + "/" + c.key + "/environment.json");
    assert.deepEqual(
      checks.map((p) => p.name),
      expectedNames(recipe, plan),
      "Missing jungle checkpoints",
    );
    assert.equal(checks.length, c.expectedCheckpointCount);
    assert.equal(events.length, c.requiredEventCount);
    assert.equal(checks.at(-1).eventCount, events.length);
    assert.equal(timeline.endAt, checks.at(-1).at);
    assert.deepEqual(
      timeline.observations,
      checks.map(({ name, at, eventCount }) => ({ name, at, eventCount })),
    );
    assert.equal(env.completed, true);
    assert.equal(env.hard, false);
    assert.equal(env.clockOrigin, 1);
    assert.equal(env.displayMilliseconds, 8);
    const entry = checks[2].state,
      final = checks.at(-1).state;
    assert.equal(entry.difficulty, 0);
    assert.equal(entry.briefing.variant, plan.variant);
    assert.equal(entry.jungle.frames, 0);
    assert.equal(final.jungle.outcome.code, 1);
    assert.equal(final.jungle.frames, plan.inputs);
    assert.equal(final.jungle.lives, 3);
    assert.equal(final.money, plan.treasure + plan.pickups);
    assert.deepEqual(final.campaign.playerCollected, [plan.location]);
    assert.equal(final.campaign.day, entry.campaign.day + 1);
  }
}
async function replayManifest(root, c) {
  const artifacts = {};
  for (const n of [
    "captured-events",
    "campaign-checkpoints",
    "environment",
    "timeline",
  ])
    artifacts[n] = await spec(root + "/" + c.key + "/" + n + ".json");
  return {
    milestone: "jungle-treasure",
    requiredEventCount: c.requiredEventCount,
    expectedCheckpointCount: c.expectedCheckpointCount,
    expectedOutcome: c.expectedOutcome,
    artifacts,
  };
}
if (mode === "capture") {
  const root = await fresh(arg("output")),
    source = await archiveSource(root);
  await originalGame();
  const cases = [];
  for (const c of jungleCases) {
    console.log("Capturing Easy " + c.key);
    const r = await captureEasyJungle(root + "/" + c.key, c);
    cases.push({
      ...r,
      requiredEventCount: r.events,
      expectedCheckpointCount: r.checkpoints,
    });
  }
  await write(root + "/cases.json", cases);
  await validateCases(root, cases);
  await checkSource(root, loaded);
  await write(root + "/capture-status.json", {
    completed: true,
    accepted: false,
    cases: 2,
    sourceCommit: source.commit,
    scope: "Exploratory completed routes;independent replay required",
  });
  console.log("EXPLORATORY complete;not acceptance: " + root);
  process.exitCode = 1;
} else if (mode === "verify") {
  let root = arg("capture");
  if (!root) {
    const m = await json(
      arg("manifest") ?? "reference/easy-jungle-variants.json",
    );
    assert.equal(m.id, "easy-alternate-jungles");
    assert.equal(m.accepted, true);
    assert.equal(m.cases, 2);
    await checkArtifacts(m.artifacts);
    await checkArtifacts({ build: m.build.manifest });
    assert.deepEqual(m.build.files, (await json("reference/build.json")).files);
    root = m.captureRoot;
  }
  const out = await fresh(
    arg("output") ?? ".local/easy-jungle-replay-" + Date.now(),
  );
  let result;
  try {
    const source = await checkSource(root, loaded),
      before = await inventory(root, names),
      status = await json(root + "/capture-status.json"),
      cases = await json(root + "/cases.json");
    assert.equal(status.completed, true);
    assert.equal(status.accepted, false);
    assert.equal(status.cases, 2);
    assert.equal(status.sourceCommit, source.commit);
    await originalGame();
    await validateCases(root, cases);
    const results = [];
    for (const c of cases) {
      console.log("Replaying Easy " + c.key);
      const manifest = await replayManifest(root, c),
        positive = await replayEasyJungle(manifest, out + "/" + c.key);
      // Preserve the entrance make/flush. Omit the first movement make that
      // can reach a read; compare from the preceding required input checkpoint.
      const firstMove = (
        await readEasyJunglePlan(jungleCases.find((p) => p.key === c.key))
      ).firstMove;
      const negativeRoot = out + "/" + c.key + "-negative-fixtures";
      await mkdir(negativeRoot);
      const allChecks = await json(
          root + "/" + c.key + "/campaign-checkpoints.json",
        ),
        start = allChecks.findIndex(
          (p) => p.name === "input-" + (firstMove - 1),
        );
      assert.ok(start >= 0, "Missing negative input boundary");
      const checks = allChecks.slice(start),
        timeline = await json(root + "/" + c.key + "/timeline.json");
      timeline.observations = timeline.observations.slice(start);
      await write(negativeRoot + "/campaign-checkpoints.json", checks);
      await write(negativeRoot + "/timeline.json", timeline);
      const negative = structuredClone(manifest);
      negative.expectedCheckpointCount = checks.length;
      negative.artifacts["campaign-checkpoints"] = await spec(
        negativeRoot + "/campaign-checkpoints.json",
      );
      negative.artifacts.timeline = await spec(negativeRoot + "/timeline.json");
      await assert.rejects(
        () =>
          replayEasyJungle(
            negative,
            out + "/" + c.key + "-negative",
            "omit-expedition-move",
          ),
        new RegExp("Carried browser state\\d+ input-" + firstMove),
      );
      results.push({ key: c.key, ...positive, negativeControls: 1 });
    }
    assert.equal(results.length, 2);
    await checkSource(root, loaded);
    assert.deepEqual(
      await inventory(root, names),
      before,
      "Capture mutated during replay",
    );
    result = {
      completed: true,
      cases: results,
      sourceCommit: source.commit,
      captureRoot: root,
      captureInventory: before,
      scope:
        "Independent port browser replay of Easy variants1/2;not native whole-route or Hard acceptance",
    };
    console.log(JSON.stringify({ completed: true, cases: results }));
  } finally {
    await write(
      out + "/result.json",
      result ?? { completed: false, error: "Required check failed" },
    );
  }
} else if (mode === "register") {
  const root = arg("capture"),
    replay = arg("replay"),
    target = arg("manifest");
  assert.ok(root && replay && target);
  const result = await json(replay + "/result.json"),
    source = await checkSource(root, loaded);
  assert.equal(result.completed, true);
  assert.equal(result.sourceCommit, source.commit);
  assert.equal(result.captureRoot, root);
  assert.deepEqual(
    result.cases.map((c) => c.key),
    jungleCases.map((c) => c.key),
  );
  for (const c of result.cases) {
    assert.equal(c.completed, true);
    assert.equal(c.restart, true);
    assert.equal(c.negativeControls, 1);
    assert.ok(c.checked > 20 && c.consumed > 0);
  }
  const artifacts = await inventory(root, names);
  assert.deepEqual(
    result.captureInventory,
    artifacts,
    "Replay/capture pairing changed",
  );
  artifacts.replay = await spec(replay + "/result.json");
  const cases = await json(root + "/cases.json");
  await validateCases(root, cases);
  await writeFile(
    target,
    JSON.stringify(
      {
        id: "easy-alternate-jungles",
        accepted: true,
        cases: 2,
        captureRoot: root,
        sourceCommit: source.commit,
        artifacts,
        build: {
          manifest: await spec("reference/build.json"),
          files: (await json("reference/build.json")).files,
        },
        checkpoints: cases.map((c) => ({
          key: c.key,
          count: c.expectedCheckpointCount,
          events: c.requiredEventCount,
          inputs: c.inputs,
        })),
        environment: {
          difficulty: 0,
          biosSeed: 0,
          timezone: "UTC",
          audioEnabled: false,
          clockOrigin: 1,
          displayMilliseconds: 8,
        },
        injections: [],
        fittedInputs: [],
        partialRestore: false,
        scope: result.scope,
        verify: "node scripts/easy-jungle-variants.js verify",
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  console.log("Registered independent Easy alternate jungle acceptance");
} else throw Error("Unsupported jungle command " + mode);
