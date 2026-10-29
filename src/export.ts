/** Getting the finished screenshot out of the browser: download, clipboard and print. */

export function timestampName(ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `screenshot-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.${ext}`;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image"))), type, quality),
  );
}

export async function download(canvas: HTMLCanvasElement, format: "png" | "jpg"): Promise<void> {
  let source = canvas;
  if (format === "jpg") {
    // JPEG has no transparency: put the image on white
    source = document.createElement("canvas");
    source.width = canvas.width;
    source.height = canvas.height;
    const ctx = source.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, source.width, source.height);
    ctx.drawImage(canvas, 0, 0);
  }
  const blob = await canvasToBlob(source, format === "png" ? "image/png" : "image/jpeg", 0.92);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = timestampName(format);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const canCopyImage = () => typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

export async function copyToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  // Passing the promise keeps Safari's user-gesture requirement satisfied
  await navigator.clipboard.write([new ClipboardItem({ "image/png": canvasToBlob(canvas) })]);
}

export function print(canvas: HTMLCanvasElement): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(
    `<!doctype html><title>Screenshot</title><style>@page{margin:10mm}html,body{margin:0}img{max-width:100%;max-height:100vh;display:block;margin:auto}</style><img src="${canvas.toDataURL("image/png")}">`,
  );
  doc.close();
  const img = doc.querySelector("img")!;
  const go = () => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 1000);
  };
  if (img.complete) go();
  else img.onload = go;
}
