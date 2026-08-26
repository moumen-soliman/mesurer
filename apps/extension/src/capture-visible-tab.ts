import { CAPTURE_VISIBLE_MESSAGE } from "./messages";

type CaptureOk = { ok: true; dataUrl: string };
type CaptureFail = { ok: false; error?: string };
type CaptureResponse = CaptureOk | CaptureFail;

export const captureVisibleTabPng = () =>
  new Promise<Blob>((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      reject(new Error("Screenshot is only available in the Chrome extension"));
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { type: CAPTURE_VISIBLE_MESSAGE },
        (response: CaptureResponse) => {
          if (chrome.runtime.lastError?.message) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response?.ok || !response.dataUrl) {
            reject(
              new Error(
                !response || response.ok
                  ? "Capture failed"
                  : (response.error ?? "Capture failed"),
              ),
            );
            return;
          }
          void fetch(response.dataUrl)
            .then((result) => result.blob())
            .then(resolve, reject);
        },
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Capture failed"));
    }
  });
