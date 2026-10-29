import { verifySharedRuntimeFile } from "./shared-runtime-regression.js";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { PNG } from "pngjs";
const catalogPath =
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice(11) ??
  "reference/office-hard-expeditions.json";
const catalog = JSON.parse(await readFile(catalogPath));
assert.ok(
  [undefined, "office"].includes(catalog.verificationEdition),
  "Unknown Hard expedition evidence edition",
);
const officeEdition = catalog.verificationEdition === "office";
const hash = (b) => createHash("sha256").update(b).digest("hex");
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
const load = (p) =>
  readFile(p).catch(() => {
    throw Error(`SETUP: missing Hard expedition artifact ${p}`);
  });
const json = async (p) => JSON.parse(await load(p));
assert.equal(catalog.pending, false);
assert.equal(catalog.browserVerified, true);
assert.equal(catalog.expectedCaseCount, 4);
assert.equal(catalog.expectedFullCheckpointCount, 169);
assert.equal(catalog.expectedEventCount, officeEdition ? 3978 : 3970);
assert.equal(
  Object.keys(catalog.artifacts).length,
  officeEdition ? 57 : 53,
  "Missing required evidence",
);
assert.deepEqual(
  catalog.cases.map((c) => c.key),
  ["bermuda", "boola", "thunderclap", "machu"],
);
assert.equal(
  hash(await load(catalog.buildManifest)),
  catalog.buildManifestSha256,
);
for (const [name, spec] of Object.entries(catalog.artifacts)) {
  const b = await load(spec.path);
  assert.equal(b.length, spec.bytes, name);
  assert.equal(hash(b), spec.sha256, `Corrupt ${name}`);
}
for (const [p, h] of Object.entries(catalog.verificationTools))
  assert.equal(hash(await load(p)), h, `Changed verifier ${p}`);
const producers = officeEdition
  ? [
      [
        "capture-source",
        catalog.captureCommit,
        catalog.captureSourceArchive,
        509,
      ],
      [
        "browser-source",
        catalog.browserCommit,
        catalog.browserSourceArchive,
        514,
      ],
      [
        "entry-browser-source",
        catalog.entryBrowserCommit,
        catalog.entryBrowserSourceArchive,
        515,
      ],
    ]
  : [
      [
        "capture-source",
        catalog.captureCommit,
        `${catalog.captureRoot}/sources`,
        152,
      ],
      [
        "browser-source",
        catalog.browserCommit,
        `${catalog.artifactRoot}/browser-sources`,
        153,
      ],
      [
        "entry-capture-source",
        catalog.entryCaptureCommit,
        `${catalog.entryCaptureRoot}/sources`,
        141,
      ],
      [
        "entry-browser-source",
        catalog.entryBrowserCommit,
        `${catalog.entryArtifactRoot}/browser-sources`,
        88,
      ],
    ];
for (const [name, commit, archive, count] of producers) {
  const producer = await json(catalog.artifacts[name].path);
  assert.equal(producer.captureCommit ?? producer.browserCommit, commit);
  assert.equal(Object.keys(producer.files).length, count);
  for (const [p, h] of Object.entries(producer.files)) {
    assert.equal(hash(await load(`${archive}/${p}`)), h, p);
    assert.equal(hash(execFileSync("git", ["show", `${commit}:${p}`])), h, p);
  }
}
function report(r, count) {
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.expected, count);
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(r.stats[k], 0);
  const tests = [];
  function visit(s) {
    for (const spec of s.specs ?? []) tests.push(...spec.tests);
    for (const child of s.suites ?? []) visit(child);
  }
  r.suites.forEach(visit);
  assert.equal(tests.length, count);
  for (const t of tests) {
    assert.equal(t.status, "expected");
    assert.equal(t.results.length, 1);
    assert.equal(t.results[0].status, "passed");
  }
}
report(await json(catalog.artifacts["browser-results"].path), 8);
const entryReport = await json(catalog.artifacts["entry-browser-results"].path);
report(entryReport, officeEdition ? 17 : 4);
if (officeEdition) {
  const runner = await json(catalog.artifacts["entry-browser-runner"].path);
  assert.equal(runner.exitCode, 0, "Entry browser runner failed");
  assert.equal(runner.sourceCommit, catalog.entryBrowserCommit);
  const suites = entryReport.suites;
  assert.deepEqual(
    suites.map((suite) => [suite.file, suite.specs.length]),
    [
      ["ending-audio.spec.js", 2],
      ["ending.spec.js", 3],
      ["game.spec.js", 5],
      ["hard-entry-replay.spec.js", 4],
      ["security.spec.js", 2],
      ["system-controls.spec.js", 1],
    ],
    "Missing office integration browser cases",
  );
  assert.deepEqual(
    suites
      .find((suite) => suite.file === "hard-entry-replay.spec.js")
      .specs.map((spec) => spec.title),
    catalog.cases.map(
      (row) =>
        `Hard ${row.key} entry replays independent DOM input through security and the race`,
    ),
  );
}
const hardSource = await json(catalog.artifacts["shared-hard-source"].path);
const hardSourceCommit = officeEdition
  ? hardSource.browserCommit
  : hardSource.commit;
