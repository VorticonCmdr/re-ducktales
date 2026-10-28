// EGA driver1:0101/0155. Forty bytes per row, forty rows per group,
// stride five rows, five display retraces after each of five groups.
export function endingTransitionPixels(transition, incoming, target) {
  const size = 320 * 200 * 4;
  if (
    !(incoming instanceof Uint8ClampedArray) ||
    incoming.length !== size ||
    !(target instanceof Uint8ClampedArray) ||
    target.length !== size
  )
    throw Error("Invalid ending presentation pixels");
  if (transition.kind === "flip") return Uint8ClampedArray.from(incoming);
  if (
    !["wipe", "reveal"].includes(transition.kind) ||
    !Number.isInteger(transition.band) ||
    transition.band < 0 ||
    transition.band > 4
  )
    throw Error("Unsupported ending transition");
  const out =
    transition.kind === "wipe"
      ? Uint8ClampedArray.from(incoming)
      : new Uint8ClampedArray(size);
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < 320; x++) {
      const at = (y * 320 + x) * 4;
      if (transition.kind === "reveal" && y % 5 <= transition.band)
        out.set(target.subarray(at, at + 4), at);
      else if (transition.kind === "wipe" && y % 5 <= transition.band)
        out.set([0, 0, 0, 255], at);
      else if (transition.kind === "reveal") out[at + 3] = 255;
      out[at + 3] = 255;
    }
  return out;
}
