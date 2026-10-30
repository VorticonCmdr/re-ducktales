// External browser controller: inject one actual make/break inside the source
// footer window. It never changes game state or supplies a decoded reader byte.
// A frozen browser clock removes host/test-runner latency from that window.
export async function pressDestinationKey({ page, state, until }, key) {
  await until(
    (s) =>
      s.scene === "map" &&
      s.campaign.destination?.ready &&
      s.campaign.destination.loop.completedCalls % 5 <= 2,
  );
  const before = (await state()).campaign.destination.inputs;
  await page.keyboard.press(key);
  await until(
    (s) =>
      s.scene !== "map" ||
      !s.campaign.info ||
      s.campaign.destination.inputs > before,
  );
}
