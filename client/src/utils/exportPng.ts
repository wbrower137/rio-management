import { toPng } from "html-to-image";

/** White threshold: pixels with R,G,B above this are treated as "white" when finding content bounds */
const WHITE_THRESHOLD = 248;

/**
 * Finds the bounding box of non-white content in an image and returns a cropped data URL.
 * Reduces white space for cleaner embedding in reports.
 */
export async function cropToContentBounds(
  dataUrl: string,
  options?: { padding?: number; whiteThreshold?: number }
): Promise<string> {
  const padding = options?.padding ?? 24;
  const threshold = options?.whiteThreshold ?? WHITE_THRESHOLD;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Failed to load image for cropping"));
    i.src = dataUrl;
  });

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const pixels = data.data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      const isWhite = r >= threshold && g >= threshold && b >= threshold;
      const isTransparent = a < 128;
      if (!isWhite && !isTransparent) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) return dataUrl;

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropRight = Math.min(w, maxX + padding + 1);
  const cropBottom = Math.min(h, maxY + padding + 1);
  const cropW = cropRight - cropX;
  const cropH = cropBottom - cropY;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return dataUrl;

  outCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return outCanvas.toDataURL("image/png");
}

/**
 * Captures a DOM element as PNG at its natural size (no forced dimensions).
 * Returns a data URL — use for embedding or download.
 */
export async function captureElementAsPngDataUrl(element: HTMLElement): Promise<string> {
  return toPng(element, {
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });
}

/**
 * Captures a DOM element and crops to content bounds (removes excess white space).
 * Use for report embedding where the content occupies a small portion of the frame.
 */
export async function captureElementAsPngDataUrlCropped(element: HTMLElement): Promise<string> {
  const dataUrl = await captureElementAsPngDataUrl(element);
  return cropToContentBounds(dataUrl);
}

/**
 * Captures a DOM element as PNG at its natural size and triggers download.
 */
export async function exportElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await captureElementAsPngDataUrl(element);
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = dataUrl;
  link.click();
}
