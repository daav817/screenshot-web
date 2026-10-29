import type { Rect, Shape, Style, Tool } from "./types";

let counter = 0;
export const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Rectangle spanning two points, whichever way the user dragged. */
export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

/** A new shape started at (x, y) with the given tool, or null for tools that don't draw by dragging. */
export function startShape(tool: Tool, x: number, y: number, style: Style): Shape | null {
  const id = newId();
  const shadow = style.shadow;
  switch (tool) {
    case "rect":
    case "ellipse":
      return { id, kind: tool, x, y, width: 0, height: 0, stroke: style.stroke, fill: style.fill, strokeWidth: style.strokeWidth, shadow };
    case "highlight":
      return { id, kind: "highlight", x, y, width: 0, height: 0, fill: style.highlight, shadow: false };
    case "obfuscate":
      return { id, kind: "obfuscate", x, y, width: 0, height: 0, mode: style.obfuscateMode, shadow: false };
    case "line":
    case "arrow":
      return { id, kind: tool, points: [x, y, x, y], stroke: style.stroke, strokeWidth: style.strokeWidth, shadow };
    case "freehand":
      return { id, kind: "freehand", points: [x, y], stroke: style.stroke, strokeWidth: style.strokeWidth, shadow };
    default:
      return null;
  }
}

/** The shape being drawn, updated for the pointer now at (x, y) after starting at (sx, sy). */
export function dragShape(shape: Shape, sx: number, sy: number, x: number, y: number, constrain: boolean): Shape {
  switch (shape.kind) {
    case "rect":
    case "ellipse":
    case "highlight":
    case "obfuscate": {
      if (constrain) {
        // Shift draws a square / circle
        const size = Math.max(Math.abs(x - sx), Math.abs(y - sy));
        x = sx + Math.sign(x - sx || 1) * size;
        y = sy + Math.sign(y - sy || 1) * size;
      }
      return { ...shape, ...normalizeRect(sx, sy, x, y) };
    }
    case "line":
    case "arrow": {
      if (constrain) {
        // Shift snaps to 45° steps
        const angle = Math.round(Math.atan2(y - sy, x - sx) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(x - sx, y - sy);
        x = sx + Math.cos(angle) * len;
        y = sy + Math.sin(angle) * len;
      }
      return { ...shape, points: [sx, sy, x, y] };
    }
    case "freehand":
      return { ...shape, points: [...shape.points, x, y] };
    default:
      return shape;
  }
}

/** Shapes drawn by an accidental click instead of a drag are dropped. */
export function isTooSmall(shape: Shape): boolean {
  switch (shape.kind) {
    case "rect":
    case "ellipse":
    case "highlight":
    case "obfuscate":
      return shape.width < 3 || shape.height < 3;
    case "line":
    case "arrow":
      return Math.hypot(shape.points[2] - shape.points[0], shape.points[3] - shape.points[1]) < 3;
    case "freehand":
      return shape.points.length < 4;
    default:
      return false;
  }
}

export function nextStepNumber(shapes: Shape[]): number {
  return shapes.reduce((max, s) => (s.kind === "step" ? Math.max(max, s.number) : max), 0) + 1;
}

export function translateShape(shape: Shape, dx: number, dy: number): Shape {
  if ("points" in shape) {
    return { ...shape, points: shape.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
  }
  return { ...shape, x: shape.x + dx, y: shape.y + dy };
}

/** Apply the style the user just picked to an existing shape, only touching the properties it has. */
export function restyleShape(shape: Shape, style: Partial<Style>): Shape {
  const next: Shape = { ...shape };
  if (style.shadow !== undefined && shape.kind !== "highlight" && shape.kind !== "obfuscate") next.shadow = style.shadow;
  switch (next.kind) {
    case "rect":
    case "ellipse":
      if (style.stroke !== undefined) next.stroke = style.stroke;
      if (style.fill !== undefined) next.fill = style.fill;
      if (style.strokeWidth !== undefined) next.strokeWidth = style.strokeWidth;
      break;
    case "line":
    case "arrow":
    case "freehand":
      if (style.stroke !== undefined) next.stroke = style.stroke;
      if (style.strokeWidth !== undefined) next.strokeWidth = style.strokeWidth;
      break;
    case "text":
      if (style.stroke !== undefined) next.fill = style.stroke;
      if (style.fontSize !== undefined) next.fontSize = style.fontSize;
      break;
    case "step":
      if (style.stroke !== undefined) next.fill = style.stroke;
      break;
    case "highlight":
      if (style.highlight !== undefined) next.fill = style.highlight;
      break;
    case "obfuscate":
      if (style.obfuscateMode !== undefined) next.mode = style.obfuscateMode;
      break;
  }
  return next;
}
