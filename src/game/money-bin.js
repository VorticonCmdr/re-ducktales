// Hand translation of DUCKTALE.EXE overlay 9, body offsets 0000–0b13.
// Units are the driver's 72.84-Hz ticks, not browser display frames.
// Rendering and audio are emitted effects; neither advances this state machine.
const sprite = (asset, frame, x, y) => ({ asset, frame, x, y });
const board = (frame) => sprite(4, frame, 186, 94);
const scrooge = (frame, x, y) => sprite(1, frame, x, y);
const shot = (ticks, sprites, sound = null, source = "") => ({
  ticks,
  sprites,
  sound,
  source,
});

function diveSequence(won) {
  const sequence = [
    shot(7, [scrooge(4, 176, 73), board(2)], 37, "0299"),
    shot(7, [scrooge(5, 162, 33), board(3)], null, "02fc"),
    shot(7, [scrooge(5, 154, 8), board(0)], null, "035f"),
    ...[
      [6, 131, 1],
      [6, 112, 1],
      [7, 106, 19],
      [7, 105, 39],
      [7, 105, 65],
    ].map(([f, x, y]) => shot(7, [scrooge(f, x, y), board(0)], null, "03c2")),
    shot(7, [scrooge(8, 99, 92), board(0)], null, "0484"),
    shot(7, [scrooge(9, 113, 89), board(0)], null, "04e2"),
    shot(7, [sprite(2, 0, 109, 119), board(0)], null, "0540"),
    ...[
      [109, 110],
      [104, 114],
      [101, 119],
      [96, 120],
      [92, 124],
      [94, 133],
    ].map(([x, y], i) =>
      shot(7, [sprite(3, 0, x, y), board(0)], i === 0 ? 7 : null, "05ab"),
    ),
    ...[
      [39, 104],
      [40, 114],
      [44, 118],
      [48, 98],
      [64, 91],
      [68, 94],
    ].map(([x, y], f) =>
      shot(7, [sprite(5, f, x, y), board(0)], f === 0 ? 2 : null, "075c"),
    ),
    shot(7, [sprite(6, 0, 75, 96), board(0)], null, "084d"),
  ];
  if (won) {
    for (let i = 0; i < 14; i++)
      sequence.push(
        shot(7, [sprite(7, i % 2, 75, 98), board(0)], null, "08cd"),
      );
  } else {
    // This loop has no explicit wait: each presentation waits for video retrace.
    // One retrace = one presentation step, handled separately by the runtime.
    for (let i = 0; i < 14; i++)
      sequence.push({
        ...shot(
          0,
          [
            sprite(i < 7 ? 9 : 10, i, 86, i < 7 ? 73 : 74),
            sprite(8, 0, 81, 139),
            board(0),
          ],
          i === 0 ? 64 : null,
          "09da",
        ),
        retraces: 1,
      });
    sequence.push(shot(7, [sprite(6, 0, 75, 96), board(0)], null, "0a59"));
  }
  return sequence;
}

export class MoneyBin {
  constructor({ coinAvailable = true } = {}) {
    this.tick = 0;
    this.phase = "intro";
    this.nextPose = 2;
    this.coinAvailable = coinAvailable;
    this.won = false;
    this.complete = false;
    this.events = [];
    this.inputQueue = [];
    this.sequence = Array.from({ length: 6 }, (_, i) =>
      shot(
        28,
        [scrooge(i % 2, 178 + (i % 2), 53), board(0)],
        i === 0 ? 38 : null,
        "0121",
      ),
    );
    this.cursor = 0;
    this.remaining = this.sequence[0].ticks;
    this.current = this.sequence[0];
    this.emitSound();
  }
  emitSound() {
    if (this.current.sound !== null)
      this.events.push({
        type: "sound",
        id: this.current.sound,
        tick: this.tick,
      });
  }
  enqueueFire() {
    this.inputQueue.push({ type: "fire" });
  }
  pollIdle() {
    if (this.inputQueue.length) {
      this.inputQueue.shift();
      this.won = this.nextPose === 3 && this.coinAvailable;
      if (this.won) this.coinAvailable = false;
      this.phase = "dive";
      this.sequence = diveSequence(this.won);
      this.cursor = 0;
      this.current = this.sequence[0];
      this.remaining = this.current.ticks;
      this.emitSound();
      return;
    }
    if (this.nextPose > 3) this.nextPose = 2;
    const pose = this.nextPose;
    this.current = shot(
      14,
      [
        scrooge(pose, pose === 2 ? 178 : 180, pose === 2 ? 53 : 60),
        board(pose === 2 ? 0 : 1),
      ],
      pose === 2 ? 87 : null,
      "01b6",
    );
    this.remaining = 14;
    this.nextPose = pose + 1;
    this.emitSound();
  }
  advanceBoundary() {
    if (this.phase === "idle") {
      this.pollIdle();
      return;
    }
    this.cursor++;
    if (this.cursor >= this.sequence.length) {
      if (this.phase === "intro") {
        this.phase = "idle";
        this.pollIdle();
      } else {
        this.complete = true;
        this.phase = "complete";
        this.events.push({ type: "return", won: this.won, tick: this.tick });
        if (this.won)
          this.events.push({ type: "sound", id: 32, tick: this.tick });
      }
      return;
    }
    this.current = this.sequence[this.cursor];
    this.remaining = this.current.ticks;
    this.retracesRemaining = this.current.retraces ?? 0;
    this.emitSound();
  }
  advanceTick() {
    if (this.complete) return;
    this.tick++;
    if (!this.current.retraces && --this.remaining <= 0) this.advanceBoundary();
  }
  advanceRetrace() {
    if (this.complete || !this.current.retraces) return;
    if (--this.retracesRemaining <= 0) this.advanceBoundary();
  }
  drainEvents() {
    return this.events.splice(0);
  }
  snapshot() {
    return {
      tick: this.tick,
      phase: this.phase,
      nextPose: this.nextPose,
      remaining: this.remaining,
      cursor: this.cursor,
      won: this.won,
      coinAvailable: this.coinAvailable,
      complete: this.complete,
      sprites: this.current.sprites.map((s) => ({ ...s })),
    };
  }
}
