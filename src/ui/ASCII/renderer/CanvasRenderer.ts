import { clamp, hash3 } from "../../utils/math";
import {
  EDGE_HEAVY,
  EDGE_LIGHT,
  FIN_GLYPHS,
  FLAG_COLOR_PATCH,
  FLAG_EDGE,
  FLAG_EYE,
  FLAG_FIN,
  FLAG_RIDGE,
  FLAG_WHITE_BODY,
  GOLDFISH_KINDS,
  GOLDFISH_NODES,
  GOLDFISH_SHAPES,
  inTriangle,
  isGoldfishColorPatch,
  RIDGE_GLYPHS,
  SHIMMER_ACCENTS,
  SKIN_RAMP,
  SUBSAMPLES,
  type GoldfishKind,
  type GoldfishShape,
} from "../art/shape";
import type { Goldfish, World } from "../engine/world";

const ALPHA_LEVELS = 6;
const WAKE_STYLES: string[] = Array.from({ length: ALPHA_LEVELS }, (_, l) => {
  const a = ((l + 1) / ALPHA_LEVELS) * 0.85;
  return `rgba(255, 190, 95, ${a.toFixed(3)})`;
});

export function paintGrid(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  cw: number,
  ch: number,
  dpr: number
): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.strokeStyle = "rgba(255,255,255,0.055)";
  g.lineWidth = 1;
  g.beginPath();
  for (let c = 0; c <= Math.ceil(W / cw); c++) {
    const x = Math.round(c * cw * dpr) + 0.5;
    g.moveTo(x, 0);
    g.lineTo(x, H * dpr);
  }
  for (let r = 0; r <= Math.ceil(H / ch); r++) {
    const y = Math.round(r * ch * dpr) + 0.5;
    g.moveTo(0, y);
    g.lineTo(W * dpr, y);
  }
  g.stroke();
}