assert.equal(hardSourceCommit, catalog.sharedHardCommit);
assert.equal(Object.keys(hardSource.files).length, officeEdition ? 498 : 266);
for (const [p, h] of Object.entries(hardSource.files)) {
  if (
    officeEdition &&
    (p.startsWith("src/") ||
      [
        "index.html",
        "vite.config.js",
        "tests/browser/helpers/recorded-campaign.js",
        "tests/browser/helpers/clock.js",
      ].includes(p))
  )
    await verifySharedRuntimeFile(
      p,
      h,
      catalog.currentRuntimeRegression,
      "hard",
    );
  assert.equal(
    hash(
      await load(
        `${officeEdition ? catalog.sharedHardSourceArchive : `${catalog.artifactRoot}/shared-hard-sources`}/${p}`,
      ),
    ),
    h,
    p,
  );
  assert.equal(
    hash(execFileSync("git", ["show", `${hardSourceCommit}:${p}`])),
    h,
    p,
  );
}
report(await json(catalog.artifacts["shared-hard-results"].path), 1);
const hardReference = await json(
  officeEdition
    ? catalog.artifacts["shared-hard-reference"].path
    : "reference/hard-campaign-security.json",
);
if (officeEdition) assert.equal(hardSourceCommit, hardReference.replayCommit);
const hardObserved = await json(
  catalog.artifacts["shared-hard-checkpoints"].path,
);
assert.equal(hardObserved.length, 28);
for (let i = 0; i < 28; i++)
  for (const k of ["name", "stateSha256", "pixelsSha256"])
    assert.equal(
      hardObserved[i][k],
      hardReference.browserCheckpoints[i][k],
      `Shared Hard checkpoint${i} ${k}`,
    );
const hardProgress = await json(catalog.artifacts["shared-hard-progress"].path);
assert.equal(hardProgress.completed, true);
assert.equal(hardProgress.consumed, 4140);
assert.deepEqual(hardProgress.errors, []);
assert.equal(hardProgress.navigation.length, 1);
assert.equal(
  (await json(catalog.artifacts["shared-hard-events"].path)).length,
  4140,
);
const inputCatalog = await json(catalog.artifacts["input-profile"].path);
assert.equal(inputCatalog.cases.length, 4);
const root = officeEdition
  ? ".local/office-hard-expeditions-verification"
  : ".local/security-hard-expeditions-verification";
await mkdir(root, { recursive: true });
let checked = 0,
  consumed = 0,
  rendered = 0;
