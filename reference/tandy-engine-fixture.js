import { prepareTandySequenceCase } from "./tandy-sequence-fixture.js";

export function prepareTandyEngineCase(driver, c) {
  const bytes = prepareTandySequenceCase(
    driver,
    c.kind === "irq" ? { ...c, kind: "tick" } : c,
  );
  if (c.kind === "irq") {
    const view = new DataView(bytes.buffer);
    view.setUint32(0x5000, c.clock, true);
    // Hardware interrupt frame and a private original-handler stand-in. The
    // stand-in only IRETs; its missing BIOS/PIC effects are explicit in scope.
    view.setUint16(0xfef0, 0x4003, true);
    view.setUint16(0xfef2, 0x459c, true);
    view.setUint16(0xfef4, 0x0202, true);
    bytes[0x4300] = 0xcf;
  }
  return bytes;
}
