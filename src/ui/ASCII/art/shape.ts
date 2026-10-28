import { smoothstep } from "../../utils/math";

export const GOLDFISH_NODES = 20;

export type GoldfishKind =
  | "kohaku"    // Classic Orange & Pearl-White patched goldfish/koi
  | "yamabuki"  // Golden-Yellow & Ivory-White patched goldfish/koi
  | "fantail"   // Plump Tangerine-Orange & White double-veil fantail goldfish
  | "lemon";    // Bright Canary-Yellow & White veil-tailed goldfish

export interface GoldfishSpec {
  kind: GoldfishKind;
  size: number;
}

export const DEFAULT_GOLDFISH: GoldfishSpec[] = [
  { kind: "kohaku", size: 1.0 },
  { kind: "yamabuki", size: 0.86 },
  { kind: "fantail", size: 0.78 },
  { kind: "lemon", size: 0.72 },
];

export const SKIN_RAMP = ".:t%SX8#@";
export const FIN_GLYPHS = "% ;tS:";
export const RIDGE_GLYPHS = "@8%";
export const EDGE_HEAVY = "::;";
export const EDGE_LIGHT = ".',`";

export const FLAG_WHITE_BODY = 1;
export const FLAG_EDGE = 2;
export const FLAG_FIN = 3;
export const FLAG_RIDGE = 4;
export const FLAG_EYE = 5;
export const FLAG_COLOR_PATCH = 6;

export const SUBSAMPLES: readonly number[] = [
  0.25, 0.3, 0.75, 0.3, 0.25, 0.72, 0.75, 0.72,
];

export const SHIMMER_ACCENTS: readonly string[] = [
  "#ffffff",
  "#fff7ed",
  "#ffedd5",
  "#fef08a",
  "#fdba74",
];

export interface GoldfishShape {
  halfWidth: (s: number) => number;
  pectoral: [number, number, number, number];
  pelvic: [number, number, number, number];
  veilSpan: number;
  dorsal: [number, number];
  eye: [number, number];
  gills: [number, number];
  patchRgb: [number, number, number];
  whiteRgb: [number, number, number];
  finRgb: [number, number, number];
}

function standardGoldfishWidth(s: number, plumpness = 1.0): number {
  if (s < 0.14) {
    return 0.105 * plumpness * Math.pow(Math.sin(((s / 0.14) * Math.PI) / 2), 0.72);
  }
  if (s < 0.36) {
    return (0.105 + 0.028 * Math.sin(((s - 0.14) / 0.22) * Math.PI)) * plumpness;
  }
  if (s < 0.66) {
    const t = (s - 0.36) / 0.3;
    return 0.022 + (0.105 * plumpness - 0.022) * Math.pow(1 - t, 1.35);
  }
  const k = (s - 0.66) / 0.34;
  return 0.022 * Math.max(0, 1 - k * 1.15);
}

export const GOLDFISH_SHAPES: Record<GoldfishKind, GoldfishShape> = {
  kohaku: {
    halfWidth: (s: number) => standardGoldfishWidth(s, 1.04),
    pectoral: [0.16, 0.36, 0.44, 0.22],
    pelvic: [0.44, 0.56, 0.62, 0.12],
    veilSpan: 0.21,
    dorsal: [0.28, 0.54],
    eye: [0.065, 0.105],
    gills: [0.14, 0.21],
    patchRgb: [255, 94, 26],
    whiteRgb: [244, 246, 252],
    finRgb: [255, 195, 150],
  },
  yamabuki: {
    halfWidth: (s: number) => standardGoldfishWidth(s, 0.98),
    pectoral: [0.16, 0.35, 0.43, 0.21],
    pelvic: [0.45, 0.56, 0.62, 0.11],
    veilSpan: 0.19,
    dorsal: [0.27, 0.53],
    eye: [0.065, 0.105],
    gills: [0.14, 0.21],
    patchRgb: [252, 196, 25],
    whiteRgb: [248, 247, 240],
    finRgb: [254, 232, 165],
  },
  fantail: {
    halfWidth: (s: number) => standardGoldfishWidth(s, 1.18),
    pectoral: [0.15, 0.38, 0.47, 0.24],
    pelvic: [0.42, 0.55, 0.63, 0.135],
    veilSpan: 0.25,
    dorsal: [0.26, 0.52],
    eye: [0.06, 0.10],
    gills: [0.13, 0.20],
    patchRgb: [249, 115, 22],
    whiteRgb: [246, 244, 240],
    finRgb: [255, 218, 190],
  },
  lemon: {
    halfWidth: (s: number) => standardGoldfishWidth(s, 1.08),
    pectoral: [0.16, 0.37, 0.45, 0.22],
    pelvic: [0.43, 0.55, 0.62, 0.12],
    veilSpan: 0.23,
    dorsal: [0.27, 0.53],
    eye: [0.065, 0.105],
    gills: [0.14, 0.21],
    patchRgb: [250, 212, 40],
    whiteRgb: [245, 248, 252],
    finRgb: [254, 243, 190],
  },
};

export const GOLDFISH_KINDS: GoldfishKind[] = [
  "kohaku",
  "yamabuki",
  "fantail",
  "lemon",
];

export function inTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

export function isGoldfishColorPatch(
  s: number,
  vNorm: number,
  fishId: number,
  kind: GoldfishKind
): boolean {
  const seed = (fishId * 1.73) % 6.28;
  const warp =
    0.18 * Math.sin(s * 14 + seed) +
    0.14 * Math.cos(vNorm * 3.8 - seed * 1.3);

  if (kind === "fantail") {
    const saddle = Math.cos(s * 8.5 + warp) + 0.35 - Math.abs(vNorm) * 0.55;
    return saddle > -0.15;
  }

  if (kind === "lemon") {
    const crown = s < 0.22 && Math.abs(vNorm) < 0.78;
    const bodyPatch =
      s > 0.26 &&
      s < 0.56 &&
      Math.sin((s - 0.26) * 10.5 + warp) > 0.15 - (1 - Math.abs(vNorm)) * 0.3;
    return crown || bodyPatch;
  }

  const wave =
    Math.sin(s * 11.2 + seed + warp) +
    0.45 * Math.cos(vNorm * 2.6 + s * 5.0 - seed);
  const crownCap = s > 0.02 && s < 0.19 && Math.abs(vNorm) < 0.72;
  return crownCap || wave > 0.08 + smoothstep(0.55, 0.68, s) * 0.4;
}