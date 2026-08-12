import type { Vec } from "../core/math";

export type CircleStyle = {
  color: string;
  width?: number;
  alpha?: number;
  dash?: readonly number[];
  glow?: number;
};

/** Stroked circle with the alpha/dash/glow bookkeeping every effect needs. */
export function strokeCircle(
  ctx: CanvasRenderingContext2D,
  at: Vec,
  radius: number,
  style: CircleStyle,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width ?? 3;
  ctx.globalAlpha = style.alpha ?? 1;
  if (style.dash) ctx.setLineDash([...style.dash]);
  if (style.glow) {
    ctx.shadowColor = style.color;
    ctx.shadowBlur = style.glow;
  }
  ctx.stroke();
  ctx.restore();
}

export function fillCircle(
  ctx: CanvasRenderingContext2D,
  at: Vec,
  radius: number,
  color: string,
  alpha = 1,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill();
  ctx.restore();
}

/** Run `paint` in a translated (and optionally rotated) local space. */
export function inLocalSpace(
  ctx: CanvasRenderingContext2D,
  at: Vec,
  angle: number,
  paint: () => void,
) {
  ctx.save();
  ctx.translate(at.x, at.y);
  if (angle) ctx.rotate(angle);
  paint();
  ctx.restore();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  at: Vec,
  style: { font: string; color: string; align?: CanvasTextAlign },
) {
  ctx.font = style.font;
  ctx.textAlign = style.align ?? "center";
  ctx.fillStyle = style.color;
  ctx.fillText(text, at.x, at.y);
}
