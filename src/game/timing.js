// Supported original reference platform. These clocks are simulation inputs,
// independent of the browser's requestAnimationFrame and host drawing speed.
export const DRIVER_HZ = 1193182 / (1365 * 12);
export const RETRACE_HZ = 70.086;
export const ORIGINAL_GRAPHICS_TIMING = Object.freeze({
  cyclesPerMillisecond: 3000,
  retraceHz: RETRACE_HZ,
});
