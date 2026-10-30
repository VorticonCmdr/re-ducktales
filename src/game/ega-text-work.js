// Original IT.DRV resource1:081f..0908 transparent text work.
// Exact conditional native instruction paths; no DOM,clock or RNG.
const IPS = [
  2079, 2080, 2082, 2085, 2086, 2087, 2092, 2095, 2100, 2103, 2105, 2107, 2111,
  2113, 2116, 2118, 2120, 2122, 2124, 2126, 2128, 2130, 2133, 2134, 2137, 2140,
  2143, 2146, 2149, 2152, 2153, 2156, 2159, 2162, 2165, 2166, 2169, 2172, 2173,
  2176, 2179, 2180, 2183, 2185, 2186, 2189, 2192, 2193, 2195, 2197, 2200, 2202,
  2205, 2207, 2210, 2212, 2214, 2216, 2219, 2221, 2224, 2226, 2228, 2230, 2231,
  2234, 2236, 2239, 2242, 2244, 2246, 2248, 2249, 2250, 2253, 2256, 2258, 2260,
  2262, 2263, 2265, 2267, 2269, 2271, 2272, 2275, 2277, 2278, 2282, 2285, 2287,
  2289, 2290, 2293, 2295, 2298, 2300, 2303, 2305, 2306, 2307, 2309, 2310,
];
const PORTS = new Set([0x875, 0x87c, 0x883, 0x889, 0x8c9, 0x8df, 0x8e5]);
export function egaTransparentTextWork(
  {
    text,
    x,
    surfaceOffset = 0,
    backPage = false,
    fontWidth = 8,
    fontHeight = 8,
  },
  { instruction = null } = {},
) {
  if (
    typeof text !== "string" ||
    [...text].some((c) => c.charCodeAt(0) > 255) ||
    text.length > 65535 ||
    !Number.isInteger(x) ||
    x < -32768 ||
    x > 65535 ||
    !Number.isInteger(surfaceOffset) ||
    surfaceOffset < 0 ||
    surfaceOffset > 65535 ||
    typeof backPage !== "boolean" ||
    ![fontWidth, fontHeight].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 255,
    ) ||
    (instruction !== null && typeof instruction !== "function")
  )
    throw Error("Unsupported EGA transparent text input");
  let instructions = 0,
    portWrites = 0,
    glyphs = 0,
    alignedGlyphs = 0;
  function block(lo, hi = lo) {
    const a = IPS.indexOf(lo),
      b = IPS.indexOf(hi);
    if (a < 0 || b < a) throw Error("Invalid original text source block");
    for (let i = a; i <= b; i++) {
      const ip = IPS[i];
      instructions++;
      if (PORTS.has(ip)) portWrites++;
      instruction?.(ip);
    }
  }
  block(0x81f, 0x837);
  if (backPage) block(0x839, 0x83f);
  block(0x841, 0x88a);
  x &= 65535;
  let di = (x + surfaceOffset) & 65535;
  for (let i = 0; ; i++) {
    block(0x88d, 0x893);
    if (i === text.length || text.charCodeAt(i) === 0) break;
    block(0x895, 0x8c2);
    if ((di & 7) === 0) {
      alignedGlyphs++;
      block(0x8c4);
      for (let row = 0; row < (fontHeight || 256); row++) block(0x8c6, 0x8d2);
      block(0x8d4);
    } else
      for (let row = 0; row < (fontHeight || 256); row++) block(0x8d6, 0x8ef);
    block(0x8f1, 0x8ff);
    x = (x + fontWidth) & 65535;
    // Original resets DI from the x argument, dropping the initial surface
    // offset after the first glyph. Preserve that quirk, including wrap.
    di = x;
    glyphs++;
  }
  block(0x901, 0x906);
  return { instructions, portWrites, glyphs, alignedGlyphs };
}