for (const row of catalog.cases) {
  const physicalNegative = (
    await load(catalog.artifacts[`negative-${row.key}`].path)
  ).toString();
  assert.match(
    physicalNegative,
    /Error: Carried browser state\d+ input-\d+|Error: Recorded external event sequence/,
  );
  assert.match(physicalNegative, /1 failed/);
  assert.doesNotMatch(
    physicalNegative,
    /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
  );
  const m = await json(catalog.artifacts[`manifest-${row.key}`].path),
    inputs = inputCatalog.cases.find((c) => c.key === row.key);
  assert.equal(m.pending, false);
  assert.equal(m.browserVerified, true);
  assert.equal(m.milestone, "hard-expedition-bank");
  assert.equal(m.expectedHard, true);
  assert.equal(m.key, row.key);
  assert.equal(m.expectedInputCount, row.expectedInputs);
  assert.equal(m.expectedCheckpointCount, row.expectedCheckpoints);
  assert.equal(m.requiredEventCount, row.expectedEvents);
  assert.equal(m.captureCommit, catalog.captureCommit);
  if (officeEdition) {
    assert.equal(m.verificationEdition, "office");
    const env = await json(
      catalog.artifacts[`capture-environment-${row.key}`].path,
    );
    assert.equal(env.completed, false);
  }
  assert.equal(m.expectedOutcome.lives, 3);
  assert.equal(m.expectedOutcome.money, 0);
  assert.equal(m.expectedOutcome.day, 6);
  assert.equal(m.expectedOutcome.banked, row.expectedDeposit);
  assert.equal(
    Object.keys(m.artifacts).length,
    m.expectedCheckpointCount + 6,
    "Missing required case evidence",
  );
  for (const [name, spec] of Object.entries(m.artifacts)) {
    const b = await load(spec.path);
    assert.equal(b.length, spec.bytes, `${row.key} ${name}`);
    assert.equal(hash(b), spec.sha256, `Corrupt ${row.key} ${name}`);
  }
  for (const name of ["captured-events", "campaign-checkpoints", "timeline"])
    assert.equal(
      hash(await load(`${m.captureRoot}/${name}.json`)),
      m.artifacts[name].sha256,
      `Changed captured ${row.key} ${name}`,
    );
  const codes = inputs.inputEvents.flatMap(({ byte, count }) => {
    assert.ok(
      Number.isInteger(count) && count > 0 && count <= inputs.inputCount,
    );
    assert.ok([0, 1, 3, 5, 7, 64, 65, 67, 69, 71].includes(byte));
    return Array(count).fill(byte);
  });
  assert.equal(codes.length, row.expectedInputs);
  assert.equal(hash(Buffer.from(codes)), inputs.sha256);
  const legacy = await load(inputs.legacyInputs);
  assert.equal(hash(legacy), inputs.legacyInputSha256);
  assert.deepEqual(codes, [
    ...Array(inputs.authoredNeutralPrefix).fill(0),
    ...JSON.parse(legacy)[inputs.activity].flatMap((e) =>
      Array(e.count).fill(e.byte),
    ),
  ]);
  assert.equal(inputs.authoredNeutralPrefix, row.key === "bermuda" ? 3 : 0);
  const checks = await json(m.artifacts["campaign-checkpoints"].path);
  assert.equal(checks.length, row.expectedCheckpoints);
  let n = 0;
  const boundaries = new Set();
  for (const r of inputs.inputEvents) {
    n += r.count;
    boundaries.add(n);
  }
  const expectedNames = [
    "entry",
    ...Array.from({ length: inputs.inputCount }, (_, i) => i + 1)
      .filter((i) => i % 40 === 0 || boundaries.has(i))
      .map((i) => `input-${i}`),
    "award",
    "returned-map",
    "bank",
    "deposited",
  ];
  assert.deepEqual(
    checks.map((c) => c.name),
    expectedNames,
  );
  for (const c of checks) {
    assert.equal(
      hash(canonical(c.state)),
      c.stateSha256,
      `${row.key} ${c.name}`,
    );
    const png = PNG.sync.read(await load(m.artifacts[`png-${c.name}`].path));
    assert.deepEqual([png.width, png.height], [320, 200]);
    assert.equal(hash(png.data), c.pixelsSha256);
  }
  const entryPath = officeEdition
    ? catalog.artifacts[`entry-manifest-${row.key}`].path
    : inputs.entryManifest;
  assert.equal(
    hash(await load(entryPath)),
    catalog.artifacts[`entry-manifest-${row.key}`].sha256,
  );
  const entry = await json(entryPath),
    entryChecks = await json(entry.artifacts["campaign-checkpoints"].path);
  if (officeEdition) {
    assert.equal(entry.requiredEventCount, 956);
    assert.equal(entry.expectedCheckpointCount, 1);
    for (const [name, spec] of Object.entries(entry.artifacts)) {
      const bytes = await load(spec.path);
      assert.equal(bytes.length, spec.bytes, `${row.key} entry ${name}`);
      assert.equal(
        hash(bytes),
        spec.sha256,
        `Corrupt ${row.key} entry ${name}`,
      );
    }
    assert.deepEqual(
      await json(entry.artifacts["captured-events"].path),
      (await json(m.artifacts["captured-events"].path)).slice(0, 956),
      "Entry view must retain the exact external event prefix",
    );
    assert.equal(m.entryStateSha256, checks[0].stateSha256);
    assert.equal(m.entryPixelsSha256, checks[0].pixelsSha256);
  }
  assert.equal(
    hash(
      PNG.sync.read(await load(catalog.artifacts[`entry-png-${row.key}`].path))
        .data,
    ),
    checks[0].pixelsSha256,
  );
  for (const k of ["at", "eventCount", "stateSha256", "pixelsSha256"])
    assert.equal(
      checks[0][k],
      entryChecks[0][k],
      `${row.key} ${officeEdition ? "same-capture entry view" : "independent entry"} ${k}`,
    );
  assert.equal(checks[0].state.briefing.variant, inputs.variant);
  assert.equal(checks[0].state[inputs.activity].lives, 3);
  assert.equal(checks[0].state.flight.outcome.code, 1);
  function compare(points) {
    assert.equal(
      points.length,
      row.expectedCheckpoints,
      "Missing browser checkpoints",
    );
    for (let i = 0; i < points.length; i++)
      for (const k of [
        "name",
        "at",
        "eventCount",
        "stateSha256",
        "pixelsSha256",
      ])
        assert.deepEqual(
          points[i][k],
          m.checkpoints[i][k],
          `${row.key} browser checkpoint${i} ${k}`,
        );
  }
  const browser = await json(
    catalog.artifacts[`${row.key}-browser-checkpoints`].path,
  );
  compare(browser);
  const altered = structuredClone(browser);
  altered[0].pixelsSha256 = "0".repeat(64);
  assert.throws(() => compare(altered), /browser checkpoint0 pixelsSha256/);
  assert.throws(() => compare(browser.slice(1)), /Missing browser checkpoints/);
  const progress = await json(
    catalog.artifacts[`${row.key}-browser-progress`].path,
  );
  assert.equal(progress.completed, true);
  assert.equal(progress.consumed, row.expectedEvents);
  assert.equal(progress.expectedEvents, row.expectedEvents);
  assert.deepEqual(progress.errors, []);
  assert.equal(progress.navigation.length, 1);
  assert.equal(
    (await json(catalog.artifacts[`${row.key}-browser-events`].path)).length,
    row.expectedEvents,
  );
  {
    const entryProgress = await json(
      catalog.artifacts[`${row.key}-entry-progress`].path,
    );
    const eventCount = officeEdition ? 956 : 954;
    assert.equal(entryProgress.completed, true);
    assert.equal(entryProgress.consumed, eventCount);
    assert.equal(entryProgress.expectedEvents, eventCount);
    assert.deepEqual(entryProgress.errors, []);
    assert.equal(entryProgress.navigation.length, 1);
    const entryBrowser = await json(
      catalog.artifacts[`${row.key}-entry-checkpoints`].path,
    );
    function compareEntry(points) {
      assert.equal(points.length, 1, "Missing entry browser checkpoint");
      for (const key of [
        "name",
        "at",
        "eventCount",
        "stateSha256",
        "pixelsSha256",
      ])
        assert.deepEqual(
          points[0][key],
          // Historical independent entries have their own checkpoint label;
          // state, pixels, timestamp and event count still match the full route.
          key === "name" ? entryChecks[0][key] : checks[0][key],
          `${row.key} entry browser ${key}`,
        );
      assert.equal(hash(canonical(points[0].state)), checks[0].stateSha256);
    }
    compareEntry(entryBrowser);
    const alteredEntry = structuredClone(entryBrowser);
    alteredEntry[0].pixelsSha256 = "0".repeat(64);
    assert.throws(
      () => compareEntry(alteredEntry),
      /entry browser pixelsSha256/,
    );
    assert.throws(() => compareEntry([]), /Missing entry browser checkpoint/);
    assert.deepEqual(entryProgress.lastState, entryBrowser[0].state);
    const entryEvents = await json(
      catalog.artifacts[`${row.key}-entry-events`].path,
    );
    assert.equal(entryEvents.length, eventCount);
    if (officeEdition) {
      const boundary = ({ time, type, key, target, x, y }) => ({
        time,
        type,
        key,
        target,
        ...(type === "pointerdown" && target === "game"
          ? {
              x: Math.max(32, Math.min(285, Math.trunc(x))),
              y: Math.max(28, Math.min(151, Math.trunc(y))),
            }
          : {}),
      });
      assert.deepEqual(
        entryEvents.map(boundary),
        (await json(entry.artifacts["captured-events"].path)).map(boundary),
        "Entry DOM events must equal the independent recording",
      );
      const held = new Set();
      for (const event of entryEvents) {
        if (event.type === "keydown") held.add(event.key);
        if (event.type === "keyup") held.delete(event.key);
      }
      assert.deepEqual([...held], [], "Unreleased entry controls");
    }
  }
  function replay(mode) {
    const r = spawnSync(
      process.execPath,
      [
        "scripts/replay-hard-campaign.js",
        m.artifactRoot,
        `--manifest=${row.manifest}`,
        ...(mode ? [`--negative=${mode}`] : []),
      ],
      { encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 },
    );
    assert.ifError(r.error);
    return { ...r, output: r.stdout + "\n" + r.stderr };
  }
  const positive = replay();
  await writeFile(`${root}/${row.key}-positive.log`, positive.output);
  assert.equal(positive.status, 0, positive.output);
  const result = JSON.parse(positive.stdout);
  assert.equal(result.mode, "recorded-input replay");
  assert.equal(result.checked, row.expectedCheckpoints);
  assert.equal(result.consumed, row.expectedEvents);
  assert.equal(result.rendered, 396);
  assert.equal(result.flagAliasPresentations, 0);
  assert.deepEqual(result.heldAtExploratoryEndpoint, []);
  const s = result.state,
    a = s[inputs.activity];
  assert.deepEqual(
    {
      money: s.money,
      banked: s.campaign.banked,
      day: s.campaign.day,
      playerCollected: s.campaign.playerCollected,
      ...Object.fromEntries(
        ["frames", "presentations", "lives", "seed"].map((k) => [k, a[k]]),
      ),
    },
    m.expectedOutcome,
  );
  for (const [mode, reason] of [
    [
      "wrong-security",
      /Unsupported security input map|Carried replay checkpoint0 entry/,
    ],
    ["alter-checkpoint", /Carried replay checkpoint0 entry/],
    ["omit-checkpoint", /Missing required checkpoints/],
  ]) {
    const r = replay(mode);
    await writeFile(`${root}/${row.key}-${mode}.log`, r.output);
    assert.equal(r.status, 1, mode);
    assert.match(r.output, reason);
    assert.doesNotMatch(r.output, /SETUP:|ENOENT|Cannot find module|Timed out/);
  }
  checked += result.checked;
  consumed += result.consumed;
  rendered += result.rendered;
}
assert.equal(checked, 169);
assert.equal(consumed, officeEdition ? 3978 : 3970);
assert.equal(rendered, 1584);
console.log(
  `Hard alternates:4 complete treasure/bank routes,169 exact Game/browser state-pixel checkpoints,${consumed} DOM events,1584 flight presentations,three lives in every route;32 comparison negatives. ${officeEdition ? "Eight complete browser cases plus four separate entry replays (within17 passing office integration cases);historical Hard28/4140 receipt preserved;changed runtime requires a separately pinned fresh regression." : "Four independent entry browser replays and full Hard28/4140 regression also pass."} Port evidence,not whole-native expedition parity.`,
);
