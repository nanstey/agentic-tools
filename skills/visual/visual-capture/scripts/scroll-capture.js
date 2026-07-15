// Smooth full-page scroll hero script for `playwright-cli run-code --filename`.
// TEMPLATE: run-code evaluates a single function expression in a sandbox with
// no `process`/env, so scroll-capture.sh substitutes the __TOKENS__ below with
// concrete values before running. Do not execute this file directly.
async page => {
  const url = __URL__;
  const out = __OUT__;
  const W = __VP_W__, H = __VP_H__;
  const settleMs = __SETTLE_MS__, scrollMs = __SCROLL_MS__, endMs = __END_MS__;

  await page.setViewportSize({ width: W, height: H });
  // Video size == viewport size => the page fills the frame, no gray margins.
  await page.screencast.start({ path: out, size: { width: W, height: H } });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(settleMs);

  // Time-based scroll with easing (runs in the browser), so motion is smooth
  // and paced to scrollMs rather than jumping the whole page in a fast loop.
  await page.evaluate(async (ms) => {
    const dist = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (dist === 0) return;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        window.scrollTo(0, dist * eased);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, scrollMs);

  await page.waitForTimeout(endMs);
  await page.screencast.stop();
}
