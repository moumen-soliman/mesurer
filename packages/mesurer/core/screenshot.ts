export const MIN_SCREENSHOT_SELECTION = 4;

export type ScreenshotRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const normalizeScreenshotRect = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  viewport: { width: number; height: number },
): ScreenshotRect => {
  const left = Math.max(0, Math.min(start.x, end.x, viewport.width));
  const top = Math.max(0, Math.min(start.y, end.y, viewport.height));
  const right = Math.max(0, Math.min(Math.max(start.x, end.x), viewport.width));
  const bottom = Math.max(
    0,
    Math.min(Math.max(start.y, end.y), viewport.height),
  );
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

export const cropPngToViewportRect = async (
  blob: Blob,
  rect: ScreenshotRect,
  viewport: { width: number; height: number },
  ownerDocument: Document,
): Promise<Blob> => {
  const bitmap = await createImageBitmap(blob);
  const scaleX = bitmap.width / viewport.width;
  const scaleY = bitmap.height / viewport.height;
  const sx = Math.max(0, Math.round(rect.left * scaleX));
  const sy = Math.max(0, Math.round(rect.top * scaleY));
  const sw = Math.max(
    1,
    Math.min(bitmap.width - sx, Math.round(rect.width * scaleX)),
  );
  const sh = Math.max(
    1,
    Math.min(bitmap.height - sy, Math.round(rect.height * scaleY)),
  );
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not crop screenshot");
  }
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((cropped) => {
      if (cropped) resolve(cropped);
      else reject(new Error("Could not crop screenshot"));
    }, "image/png");
  });
};

export const copyPngToClipboard = async (
  png: Blob | Promise<Blob>,
  clipboard?: Clipboard | null,
) => {
  const target = clipboard ?? globalThis.navigator?.clipboard;
  if (!target?.write) {
    throw new Error("Clipboard is not available");
  }
  await target.write([new ClipboardItem({ "image/png": png })]);
};

export const hideNodesForCapture = (nodes: Array<HTMLElement | null>) => {
  const previous = nodes.flatMap((node) => {
    if (!node) return [];
    const visibility = node.style.getPropertyValue("visibility");
    const priority = node.style.getPropertyPriority("visibility");
    node.style.setProperty("visibility", "hidden", "important");
    return [{ node, visibility, priority }];
  });

  return () => {
    previous.forEach(({ node, visibility, priority }) => {
      if (visibility) node.style.setProperty("visibility", visibility, priority);
      else node.style.removeProperty("visibility");
    });
  };
};

export const waitForNextPaint = (targetWindow: Window) =>
  new Promise<void>((resolve) => {
    targetWindow.requestAnimationFrame(() => {
      targetWindow.requestAnimationFrame(() => resolve());
    });
  });
