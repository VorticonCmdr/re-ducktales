// Overlay6 terminal paths. Methods use the Cave's explicit pages, clocks and
// device boundary; no DOM, host timer, outcome fitting or skipped animation.
export const caveEndings = {
  *treasure() {
    const m = this.memory;
    this.phase = "treasure";
    m.b(0x546a, 1);
    this.load(44);
    this.load(45, 96, 94);
    for (let i = 0; i < 5; i++) {
      const c = this.party(this.scene());
      this.draw(c, 45);
      this.draw(c, 22);
      yield* this.present(c);
    }
    m.b(0x546a, 2);
    this.sound(0x49);
    for (let i = 0; i < 10; i++) {
      const c = this.party(this.scene(), { asset: 44 });
      this.draw(c, 45);
      this.draw(c, 22);
      yield* this.present(c);
    }
    yield* this.waitAudio();
  },
  *capture() {
    const m = this.memory;
    this.phase = "captured";
    this.load(46, 102, 200 - this.entries[46].height);
    // The first helper call is overwritten before a presentation, but still
    // advances the original torch RNG. Do not collapse it into the next pose.
    this.party(this.back());
    this.load(29);
    let c = this.party(this.back());
    this.memory.i(0x8f06, 76);
    this.memory.i(0x8f08, 43);
    this.draw(c, 46);
    this.sound(0x53);
    yield* this.present(c);
    this.load(30);
    c = this.party(this.back());
    m.i(0x8f1a, 70);
    m.i(0x8f1c, 43);
    this.draw(c, 46);
    yield* this.present(c);
    // Copy the captor into the persistent room buffer before alternating poses.
    this.restoreBackground();
    c = this.back();
    this.draw(c, 46);
    this.buffers[this.drawIndex] = c;
    this.background = [...c];
    for (let i = 0; i < 16; i++) {
      this.restoreBackground({ x: 64, y: 5, width: 176, height: 195 });
      c = this.back();
      this.draw(c, 29 + (i & 1));
      this.draw(c, 46);
      yield* this.present(c);
    }
    yield* this.waitAudio();
  },
  *pit() {
    const m = this.memory;
    this.phase = "pit";
    this.load(28);
    for (let i = 0; i < 2; i++)
      yield* this.present(this.party(this.back(), { asset: 28, pose: 6 }));
    for (const [id, x, y] of [
      [29, 76, 43],
      [30, 70, 43],
      [31, 88, 43],
      [32, 90, 43],
      [33, 88, 64],
      [34, 70, 73],
    ]) {
      this.load(id, x, y);
      yield* this.present(this.party(this.back(), { asset: 28, pose: 6 }));
    }
    this.load(35, 61, 54);
    this.load(36, 70, 42);
    this.events.push({ type: "stopAudio" });
    for (let i = 0; i < 2; i++) yield* this.present(this.party(this.back()));
    this.sound(0x48);
    for (let pass = 0; pass < 4; pass++) {
      const region =
        pass === 0 ? undefined : { x: 64, y: 40, width: 176, height: 160 };
      for (let i = 0; i < 3; i++) {
        this.restoreBackground(region);
        const c = this.back();
        this.draw(c, 29 + i);
        yield* this.present(c);
      }
      this.restoreBackground(region);
      const c = this.back();
      this.draw(c, 30);
      yield* this.present(c);
    }
    for (let i = 0; i < 3; i++) {
      this.restoreBackground({ x: 64, y: 40, width: 176, height: 160 });
      const c = this.back();
      this.draw(c, 29 + i);
      yield* this.present(c);
    }
    this.sound(0x47);
    for (let i = 3; i < 8; i++) {
      this.restoreBackground({ x: 64, y: 10, width: 176, height: 190 });
      const c = this.back();
      this.draw(c, 29 + i);
      yield* this.present(c);
      yield* this.delay(1);
    }
    this.restoreBackground();
    yield* this.present(this.back());
    yield* this.waitAudio();
  },
  *expired() {
    this.phase = "torch-expired";
    const m = this.memory;
    for (let i = 0; i < 4; i++) {
      this.restoreBackground();
      yield* this.present(this.party(this.back()));
    }
    for (let i = 0; i < 6; i++) {
      this.restoreBackground();
      const c = this.back();
      this.draw(c, 17);
      this.draw(c, 16, (i & 1) === 0 || i > 3 ? 4 : 3);
      for (const id of [26, 22, 23]) this.draw(c, id);
      yield* this.present(c);
    }
    this.load(27, 98, 57);
    let c = this.back();
    this.draw(c, 27, 4);
    yield* this.present(c);
    yield* this.delay(73);
    c = this.back();
    this.draw(c, 27, 1);
    yield* this.present(c);
    yield* this.delay(7);
    for (let i = 0; i < 6; i++) {
      if (i === 4) {
        this.sound(0x4b);
        continue;
      }
      c = [{ op: "fill", color: 0, x: 0, y: 0, width: 320, height: 200 }];
      this.draw(c, 27, i);
      yield* this.present(c);
      yield* this.delay(i === 1 ? 7 : (i & 1) === 0 ? 35 : 73);
      if (i >= 2) {
        c = this.back();
        this.draw(c, 27, 1);
        yield* this.present(c);
        yield* this.delay(3);
      }
    }
    c = this.back();
    this.draw(c, 27, 0);
    yield* this.present(c);
    yield* this.delay(219);
  },
  *finish(reason) {
    if (reason === "treasure") yield* caveEndings.treasure.call(this);
    else if (reason === "pit") yield* caveEndings.pit.call(this);
    else if (reason === "captured") yield* caveEndings.capture.call(this);
    else if (reason === "torch-expired") yield* caveEndings.expired.call(this);
    else throw Error(`Unsupported cave outcome ${reason}`);
    this.events.push({ type: "stopAudio" });
    if (!this.memory.b(0x5d2b)) this.memory.b(0x54aa, 0);
    return {
      status: reason,
      code: reason === "treasure" ? 1 : 0,
      money: this.memory.view.getUint32(0x8cc0, true),
      seed: this.memory.view.getUint16(0x2229, true),
    };
  },
};
