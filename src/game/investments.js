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

// Overlay10:05c0..0659. The caller owns input latching and the current quote.
// Return the original message ID; only successful trades set3bb4.
export function tradeInvestment(
  m,
  company,
  action,
  price = investmentPrice(m, company),
) {
  if (!Number.isInteger(company) || company < 0 || company >= 15)
    throw Error(`Invalid investment company ${company}`);
  if (!["buy", "sell"].includes(action))
    throw Error(`Invalid investment action ${action}`);
  const at = INVESTMENTS.companies + company * 46;
  const cash = m.view.getUint32(0x8cc0, true);
  price = s16(price);
  if (action === "buy") {
    if (price === 0) return 5;
    if (m.i(at + 34) >= 99) return 6;
    // SUB/SBB then signed comparison of the high word,including32-bit wrap.
    const balance = (cash - price) >>> 0;
    if (balance & 0x80000000) return 1;
    m.view.setUint32(0x8cc0, balance, true);
    m.i(at + 34, m.i(at + 34) + 1);
  } else {
    if (m.i(at + 34) <= 0) return 4;
    m.view.setUint32(0x8cc0, (cash + price) >>> 0, true);
    m.i(at + 34, m.i(at + 34) - 1);
  }
  m.b(0x3bb4, 1);
  return action === "buy" ? 3 : 2;
}

// Overlay10:10d1..145a. Original shared RNG and signed byte calendar.
// There are two complete company passes per elapsed day,not one per company.
export function advanceInvestmentDays(m) {
  let draws = 0,
    days = 0;
  const random = () => {
    const seed = nextRandom(u16(m.i(0x2229)));
    m.i(0x2229, seed);
    draws++;
    return seed;
  };
  const difficulty = m.signedByte(0x8990);
  const factor = (chart, day) => m.b(u16(0x8fa5 + chart * 31 + day));
  const total = (a, b) =>
    (m.view.getUint32(a, true) + m.view.getUint32(b, true)) | 0;
  while (m.signedByte(0x7162) < m.signedByte(0x4e0e)) {
    if (++days > 128) throw Error("Investment calendar failed to converge");
    m.b(0x7162, m.b(0x7162) + 1);
    const day = m.signedByte(0x7162);
    for (let i = 0; i < 15; i++) {
      const at = 0x92b2 + i * 46;
      if ((m.b(at + 36) & 127) === 3) {
        let jitter = s16((random() & 3) * ((difficulty >> 1) + 1));
        if ((random() & 255) > 127) jitter = s16(-jitter);
        if (s16(m.signedByte(at + 42) + jitter) <= day) {
          m.b(at + 36, 1);
          m.i(
            at + 32,
            m.i(at + 32) + Math.trunc(s16(m.i(at + 32) * m.i(at + 44)) / 100),
          );
          m.i(at + 40, day);
        }
      }
      if ((m.b(at + 36) & 127) === 4 && m.signedByte(at + 42) <= day) {
        m.b(at + 36, 2);
        m.i(
          at + 32,
          m.i(at + 32) + Math.trunc(s16(m.i(at + 32) * m.i(at + 44)) / 100),
        );
        m.i(at + 44, -m.i(at + 44));
        m.i(at + 40, day);
        if (m.i(at + 32) < 0) m.i(at + 32, 0);
      }
    }
    for (let i = 0; i < 15; i++) {
      const at = 0x92b2 + i * 46;
      if (m.b(at + 36) !== 0 || day >= 30) continue;
      const chart = m.i(at + 38);
      const slope = (d) => (factor(chart, d + 1) < factor(chart, d) ? -1 : 1);
      const initial = slope(day);
      let direction = initial,
        lookahead = 0;
      while (lookahead < 15 && lookahead + day < 31 && direction === initial) {
        direction = slope(day + lookahead);
        lookahead++;
      }
      if (direction === initial) continue;
      let chance =
        direction === 1
          ? s16((3 - difficulty) * 5 + (day >> 2))
          : s16(difficulty * 5 + (day >> 2) + 5);
      if (m.i(at + 34) === 0) chance >>= 2;
      if ((random() & 255) >= u16(chance)) continue;
      // CMP signed high words followed by unsigned low words is signed32.
      const ahead = total(0x5ae2, 0x8cc0) >= total(0x54f2, 0x4e0a);
      const roll = random();
      const amount =
        direction === 1
          ? ahead
            ? (roll & 7) + 105
            : (roll & 15) + 110
          : ahead
            ? (roll & 15) + 10
            : (roll & 7) + 5;
      m.i(
        at + 44,
        direction === 1
          ? amount - factor(chart, day)
          : -(factor(chart, day) + amount),
      );
      m.b(at + 36, direction === 1 ? 3 : 4);
      m.i(at + 40, day);
      m.i(
        at + 42,
        Math.min(30, s16((3 - difficulty) * 3 + (lookahead >> 1) + day)),
      );
    }
  }
  return { days, draws, seed: u16(m.i(0x2229)) };
}
