import { translateShape } from "./shapes";
import type { Doc, Rect } from "./types";

/** Clamp a rectangle to the image and round it to whole pixels. */
export function clampRect(r: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  return {
    x,
    y,
    width: Math.max(0, Math.min(width, Math.round(r.x + r.width)) - x),
    height: Math.max(0, Math.min(height, Math.round(r.y + r.height)) - y),
  };
}

/** Cut the document down to `rect`: the image is cropped and the annotations move with it. */
export function cropDoc(doc: Doc, rect: Rect): Doc {
  const r = clampRect(rect, doc.image.width, doc.image.height);
  if (r.width < 1 || r.height < 1) return doc;
  const canvas = document.createElement("canvas");
  canvas.width = r.width;
  canvas.height = r.height;
  canvas.getContext("2d")!.drawImage(doc.image, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
  return { image: canvas, shapes: doc.shapes.map((s) => translateShape(s, -r.x, -r.y)) };
}
