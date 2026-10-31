// Rendering observer only;no captured pixels or states return to simulation.
export async function installReportFrameRecording(page) {
  await page.evaluate(() => {
    window.reportFrames = [];
    const seen = new Set();
    document.getElementById("game").addEventListener("gamepresent", (e) => {
      const s = e.detail,
        p = s.reportPresentation;
      if (!p) return;
      const who = s.rivalReport ?? s.claim ?? s.visitNotice;
      const key = `${s.scene}:${who.target}:${who.reason ?? "rival"}:${p.phase}:${p.transition?.band ?? "none"}`;
      if (seen.has(key)) return;
      seen.add(key);
      window.reportFrames.push({
        key,
        at: performance.now(),
        state: s,
        png: document.getElementById("game").toDataURL(),
      });
    });
  });
}
