import { angleDiff, clamp, rand, TAU } from "../../utils/math";
import {
  DEFAULT_GOLDFISH,
  GOLDFISH_NODES,
  type GoldfishKind,
  type GoldfishSpec,
} from "../art/shape";

export { GOLDFISH_NODES, type GoldfishKind, type GoldfishSpec };

export interface Goldfish {
  id: number;
  kind: GoldfishKind;
  length: number;
  nodes: Float32Array;
  heading: number;
  speed: number;
  phase: number;
  turn: number;
  wander: number;
  orbitDir: 1 | -1;
  orbitRadius: number;
  depth: number;
}

export interface WorldEvent {
  kind: "splash";
  x: number;
  y: number;
}

export class World {
  public width = 0;
  public height = 0;
  public time = 0;
  public goldfish: Goldfish[] = [];
  public events: WorldEvent[] = [];
  public pointer: { x: number; y: number; active: boolean } = {
    x: 0,
    y: 0,
    active: false,
  };
  private specs: GoldfishSpec[];

  constructor(specs: GoldfishSpec[] = DEFAULT_GOLDFISH) {
    this.specs = specs && specs.length > 0 ? specs : DEFAULT_GOLDFISH;
  }

  public setMouse(x: number, y: number): void {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = true;
  }

  public clearMouse(): void {
    this.pointer.active = false;
  }

  public resize(width: number, height: number): void {
    const first = this.width === 0;
    this.width = width;
    this.height = height;
    if (first || this.goldfish.length === 0) {
      this.seed();
    }
  }

  public seed(): void {
    const W = this.width;
    const H = this.height;
    const minSide = Math.min(W, H);
    const baseLength = clamp(minSide * 0.38, 160, 360);
    const count = this.specs.length;

    this.goldfish = [];
    for (let i = 0; i < count; i++) {
      const spec = this.specs[i];
      const length = baseLength * spec.size;
      const orbitRadius = minSide * rand(0.24, 0.38);
      const a = (i / count) * TAU + rand(-0.35, 0.35);
      const orbitDir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const x = W / 2 + Math.cos(a) * orbitRadius * (W / minSide) * 0.85;
      const y = H / 2 + Math.sin(a) * orbitRadius;
      const heading = a + (orbitDir * Math.PI) / 2;

      const nodes = new Float32Array(GOLDFISH_NODES * 2);
      const seg = length / (GOLDFISH_NODES - 1);
      for (let n = 0; n < GOLDFISH_NODES; n++) {
        nodes[n * 2] = x - Math.cos(heading) * seg * n;
        nodes[n * 2 + 1] = y - Math.sin(heading) * seg * n;
      }

      this.goldfish.push({
        id: i + 1,
        kind: spec.kind,
        length,
        nodes,
        heading,
        speed: 26,
        phase: rand(0, TAU),
        turn: 0,
        wander: 0,
        orbitDir,
        orbitRadius,
        depth: spec.size,
      });
    }

    this.goldfish.sort((a, b) => a.length - b.length);
  }

  public splash(x: number, y: number): void {
    this.events.push({ kind: "splash", x, y });
    for (const gf of this.goldfish) {
      const dx = x - gf.nodes[0];
      const dy = y - gf.nodes[1];
      const d = Math.hypot(dx, dy);
      if (d < 120 && d > 1) {
        gf.heading = Math.atan2(-dy, -dx);
        gf.speed = 54;
      } else if (d < 420) {
        gf.wander = clamp(angleDiff(gf.heading, Math.atan2(dy, dx)), -0.9, 0.9);
      }
    }
  }