export class AsciiRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private cw = 12;
  private ch = 18;
  private cols = 0;
  private rows = 0;
  private fontFamily = "ui-monospace, Menlo, monospace";

  private energy = new Float32Array(0);
  private energyTmp = new Float32Array(0);

  private cellFlag = new Uint8Array(0);
  private cellShade = new Float32Array(0);
  private cellKey = new Uint32Array(0);
  private cellDepth = new Float32Array(0);
  private cellKind = new Uint8Array(0);

  private spine = new Float32Array(GOLDFISH_NODES * 2);
  private arc = new Float32Array(GOLDFISH_NODES);
  private arcTotal = 1;
  private shape: GoldfishShape = GOLDFISH_SHAPES.kohaku;
  private currentKind: GoldfishKind = GOLDFISH_KINDS[0];
  private fishId = 0;
  private finTipLeft = 0;
  private finTipRight = 0;

  private hitFlag = 0;
  private hitShade = 0;
  private hitS = 0;
  private hitV = 0;
  private hitDist = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.bg = document.createElement("canvas");
  }

  public get cellWidth(): number {
    return this.cw;
  }

  public get cellHeight(): number {
    return this.ch;
  }

  public setFontFamily(family: string): void {
    if (family) this.fontFamily = family;
  }

  public resize(width: number, height: number, dpr: number): void {
    const prevCols = this.cols;
    const prevRows = this.rows;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.cw = clamp(Math.round(width / 124), 8, 13);
    this.ch = Math.round(this.cw * 1.45);
    this.cols = Math.ceil(width / this.cw);
    this.rows = Math.ceil(height / this.ch);

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;

    const n = this.cols * this.rows;
    if (this.cols !== prevCols || this.rows !== prevRows) {
      this.energy = new Float32Array(n);
      this.energyTmp = new Float32Array(n);
      this.cellFlag = new Uint8Array(n);
      this.cellShade = new Float32Array(n);
      this.cellKey = new Uint32Array(n);
      this.cellDepth = new Float32Array(n);
      this.cellKind = new Uint8Array(n);
    }

    this.paintBackground();
  }

  private paintBackground(): void {
    const g = this.bg.getContext("2d");
    if (!g) return;
    const { width: W, height: H, dpr, cw, ch } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    paintGrid(g, W, H, cw, ch, dpr);
  }

  public render(world: World, dt: number): void {
    const { ctx, dpr, cols, ch } = this;
    if (cols === 0) return;
    const t = world.time;

    this.consumeEvents(world);
    this.rasterizeGoldfish(world.goldfish, t);
    this.depositWake(world);
    this.diffuse(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.drawWakeDots();

    ctx.font = `600 ${Math.round(ch * 0.74)}px ${this.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.drawGoldfish(t);
  }

  private cellIndex(x: number, y: number): number {
    const c = Math.floor(x / this.cw);
    const r = Math.floor(y / this.ch);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  private stamp(
    field: Float32Array,
    x: number,
    y: number,
    radius: number,
    amount: number
  ): void {
    const c0 = Math.floor(x / this.cw);
    const r0 = Math.floor(y / this.ch);
    for (let r = r0 - radius; r <= r0 + radius; r++) {
      for (let c = c0 - radius; c <= c0 + radius; c++) {
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
        const d = Math.hypot(c - c0, (r - r0) * 1.4);
        if (d > radius + 0.5) continue;
        const i = r * this.cols + c;
        field[i] = Math.min(1.6, field[i] + amount * (1 - d / (radius + 1)));
      }
    }
  }

  private consumeEvents(world: World): void {
    for (const e of world.events) {
      this.stamp(this.energy, e.x, e.y, 6, 1.4);
    }
    world.events.length = 0;
  }

  private depositWake(world: World): void {
    const { energy } = this;
    for (const gf of world.goldfish) {
      for (let k = GOLDFISH_NODES - 7; k < GOLDFISH_NODES; k++) {
        const i = this.cellIndex(gf.nodes[k * 2], gf.nodes[k * 2 + 1]);
        if (i >= 0) {
          energy[i] = Math.min(1.6, energy[i] + 0.055 + gf.speed * 0.0012);
        }
      }
    }
    if (world.pointer.active) {
      this.stamp(energy, world.pointer.x, world.pointer.y, 1, 0.09);
    }
  }

  private diffuse(dt: number): void {
    const { cols, rows, energy, energyTmp: tmp } = this;
    const decay = Math.exp(-dt * 1.5);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const l = c > 0 ? energy[i - 1] : energy[i];
        const rt = c < cols - 1 ? energy[i + 1] : energy[i];
        const u = r > 0 ? energy[i - cols] : energy[i];
        const d = r < rows - 1 ? energy[i + cols] : energy[i];
        tmp[i] = (energy[i] * 4 + l + rt + u + d) * 0.125 * decay;
      }
    }
    this.energy = tmp;
    this.energyTmp = energy;
  }

  private sampleGoldfish(px: number, py: number, L: number): boolean {
    const { spine, arc, shape } = this;
    const N = GOLDFISH_NODES;
    let best = Infinity;
    let bestS = 0;
    let bestSign = 1;
    let bestNx = 0;
    let bestNy = 0;

    for (let k = 0; k < N - 1; k++) {
      const ax = spine[k * 2];
      const ay = spine[k * 2 + 1];
      const sx = spine[(k + 1) * 2] - ax;
      const sy = spine[(k + 1) * 2 + 1] - ay;
      const len2 = sx * sx + sy * sy || 1;
      const u = clamp(((px - ax) * sx + (py - ay) * sy) / len2, 0, 1);
      const qx = ax + sx * u;
      const qy = ay + sy * u;
      const d2 = (px - qx) ** 2 + (py - qy) ** 2;
      if (d2 < best) {
        best = d2;
        const len = Math.sqrt(len2);
        bestS = (arc[k] + u * len) / this.arcTotal;
        bestSign = sx * (py - ay) - sy * (px - ax) >= 0 ? 1 : -1;
        bestNx = (-sy / len) * bestSign;
        bestNy = (sx / len) * bestSign;
      }
    }

    const a = Math.sqrt(best);
    const s = bestS;
    const u = s * L;
    const w = shape.halfWidth(s) * L;
    this.hitDist = a;
    this.hitS = s;
    this.hitV = a * bestSign;

    if (s <= 0.68 && a <= w) {
      const across = a / (w || 1);
      const facing = (bestNx * -0.6 + bestNy * -0.8) * across;
      let shade = 0.62 - across * across * 0.38 + facing * 0.25;
      let flag = isGoldfishColorPatch(s, across * bestSign, this.fishId, this.currentKind)
        ? FLAG_COLOR_PATCH
        : FLAG_WHITE_BODY;

      if (s > shape.dorsal[0] && s < shape.dorsal[1] && across < 0.24) {
        flag = FLAG_RIDGE;
        shade = 0.96;
      } else if (s > shape.eye[0] && s < shape.eye[1] && across > 0.58 && across < 0.92) {
        flag = FLAG_EYE;
        shade = 0;
      } else if (s > shape.gills[0] && s < shape.gills[1] && across > 0.62) {
        shade *= 0.68;
      }
      this.hitFlag = flag;
      this.hitShade = clamp(shade, 0.1, 1);
      return true;
    }

    if (s >= 0.62) {
      const t = (s - 0.62) / 0.38;
      const veilMax = L * shape.veilSpan * Math.sin(Math.pow(t, 0.65) * Math.PI * 0.92);
      const notch = t > 0.52 ? L * shape.veilSpan * 0.38 * ((t - 0.52) / 0.48) : 0;
      if (a <= veilMax && a >= notch) {
        const acrossVeil = (a - notch) / Math.max(1, veilMax - notch);
        const rays = 0.08 * Math.sin(acrossVeil * 22);
        this.hitFlag = t < 0.28 && acrossVeil < 0.35 ? FLAG_COLOR_PATCH : FLAG_FIN;
        this.hitShade = clamp(0.75 * (1 - t * 0.45) + rays, 0.22, 0.92);
        return true;
      }
    }

    const tip = bestSign > 0 ? this.finTipRight : this.finTipLeft;
    const [p0, p1, p2] = shape.pectoral;
    if (inTriangle(u, a, L * p0, 0, L * p1, 0, L * p2, tip)) {
      this.hitFlag = FLAG_FIN;
      this.hitShade = 0.45 + 0.32 * (1 - clamp(a / tip, 0, 1));
      return true;
    }

    const [v0, v1, v2, vr] = shape.pelvic;
    if (inTriangle(u, a, L * v0, 0, L * v1, 0, L * v2, L * vr)) {
      this.hitFlag = FLAG_FIN;
      this.hitShade = 0.48;
      return true;
    }

    return false;
  }

  private rasterizeGoldfish(list: Goldfish[], t: number): void {
    const { cellFlag, cellShade, cellKey, cellDepth, cellKind, spine, arc, cw, ch, cols, rows } = this;
    cellFlag.fill(0);

    for (const gf of list) {
      const L = gf.length;
      const N = GOLDFISH_NODES;
      const n = gf.nodes;
      const swim = clamp(gf.speed / 45, 0.5, 1.4);
      this.shape = GOLDFISH_SHAPES[gf.kind];
      this.currentKind = gf.kind;
      this.fishId = gf.id;
      const kindIndex = Math.max(0, GOLDFISH_KINDS.indexOf(gf.kind));

      for (let k = 0; k < N; k++) {
        const s = k / (N - 1);
        const a = Math.max(0, k - 1);
        const b = Math.min(N - 1, k + 1);
        let tx = n[a * 2] - n[b * 2];
        let ty = n[a * 2 + 1] - n[b * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const amp = L * 0.062 * (0.08 + 0.92 * Math.pow(s, 1.65)) * swim;
        const off = amp * Math.sin(gf.phase - s * 5.0);
        spine[k * 2] = n[k * 2] - ty * off;
        spine[k * 2 + 1] = n[k * 2 + 1] + tx * off;
      }

      arc[0] = 0;
      for (let k = 1; k < N; k++) {
        arc[k] =
          arc[k - 1] +
          Math.hypot(spine[k * 2] - spine[(k - 1) * 2], spine[k * 2 + 1] - spine[(k - 1) * 2 + 1]);
      }
      this.arcTotal = arc[N - 1] || 1;

      const bank = clamp(gf.turn * 0.4, -0.32, 0.32);
      const flutter = 1 + 0.09 * Math.sin(gf.phase * 0.85);
      const reachFin = this.shape.pectoral[3];
      this.finTipRight = L * reachFin * flutter * (1 - bank);
      this.finTipLeft = L * reachFin * flutter * (1 + bank);

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let k = 0; k < N; k++) {
        minX = Math.min(minX, spine[k * 2]);
        maxX = Math.max(maxX, spine[k * 2]);
        minY = Math.min(minY, spine[k * 2 + 1]);
        maxY = Math.max(maxY, spine[k * 2 + 1]);
      }

      const reach = L * 0.34;
      const c0 = Math.max(0, Math.floor((minX - reach) / cw));
      const c1 = Math.min(cols - 1, Math.floor((maxX + reach) / cw));
      const r0 = Math.max(0, Math.floor((minY - reach) / ch));
      const r1 = Math.min(rows - 1, Math.floor((maxY + reach) / ch));
      if (c0 > c1 || r0 > r1) continue;

      const skipBeyond = reach + Math.hypot(cw, ch);

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const x = c * cw;
          const y = r * ch;
          const centerHit = this.sampleGoldfish(x + cw / 2, y + ch / 2, L);
          if (!centerHit && this.hitDist > skipBeyond) continue;
          const flag = this.hitFlag;
          const shade = this.hitShade;
          const s = this.hitS;
          const v = this.hitV;

          let hits = centerHit ? 1 : 0;
          for (let k = 0; k < SUBSAMPLES.length; k += 2) {
            if (this.sampleGoldfish(x + SUBSAMPLES[k] * cw, y + SUBSAMPLES[k + 1] * ch, L)) {
              hits++;
            }
          }
          if (hits === 0) continue;
          const coverage = hits / 5;

          const i = r * cols + c;
          const key = (hash3(Math.round(s * 52), Math.round(v / (cw * 0.9)), gf.id) * 4294967295) >>> 0;
          cellKey[i] = key;
          cellDepth[i] = gf.depth;
          cellKind[i] = kindIndex;

          if (centerHit && coverage >= 0.6) {
            cellFlag[i] = flag;
            const flicker = (hash3(c, r, Math.floor(t * 6)) - 0.5) * 0.05;
            cellShade[i] = clamp(shade + flicker, 0, 1);
          } else {
            cellFlag[i] = FLAG_EDGE;
            cellShade[i] = coverage;
          }
        }
      }
    }
  }

  private drawGoldfish(t: number): void {
    const { ctx, cols, rows, cw, ch, cellFlag, cellShade, cellKey, cellDepth, cellKind } = this;
    const n = cols * rows;

    for (let i = 0; i < n; i++) {
      const flag = cellFlag[i];
      if (!flag) continue;

      const col = i % cols;
      const row = (i / cols) | 0;
      const x = col * cw;
      const y = row * ch;
      const key = cellKey[i];
      const shade = cellShade[i];
      const dim = 0.75 + 0.25 * cellDepth[i];
      const shape = GOLDFISH_SHAPES[GOLDFISH_KINDS[cellKind[i]] || "kohaku"];

      const tick = Math.floor(t * 2.2 + (key % 997) / 97);
      const roll = hash3(key, tick, 7);

      if (flag === FLAG_EDGE) {
        const set = shade >= 0.5 ? EDGE_HEAVY : EDGE_LIGHT;
        const [fr, fg, fb] = shape.finRgb;
        const bright = (0.45 + shade * 0.45) * dim;
        ctx.fillStyle = `rgb(${Math.round(fr * bright)},${Math.round(fg * bright)},${Math.round(fb * bright)})`;
        ctx.fillText(set[(key >>> 8) % set.length], x + cw / 2, y + ch / 2 + 1);
        continue;
      }

      let rBg = 0;
      let gBg = 0;
      let bBg = 0;
      let glyph = ".";

      if (flag === FLAG_EYE) {
        rBg = 16;
        gBg = 16;
        bBg = 20;
        glyph = "o";
      } else if (flag === FLAG_RIDGE) {
        const [pr, pg, pb] = shape.whiteRgb;
        rBg = Math.min(255, Math.round(pr * 0.98 * dim));
        gBg = Math.min(255, Math.round(pg * 0.98 * dim));
        bBg = Math.min(255, Math.round(pb * 0.98 * dim));
        glyph = RIDGE_GLYPHS[(key >>> 8) % RIDGE_GLYPHS.length];
      } else if (flag === FLAG_FIN) {
        const [fr, fg, fb] = shape.finRgb;
        const light = (0.32 + shade * 0.65) * dim;
        rBg = Math.round(fr * light);
        gBg = Math.round(fg * light);
        bBg = Math.round(fb * light);
        glyph = FIN_GLYPHS[(key >>> 8) % FIN_GLYPHS.length];
      } else if (flag === FLAG_COLOR_PATCH) {
        const [pr, pg, pb] = shape.patchRgb;
        const light = (0.38 + shade * 0.68) * dim;
        rBg = Math.min(255, Math.round(pr * light));
        gBg = Math.min(255, Math.round(pg * light));
        bBg = Math.min(255, Math.round(pb * light));
        const jitter = ((key >>> 4) % 3) - 1;
        glyph = SKIN_RAMP[clamp(Math.floor((1 - shade) * 8.99) + jitter, 0, SKIN_RAMP.length - 1)];
      } else {
        const [wr, wg, wb] = shape.whiteRgb;
        const light = (0.35 + shade * 0.65) * dim;
        rBg = Math.min(255, Math.round(wr * light));
        gBg = Math.min(255, Math.round(wg * light));
        bBg = Math.min(255, Math.round(wb * light));
        const jitter = ((key >>> 4) % 3) - 1;
        glyph = SKIN_RAMP[clamp(Math.floor((1 - shade) * 8.99) + jitter, 0, SKIN_RAMP.length - 1)];
      }

      ctx.fillStyle = `rgb(${rBg},${gBg},${bBg})`;
      ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);

      let glyphColor = "#121010";
      if (flag === FLAG_EYE) {
        glyphColor = "#fef08a";
      } else if (roll < 0.09) {
        glyphColor = SHIMMER_ACCENTS[key % SHIMMER_ACCENTS.length];
      } else {
        glyphColor = shade > 0.55 ? "#121010" : "#241c18";
      }
      ctx.fillStyle = glyphColor;
      ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1);
    }
  }

  private drawWakeDots(): void {
    const { ctx, cols, rows, cw, ch, energy, cellFlag } = this;
    const n = cols * rows;
    const size = Math.max(2, Math.round(cw * 0.22));

    for (let i = 0; i < n; i++) {
      if (cellFlag[i]) continue;
      const e = energy[i];
      if (e < 0.42) continue;
      const level = clamp(Math.floor((e - 0.42) * 5), 0, ALPHA_LEVELS - 1);
      const col = i % cols;
      const row = (i / cols) | 0;
      ctx.fillStyle = WAKE_STYLES[level];
      ctx.fillRect(
        Math.round(col * cw + cw * 0.66 - size / 2),
        Math.round(row * ch + ch * 0.64 - size / 2),
        size,
        size
      );
    }
  }
}