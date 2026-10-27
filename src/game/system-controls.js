// Resident11c4:02a7/047f and input1124:0002. Layout uses the original
// opaque white-on-blue font cells,not browser dialog styling.
export function systemOverlayLayout(kind) {
  if (kind === "pause")
    return {
      box: { x: 104, y: 80, width: 104, height: 24 },
      fill: { x: 104, y: 80, width: 104, height: 24 },
      rows: [0x483, 0x491, 0x49f].map((at, i) => ({
        at,
        x: 104,
        y: 80 + i * 8,
      })),
    };
  if (kind === "quit")
    return {
      box: { x: 39, y: 87, width: 234, height: 18 },
      fill: { x: 40, y: 88, width: 232, height: 16 },
      rows: [0x43e, 0x45c].map((at, i) => ({ at, x: 40, y: 88 + i * 8 })),
    };
  throw Error(`Unsupported system dialog ${kind}`);
}

export class SystemControls {
  constructor(kind) {
    systemOverlayLayout(kind);
    this.kind = kind;
    this.phase = kind === "pause" ? "lock" : "waiting";
    this.remaining = kind === "pause" ? 35 : 0;
    this.result = null;
  }
  input(event) {
    if (this.phase !== "waiting") return;
    if (this.kind === "pause" && event.type === "pause") {
      this.phase = "resuming";
      this.remaining = 7;
    } else if (this.kind === "quit" && event.type === "quit-yes")
      this.result = "quit";
    else if (this.kind === "quit" && event.type === "quit-no")
      this.result = "resume";
  }
  advanceTick() {
    if (this.phase === "waiting" || this.result) return;
    if (--this.remaining > 0) return;
    if (this.phase === "lock") this.phase = "waiting";
    else if (this.phase === "resuming") this.result = "resume";
    else throw Error(`Unsupported system dialog phase ${this.phase}`);
  }
  snapshot() {
    return {
      kind: this.kind,
      phase: this.phase,
      remaining: this.remaining,
      result: this.result,
    };
  }
}
