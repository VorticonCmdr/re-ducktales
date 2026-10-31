// Rendering observer only;no captured pixels or states return to simulation.
export async function installReportFrameRecording(page) {
  await page.evaluate(() => {
    window.reportFrames = [];
    window.reportIncomingPages = [];
    const visible = document.getElementById("game").getContext("2d"),
      read = visible.getImageData.bind(visible),
      sources = new Set();
    let lastIncoming = null;
    visible.getImageData = (...args) => {
      const result = read(...args);
      if (
        args[0] === 0 &&
        args[1] === 0 &&
        args[2] === 320 &&
        args[3] === 200
      ) {
        // Observe the actual renderer read at its consumption boundary. Return
        // the same ImageData unchanged;pixels never enter game simulation.
        const c = document.createElement("canvas");
        c.width = 320;
        c.height = 200;
        c.getContext("2d", { alpha: false }).putImageData(result, 0, 0);
        lastIncoming = { at: performance.now(), png: c.toDataURL() };
      }
      return result;
    };
    const seen = new Set();
    document.getElementById("game").addEventListener("gamepresent", (e) => {
      const s = e.detail,
        p = s.reportPresentation;
      if (!p) return;
      const who = s.rivalReport ?? s.claim ?? s.visitNotice;
      const identity = `${s.scene}:${who.target}:${who.reason ?? "rival"}`;
      if (!sources.has(identity)) {
        if (!lastIncoming) throw Error("Missing report incoming-page read");
        window.reportIncomingPages.push({ key: identity, ...lastIncoming });
        sources.add(identity);
      }
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
