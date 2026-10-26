import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import build from "../reference/build.json" with { type: "json" };
import manifest from "../reference/jungle-maps.json" with { type: "json" };
import { parseArchive } from "../src/assets.js";
import { verifyJungleControls } from "./verify-jungle-controls.js";
import { verifyJungleAnimation } from "./verify-jungle-animation.js";
import { unpackImage } from "../src/game/executable.js";
import {
  parseJungleMap,
  prepareJungleMap,
  jungleStartingPlatform,
} from "../src/game/jungle-map.js";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const resources = {};
for (const name of ["DUCKTALE.EXE", "JG.ARC", "MAIN.ARC"]) {
  const bytes = await readFile(`game/${name}`).catch(() => {
    throw Error(`SETUP: missing game/${name}; see docs/jungle.md`);
  });
  assert.equal(bytes.length, build.files[name].bytes, `${name}: byte length`);
  assert.equal(
    hash(bytes),
    build.files[name].sha256,
    `${name}: corrupt/unsupported original`,
  );
  resources[name] = bytes;
}
const image = unpackImage(resources["DUCKTALE.EXE"]),
  entries = parseArchive(resources["JG.ARC"]);
assert.equal(entries.length, 20);
assert.equal(manifest.expectedCaseCount, 3);
assert.equal(manifest.expectedInputCount, 0);
assert.deepEqual(manifest.inputEvents, []);

function compare({ alterRecord = false, omitCase = false } = {}) {
  const cases = structuredClone(manifest.cases);
  if (omitCase) cases.pop();
  assert.equal(cases.length, 3, "missing static case");
  let executed = 0,
    records = 0;
  for (const c of cases) {
    assert.equal(c.variant, executed, "variant/case order");
    const { memory, sections } = prepareJungleMap({
      image,
      entries,
      variant: c.variant,
    });
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(sections).map(([key, s]) => [key, s.count]),
      ),
      c.counts,
    );
    assert.equal(
      Object.values(sections).reduce((n, s) => n + s.rows.length, 0),
      c.recordCount,
    );
    assert.deepEqual(jungleStartingPlatform(memory), c.start);
    if (alterRecord && c.variant === 0) memory.i(0x6040 + 31 * 50 + 4, 0);
    assert.equal(
      hash(memory.bytes),
      c.memorySha256,
      `variant${c.variant} DS divergence`,
    );
    // Suppressed B labels must not alias the last two variant0 records.
    if (c.variant === 0) {
      assert.equal(memory.i(0x6040 + 30 * 50 + 4), 0);
      assert.equal(memory.i(0x6040 + 31 * 50 + 4), 1);
      assert.equal(sections.B.rows[30].label, 30);
      assert.equal(sections.B.rows[31].label, 30);
    }
    records += c.recordCount;
    executed++;
  }
  assert.equal(executed, 3, "zero/incomplete static cases");
  assert.equal(records, 348, "missing map records");
  return { executed, records };
}
const result = compare();
assert.throws(() => compare({ alterRecord: true }), /DS divergence/);
assert.throws(() => compare({ omitCase: true }), /missing static case/);
const changed = (text) => ({
  ...entries[1],
  data: new TextEncoder().encode(text),
});
const text = new TextDecoder("ascii").decode(entries[1].data);
assert.throws(
  () => parseJungleMap(changed(text.replace("L 11", "L 12"))),
  /Invalid jungle section L/,
);
assert.throws(
  () =>
    parseJungleMap(
      changed(text.replace(/\r\nX 3\r\n[\s\S]*?\r\n;#  type/, "\r\n;#  type")),
    ),
  /section X/,
);
assert.throws(
  () => parseJungleMap(changed(text.replace("450  16", "32768  16"))),
  /field count\/width/,
);
assert.throws(
  () => prepareJungleMap({ image, entries, variant: 3 }),
  /contract/,
);
// F16 is physically present in variant0 but outside its declared16 records.
const trailingMutation = text.replace("16  18\t 1     2", "16  99  99  99");
assert.notEqual(
  trailingMutation,
  text,
  "trailing-row probe did not change its input",
);
const ignored = prepareJungleMap({
  image,
  entries: [entries[0], changed(trailingMutation)],
  variant: 0,
});
assert.equal(
  hash(ignored.memory.bytes),
  manifest.cases[0].memorySha256,
  "trailing F record must stay unused",
);
// Map loading is sparse and preserves the incoming allocation's unrelated bytes.
ignored.memory.b(0x9000, 123);
prepareJungleMap({ image, entries, variant: 0 }, ignored.memory);
assert.equal(ignored.memory.b(0x9000), 123);
console.log(
  `Jungle maps: ${result.executed} exact static DS cases,${result.records} declared records,3 starting-platform scans; negative controls reject record corruption,missing cases/sections,invalid counts/widths/variants. Original duplicate B labels and unused F16 preserved. No gameplay/runtime parity claimed.`,
);

await verifyJungleAnimation({
  image,
  entries,
  mainEntries: parseArchive(resources["MAIN.ARC"]),
  executableRaw: resources["DUCKTALE.EXE"],
});

await verifyJungleControls({
  entries,
  mainEntries: parseArchive(resources["MAIN.ARC"]),
});
