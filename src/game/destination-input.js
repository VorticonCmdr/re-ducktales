// Overlay2:1e8e..1cdd. Fire takes precedence over direction. Only the exact
// horizontal reader codes3/7 change selection; diagonal codes do not.
export function destinationInput(choice, byte, atomicAvailable) {
  if (
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice > (atomicAvailable ? 2 : 1) ||
    !Number.isInteger(byte) ||
    byte < 0 ||
    byte > 255 ||
    typeof atomicAvailable !== "boolean"
  )
    throw Error("Invalid destination input");
  const confirmed = (byte & 0xc0) !== 0;
  let changed = false;
  if (!confirmed) {
    const count = atomicAvailable ? 3 : 2;
    if ((byte & 63) === 3) {
      choice = (choice + 1) % count;
      changed = true;
    } else if ((byte & 63) === 7) {
      choice = (choice + count - 1) % count;
      changed = true;
    }
  }
  return {
    choice,
    changed,
    confirmed,
    returnCode: confirmed ? (choice === 0 ? 0x24 : 1) : null,
  };
}
