import { nextRandom, s16, u16 } from "./integer.js";

export const INVESTMENTS = Object.freeze({
  companies: 0x92b2,
  stride: 46,
  charts: 0x8fa6,
  processedDay: 0x7162,
});

function lines(entry) {
  if (entry?.type !== 4 || entry.data.some((c) => c > 127))
    throw Error("Invalid investment text resource");
  return new TextDecoder("ascii")
    .decode(entry.data)
    .replace(/\x1a.*$/s, "")
    .split(/\r?\n/);
}

export function investmentResources(companies, charts) {
  if (companies?.length !== 15 || charts?.length !== 5)
    throw Error("Investments require 15 companies and five charts");
  return {
    companies: companies.map((entry, index) => {
      const text = lines(entry);
      if (!text[0] || text[0].length > 31 || !/^\d+\s+\d+$/.test(text[1]))
        throw Error(`Invalid investment company ${index}`);
      return { name: text[0], lines: text };
    }),
    charts: charts.map((entry, index) => {
      const text = lines(entry);
      if (text.length < 31 || !text.slice(0, 31).every((n) => /^\d+$/.test(n)))
        throw Error(`Invalid investment chart ${index}`);
      return text.slice(0, 30).map((n) => Number(n) & 255);
    }),
  };
}

// Resident physical1a31..1c46 / Ghidra115a:0491. Resource numeric prices
// and chart IDs are parsed by the original, then overwritten by two RNG draws.
// Preserve untouched padding, event fields and the 31st byte of each chart.
// m is the shared original DS layout; file access and allocator effects are outside
// this routine's semantic boundary. The resources must be validated first.
export function initializeInvestments(m, resources) {
  m.b(INVESTMENTS.processedDay, 0);
  let seed = u16(m.i(0x2229));
  for (let company = 0; company < 15; company++) {
    const at = INVESTMENTS.companies + company * INVESTMENTS.stride;
    const name = resources.companies[company].name;
    for (let i = 0; i < name.length; i++) m.b(at + i, name.charCodeAt(i));
    m.b(at + name.length, 0);
    seed = nextRandom(seed);
    m.i(at + 32, seed % 120);
    seed = nextRandom(seed);
    m.i(at + 38, seed % 5);
    m.b(at + 36, 0);
    m.i(at + 34, 0);
  }
  m.i(0x2229, seed);
  for (let chart = 0; chart < 5; chart++)
    for (let day = 0; day < 30; day++)
      m.b(INVESTMENTS.charts + chart * 31 + day, resources.charts[chart][day]);
  return { seed, draws: 30 };
}

// Physical overlay10:0aac..0b06. CWD after IMUL deliberately discards the
// product's high word before signed division. Do not widen this multiplication.
export function investmentPrice(m, company) {
  if (!Number.isInteger(company) || company < 0 || company >= 15)
    throw Error(`Invalid investment company ${company}`);
  const at = INVESTMENTS.companies + company * INVESTMENTS.stride;
  const factor = m.b(u16(0x8fa5 + m.i(at + 38) * 31 + m.signedByte(0x4e0e)));
  const price = Math.trunc(s16(m.i(at + 32) * factor) / 100);
  return price <= 0 && factor > 0 ? 1 : price;
}
