import type { ObfuscateMode, Rect } from "./types";

function scaled(source: HTMLCanvasElement, width: number, height: number, smooth: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Pixelated or blurred copy of `rect` of the image. Done by scaling down and up again, which works the same in every
 * browser (canvas `filter` isn't available in Safari) and keeps the edges of the area sharp.
 */
export function obfuscate(image: HTMLCanvasElement, rect: Rect, mode: ObfuscateMode): HTMLCanvasElement {
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  let region = document.createElement("canvas");
  region.width = w;
  region.height = h;
  region.getContext("2d")!.drawImage(image, -Math.round(rect.x), -Math.round(rect.y));

  if (mode === "pixelate") {
    const block = Math.max(6, Math.round(Math.min(w, h) / 10));
    const small = scaled(region, Math.ceil(w / block), Math.ceil(h / block), true);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, small.width * block, small.height * block);
    return out;
  }

  // Blur: halve the size a few times, then scale back up smoothly
  const target = Math.max(2, Math.min(w, h) / 24);
  const steps: HTMLCanvasElement[] = [];
  while (Math.min(region.width, region.height) / 2 >= target) {
    steps.push(region);
    region = scaled(region, region.width / 2, region.height / 2, true);
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    region = scaled(region, steps[i].width, steps[i].height, true);
  }
  return region.width === w && region.height === h ? region : scaled(region, w, h, true);
}