  public step(dt: number): void {
    this.time += dt;
    const W = this.width;
    const H = this.height;
    const time = this.time;
    const pointer = this.pointer;
    const minSide = Math.min(W, H) || 1;
    const cxW = W / 2;
    const cyW = H / 2;

    for (const gf of this.goldfish) {
      const L = gf.length;
      const nodes = gf.nodes;
      const hx = nodes[0];
      const hy = nodes[1];

      let dx = Math.cos(gf.heading);
      let dy = Math.sin(gf.heading);

      gf.wander = clamp(gf.wander + (Math.random() - 0.5) * dt * 2.4, -1.0, 1.0);
      dx += Math.cos(gf.heading + gf.wander) * 0.42;
      dy += Math.sin(gf.heading + gf.wander) * 0.42;

      if (pointer.active) {
        const px = pointer.x - hx;
        const py = pointer.y - hy;
        const pd = Math.hypot(px, py);
        if (pd > 90 && pd < 380) {
          dx += (px / pd) * 0.55;
          dy += (py / pd) * 0.55;
        }
      }

      const rx = (hx - cxW) / (W / minSide || 1);
      const ry = hy - cyW;
      const r = Math.hypot(rx, ry) || 1;
      const radius = gf.orbitRadius * (1 + 0.16 * Math.sin(time * 0.06 + gf.id));
      const radial = clamp((radius - r) / (radius || 1), -1, 1);
      dx += ((-ry / r) * gf.orbitDir + (rx / r) * radial * 0.9) * 0.52;
      dy += ((rx / r) * gf.orbitDir + (ry / r) * radial * 0.9) * 0.52;

      for (const other of this.goldfish) {
        if (other === gf) continue;
        for (let k = 0; k < GOLDFISH_NODES; k += 4) {
          const ox = hx - other.nodes[k * 2];
          const oy = hy - other.nodes[k * 2 + 1];
          const d = Math.hypot(ox, oy);
          const range = (L + other.length) * 0.42;
          if (d < range && d > 1e-3) {
            const w = (1 - d / range) * 2.6;
            dx += (ox / d) * w;
            dy += (oy / d) * w;
          }
        }
      }

      const ex = (hx - cxW) / (W * 0.28 || 1);
      const ey = (hy - cyW) / (H * 0.15 || 1);
      const e2 = ex * ex + ey * ey;
      if (e2 < 1) {
        const e = Math.sqrt(e2) || 1e-3;
        const w = (1 - e) * 2.2;
        dx += (ex / e) * w;
        dy += (ey / e) * w;
      }

      const over = Math.max(-hx, hx - W, -hy, hy - H);
      if (over > -L * 0.05) {
        const w = clamp((over + L * 0.05) / (L * 0.35), 0, 1) * 3.4;
        const toX = cxW - hx;
        const toY = cyW - hy;
        const d = Math.hypot(toX, toY) || 1;
        dx += (toX / d) * w;
        dy += (toY / d) * w;
      }

      const desired = Math.atan2(dy, dx);
      const agility = Math.min(0.95, gf.speed / (L * 0.2));
      const maxTurn = agility * dt;
      const turned = clamp(angleDiff(gf.heading, desired), -maxTurn, maxTurn);
      gf.heading += turned;
      gf.turn += (turned / dt - gf.turn) * Math.min(1, dt * 3.2);

      const cruise = 24 + L * 0.032;
      gf.speed += (cruise - gf.speed) * Math.min(1, dt * 1.4);
      gf.phase += dt * (2.2 + gf.speed / 20);

      nodes[0] += Math.cos(gf.heading) * gf.speed * dt;
      nodes[1] += Math.sin(gf.heading) * gf.speed * dt;

      const seg = L / (GOLDFISH_NODES - 1);
      const maxBend = 0.18;
      let prevAngle = gf.heading + Math.PI;
      for (let k = 1; k < GOLDFISH_NODES; k++) {
        const px = nodes[(k - 1) * 2];
        const py = nodes[(k - 1) * 2 + 1];
        let angle = Math.atan2(nodes[k * 2 + 1] - py, nodes[k * 2] - px);
        angle = prevAngle + clamp(angleDiff(prevAngle, angle), -maxBend, maxBend);
        nodes[k * 2] = px + Math.cos(angle) * seg;
        nodes[k * 2 + 1] = py + Math.sin(angle) * seg;
        prevAngle = angle;
      }
    }
  }
}