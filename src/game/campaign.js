import { nextRandom, u16 } from "./integer.js";

export const OFFICE = 35;
export function parseLocations(entries) {
  if (entries.length !== 35) throw Error("Expected 35 LOC.ARC records");
  return entries.map((entry, asset) => {
    const lines = new TextDecoder("ascii")
      .decode(entry.data)
      .replace(/\x1a.*$/s, "")
      .split(/\r?\n/);
    if (!/^\d+ \d+ \d+ \d+$/.test(lines[0]) || !lines[1])
      throw Error(`Invalid location ${asset}`);
    const [x, y, flags, treasure] = lines[0].split(" ").map(Number);
    return {
      asset,
      x,
      y,
      flags,
      treasure,
      name: lines[1],
      description: lines.slice(2).filter(Boolean),
    };
  });
}
// Main 115a:00d7–02e7: two RNG draws establish the resource permutation.
export function orderLocations(locations, seed) {
  seed = nextRandom(seed);
  let candidate = seed % 30;
  seed = nextRandom(seed);
  const stride = seed % 5;
  const order = [0],
    used = new Set(order);
  while (order.length < 35) {
    while (used.has(candidate))
      candidate = candidate + 1 >= 35 ? 1 : candidate + 1;
    order.push(candidate);
    used.add(candidate);
    candidate = (candidate + stride) % 35;
  }
  return { locations: order.map((asset) => locations[asset]), seed };
}
export function travelDays(locations, from, to) {
  if (from === to) return 0;
  const a = from === OFFICE ? { x: 56, y: 64 } : locations[from];
  const b = to === OFFICE ? { x: 56, y: 64 } : locations[to];
  if (!a || !b) throw Error(`Invalid campaign route ${from} -> ${to}`);
  const dx = Math.abs(a.x - b.x),
    dy = Math.abs(a.y - b.y);
  const distance =
    Math.min(dx * dx, (272 - dx) ** 2) + Math.min(dy * dy, (140 - dy) ** 2);
  return Math.min(3, Math.trunc(distance / 6606) + 1);
}
export class Campaign {
  constructor(locations, seed) {
    const ordered = orderLocations(locations, u16(seed));
    this.locations = ordered.locations;
    this.seed = ordered.seed;
    this.day = 1;
    this.location = OFFICE;
    this.banked = 0;
    this.openMap();
  }
  openMap() {
    const here =
      this.location === OFFICE
        ? { x: 46, y: 139 }
        : this.locations[this.location];
    this.cursor = { x: here.x, y: here.y };
    this.selected = this.nearest();
    this.info = false;
    this.choice = 0;
    this.direction = null;
    this.pollTicks = 0;
  }
  nearest() {
    const { x, y } = this.cursor;
    if (x >= 22 && x <= 70 && y >= 115 && y <= 163) return OFFICE;
    let selected = 0,
      best = Infinity;
    this.locations.forEach((l, i) => {
      const d = (l.x - x) ** 2 + (l.y - y) ** 2;
      if (d < best) {
        best = d;
        selected = i;
      }
    });
    return selected;
  }
  point(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y))
      throw Error("Invalid map pointer");
    this.cursor = {
      x: Math.max(32, Math.min(285, Math.trunc(x))),
      y: Math.max(28, Math.min(151, Math.trunc(y))),
    };
    this.selected = this.nearest();
  }
  advanceTick() {
    if (this.info || ++this.pollTicks < 2) return;
    this.pollTicks = 0;
    const vectors = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
    const v = vectors[this.direction];
    if (!v) return;
    // Overlay 2:1f34,1f81,1fd0–2049: the first-poll latch resets
    // its acceleration counter, leaving one pixel per cardinal poll.
    this.point(this.cursor.x + v[0], this.cursor.y + v[1]);
  }

  snapshot() {
    return {
      day: this.day,
      location: this.location,
      banked: this.banked,
      cursor: { ...this.cursor },
      selected: this.selected,
      asset:
        this.selected === OFFICE ? null : this.locations[this.selected].asset,
      info: this.info,
      choice: this.choice,
      travelDays: travelDays(this.locations, this.location, this.selected),
    };
  }
}
