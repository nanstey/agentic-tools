export default function (pi) {
  pi.on("session_start", (_event, ctx) => {
    // pi-diff enables expansion in its own session_start handler. Run after
    // all session_start handlers so this remains the final default.
    setTimeout(() => ctx.ui.setToolsExpanded(false), 0);
  });
}
