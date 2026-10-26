import { FlightMemory } from "./flight-physics.js";

// Physical overlay8 map loaders. Offsets are original DS words; retaining the
// sparse records lets later actions use the original collision/animation data.
const TABLES = {
  L: {
    base: 0x6a26,
    stride: 14,
    offsets: [0, 2, 4, 6, 8, 10, 12],
    capacity: 11,
  },
  A: { base: 0x95ea, stride: 8, offsets: [0, 2, 4, 6], capacity: 22 },
  B: {
    base: 0x6040,
    stride: 50,
    offsets: [0, 2, 42, 44, 4, 6, 8, 10, 12, 14, 16],
    capacity: 40,
  },
  P: {
    base: 0x397e,
    stride: 38,
    offsets: [32, 34, 36, 24, 26, 28, 30, 22],
    capacity: 5,
    indexed: true,
  },
  S: {
    base: 0x7034,
    stride: 38,
    offsets: [0, 2, 32, 34],
    capacity: 6,
    indexed: true,
  },
  V: {
    base: 0x5d40,
    stride: 34,
    offsets: [12, 14, 16, 24, 26, 28, 0, 2],
    capacity: 10,
    indexed: true,
  },
  J: { base: 0x5bb2, stride: 2, offsets: [0], capacity: 22, indexed: true },
  M: {
    base: 0x58cc,
    stride: 62,
    offsets: [22, 24, 26, 28, 30, 0],
    capacity: 6,
    indexed: true,
  },
  X: { base: 0x776e, stride: 10, offsets: [0, 2], capacity: 3, indexed: true },
  F: {
    base: 0x514a,
    stride: 32,
    offsets: [6, 4, 18],
    capacity: 17,
    indexed: true,
  },
};

export function parseJungleMap(entry) {
  if (entry?.type !== 4 || !(entry.data instanceof Uint8Array))
    throw Error("Missing original jungle map resource");
  const bytes = entry.data;
  if (bytes.length > 4000 || bytes.some((b) => b > 127 || b === 0))
    throw Error("Invalid jungle map text");
  const lines = new TextDecoder("ascii").decode(bytes).split(/\r?\n/);
  const sections = {};
  let active = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line === "\x1a") continue;
    const header = /^([A-Z])\s+(\d+)$/.exec(line);
    if (header) {
      const [, key, countText] = header;
      const table = TABLES[key],
        count = Number(countText);
      if (!table || sections[key] || count < 1 || count > table.capacity)
        throw Error(`Invalid jungle section ${key}`);
      if (active && active.rows.length !== active.count)
        throw Error(`Incomplete jungle section ${active.key}`);
      active = sections[key] = { key, count, rows: [] };
      continue;
    }
    if (!active) throw Error("Jungle record before section header");
    // Original loops stop at the declared count. Variant0 F16 is trailing
    // source material; its F header declares16 and only rows0..15 are loaded.
    if (active.rows.length === active.count) continue;
    if (!/^-?\d+(?:\s+-?\d+)*$/.test(line))
      throw Error(`Invalid jungle ${active.key} record`);
    const values = line.split(/\s+/).map(Number),
      table = TABLES[active.key];
    if (
      values.length !== table.offsets.length + 1 ||
      values.some((v) => v < -32768 || v > 32767)
    )
      throw Error(`Invalid jungle ${active.key} field count/width`);
    const label = values.shift();
    if (table.indexed && (label < 0 || label >= table.capacity))
      throw Error(`Invalid jungle ${active.key} index ${label}`);
    active.rows.push({ label, values });
  }
  for (const key of Object.keys(TABLES))
    if (!sections[key] || sections[key].rows.length !== sections[key].count)
      throw Error(`Missing/incomplete jungle section ${key}`);
  return sections;
}

export function prepareJungleMap({ image, entries, variant }, previousMemory) {
  if (
    image?.length !== 87664 ||
    !Number.isInteger(variant) ||
    variant < 0 ||
    variant > 2
  )
    throw Error("Invalid jungle map contract");
  const sections = parseJungleMap(entries?.[variant + 1]);
  const bytes = new Uint8Array(65536);
  bytes.set(image.subarray(0x120e0));
  const memory = previousMemory ?? new FlightMemory(bytes);
  memory.i(0x54f8, variant);
  for (const [key, section] of Object.entries(sections)) {
    const table = TABLES[key];
    section.rows.forEach(({ label, values }, position) => {
      // L/A/B sscanf formats suppress the printed index. In variant0 the
      // final two B rows both say30; they still populate distinct records.
      const index = table.indexed ? label : position;
      const at = table.base + index * table.stride;
      values.forEach((value, i) => memory.i(at + table.offsets[i], value));
      if (key === "M") memory.i(at + 32, memory.i(at + 28));
    });
  }
  memory.i(0x3a42, sections.B.count);
  memory.i(0x882c, sections.F.count);
  return { memory, sections };
}

// Original1090:04d2 scans only the first six columns and three rows for the
// first platform. No actor initialization, RNG or device timing occurs here.
export function jungleStartingPlatform(memory) {
  for (let column = 0; column < 6; column++)
    for (let row = 0; row < 3; row++)
      if (memory.i(0x95ea + column * 8 + row * 2) !== 0) return { column, row };
  throw Error("Jungle map has no supported starting platform");
}
