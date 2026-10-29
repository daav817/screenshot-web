/** Ways to get an image into the editor: screen capture, clipboard and files. All return a canvas. */

export const canCaptureScreen = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ask the browser for a screen, window or tab and grab one frame of it.
 * `delaySeconds` gives the user time to bring the window they want to the front after picking a whole screen.
 */
export async function captureScreen(delaySeconds = 0, onCountdown?: (left: number) => void): Promise<HTMLCanvasElement> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    // Ask for native resolution: browsers otherwise may scale the capture down
    video: { displaySurface: "monitor", width: { ideal: 7680 }, height: { ideal: 4320 } } as MediaTrackConstraints,
    audio: false,
    // Chromium-only hints: don't offer this tab itself, and no switching surfaces mid-capture
    selfBrowserSurface: "exclude",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "include",
  } as DisplayMediaStreamOptions);
  try {
    for (let left = delaySeconds; left > 0; left--) {
      onCountdown?.(left);
      await sleep(1000);
    }
    onCountdown?.(0);
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    // Wait for a real frame: the first one can still be black on some systems
    await new Promise<void>((resolve) => {
      if ("requestVideoFrameCallback" in video) {
        video.requestVideoFrameCallback(() => resolve());
      } else {
        setTimeout(resolve, 150);
      }
    });
    await sleep(100);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return canvas;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/** First image on the system clipboard, via the async Clipboard API (needs permission in some browsers). */
export async function readClipboardImage(): Promise<HTMLCanvasElement | null> {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) return blobToCanvas(await item.getType(type));
  }
  return null;
}

/** First image in a paste or drop event. */
export function imageFromDataTransfer(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith("image/")) return file;
  }
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}
