/**
 * Lightweight 2D plotting on <canvas>, themed to the Dracula palette.
 * Shared by modules that draw diagrams (beam shear/moment, Mohr's circle,
 * truss geometry, cross-sections). Handles HiDPI scaling and world→screen
 * coordinate mapping with an inverted (math-style) Y axis.
 */

export const PALETTE = {
  bg: "#212029",
  grid: "#3a3a4a",
  axis: "#7970A9",
  text: "#F8F8F2",
  muted: "#9080b0",
  cyan: "#80FFEA",
  pink: "#FF80BF",
  green: "#8AFF80",
  orange: "#FFCA80",
  purple: "#9580FF",
  red: "#FF9580",
  series: ["#80FFEA", "#FF80BF", "#8AFF80", "#FFCA80", "#9580FF", "#FF9580"],
  fillPos: "rgba(138,255,128,0.22)",
  fillNeg: "rgba(255,128,191,0.22)",
};

export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export class Plot {
  readonly ctx: CanvasRenderingContext2D;
  private w: number;
  private h: number;
  private pad = { l: 52, r: 16, t: 16, b: 34 };
  private bounds: Bounds = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

  constructor(
    public canvas: HTMLCanvasElement,
    cssWidth = 640,
    cssHeight = 320,
  ) {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.scale(dpr, dpr);
    this.ctx = ctx;
    this.w = cssWidth;
    this.h = cssHeight;
  }

  /** Set world bounds, padding zero-height/width ranges so axes stay visible. */
  setBounds(b: Bounds): this {
    const padRange = (min: number, max: number): [number, number] => {
      if (min === max) {
        const d = Math.abs(min) || 1;
        return [min - d * 0.5, max + d * 0.5];
      }
      const m = (max - min) * 0.08;
      return [min - m, max + m];
    };
    const [xMin, xMax] = padRange(b.xMin, b.xMax);
    const [yMin, yMax] = padRange(b.yMin, b.yMax);
    this.bounds = { xMin, xMax, yMin, yMax };
    return this;
  }

  private sx(x: number): number {
    const { xMin, xMax } = this.bounds;
    const plotW = this.w - this.pad.l - this.pad.r;
    return this.pad.l + ((x - xMin) / (xMax - xMin)) * plotW;
  }

  private sy(y: number): number {
    const { yMin, yMax } = this.bounds;
    const plotH = this.h - this.pad.t - this.pad.b;
    // Inverted Y: larger world-y is higher on screen.
    return this.pad.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;
  }

  clear(): this {
    this.ctx.fillStyle = PALETTE.bg;
    this.ctx.fillRect(0, 0, this.w, this.h);
    return this;
  }

  /** Draw light grid + labelled axes with `xLabel`/`yLabel`. */
  axes(xLabel = "", yLabel = "", ticks = 6): this {
    const { ctx } = this;
    const { xMin, xMax, yMin, yMax } = this.bounds;
    ctx.strokeStyle = PALETTE.grid;
    ctx.fillStyle = PALETTE.muted;
    ctx.lineWidth = 1;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = 0; i <= ticks; i++) {
      const x = xMin + ((xMax - xMin) * i) / ticks;
      const px = this.sx(x);
      ctx.beginPath();
      ctx.moveTo(px, this.pad.t);
      ctx.lineTo(px, this.h - this.pad.b);
      ctx.stroke();
      ctx.fillText(trimNum(x), px, this.h - this.pad.b + 5);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= ticks; i++) {
      const y = yMin + ((yMax - yMin) * i) / ticks;
      const py = this.sy(y);
      ctx.beginPath();
      ctx.moveTo(this.pad.l, py);
      ctx.lineTo(this.w - this.pad.r, py);
      ctx.stroke();
      ctx.fillText(trimNum(y), this.pad.l - 6, py);
    }

    // Zero axes, emphasized.
    ctx.strokeStyle = PALETTE.axis;
    ctx.lineWidth = 1.4;
    if (yMin <= 0 && yMax >= 0) {
      const py = this.sy(0);
      ctx.beginPath();
      ctx.moveTo(this.pad.l, py);
      ctx.lineTo(this.w - this.pad.r, py);
      ctx.stroke();
    }

    ctx.fillStyle = PALETTE.text;
    if (xLabel) {
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(xLabel, this.w / 2, this.h - 2);
    }
    if (yLabel) {
      ctx.save();
      ctx.translate(12, this.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }
    return this;
  }

  /** Plot a polyline through world-space points. */
  line(pts: [number, number][], color: string, width = 2): this {
    if (pts.length === 0) return this;
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach(([x, y], i) =>
      i === 0 ? ctx.moveTo(this.sx(x), this.sy(y)) : ctx.lineTo(this.sx(x), this.sy(y)),
    );
    ctx.stroke();
    return this;
  }

  /** Fill the region between a polyline and the y=0 baseline (diagrams). */
  fillToZero(pts: [number, number][], posColor: string, negColor: string): this {
    if (pts.length < 2) return this;
    const { ctx } = this;
    const y0 = this.sy(0);
    for (const [color, sign] of [
      [posColor, 1],
      [negColor, -1],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(this.sx(pts[0][0]), y0);
      for (const [x, y] of pts) {
        const clipped = sign > 0 ? Math.max(0, y) : Math.min(0, y);
        ctx.lineTo(this.sx(x), this.sy(clipped));
      }
      ctx.lineTo(this.sx(pts[pts.length - 1][0]), y0);
      ctx.closePath();
      ctx.fill();
    }
    return this;
  }

  /** Filled circle at a world point. */
  dot(x: number, y: number, color: string, r = 4): this {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.sx(x), this.sy(y), r, 0, Math.PI * 2);
    ctx.fill();
    return this;
  }

  /** A text label at a world point. */
  label(x: number, y: number, text: string, color = PALETTE.text, dx = 6, dy = -6): this {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, this.sx(x) + dx, this.sy(y) + dy);
    return this;
  }

  /** Project a world point to screen pixels (for custom drawing). */
  project(x: number, y: number): [number, number] {
    return [this.sx(x), this.sy(y)];
  }
}

function trimNum(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? r.toString() : r.toFixed(2);
}
