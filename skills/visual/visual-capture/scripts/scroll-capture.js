// Smooth full-page scroll hero script for `playwright-cli run-code --filename`.
// TEMPLATE: run-code evaluates a single function expression in a sandbox with
// no `process`/env, so scroll-capture.sh substitutes the __TOKENS__ below with
// concrete values before running. Do not execute this file directly.
async page => {
  const url = __URL__;
  const out = __OUT__;
  const W = __VP_W__, H = __VP_H__;
  const settleMs = __SETTLE_MS__, pxPerSec = __PX_PER_SEC__, endMs = __END_MS__;

  await page.setViewportSize({ width: W, height: H });
  // Video size == viewport size => the page fills the frame, no gray margins.
  await page.screencast.start({ path: out, size: { width: W, height: H } });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(settleMs);

  // Scroll at a constant speed (px/second), so the pace feels the same on any
  // page length. Linear velocity (no ease) avoids a fast mid-scroll spike;
  // duration is derived from the measured distance and clamped to sane bounds.
  await page.evaluate(async (pxPerSec) => {
    const dist = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (dist === 0) return;
    const ms = Math.min(30000, Math.max(3000, (dist / pxPerSec) * 1000));
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        window.scrollTo(0, dist * t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, pxPerSec);

  await page.waitForTimeout(endMs);
  await page.screencast.stop();
}
