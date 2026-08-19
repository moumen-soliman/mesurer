import {
  CAPTURE_BRIDGE_PING,
  CAPTURE_BRIDGE_PONG,
  CAPTURE_BRIDGE_REQUEST,
  CAPTURE_BRIDGE_RESPONSE,
  CAPTURE_VISIBLE_MESSAGE,
} from "./messages";

type CaptureResponse =
  | { ok: true; dataUrl: string }
  | { ok: false; error?: string };

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as {
    type?: string;
    id?: string;
  } | null;
  if (!data?.type || typeof data.id !== "string") return;

  if (data.type === CAPTURE_BRIDGE_PING) {
    window.postMessage({ type: CAPTURE_BRIDGE_PONG, id: data.id }, event.origin);
    return;
  }

  if (data.type !== CAPTURE_BRIDGE_REQUEST) return;

  chrome.runtime.sendMessage(
    { type: CAPTURE_VISIBLE_MESSAGE },
    (response: CaptureResponse) => {
      window.postMessage(
        {
          type: CAPTURE_BRIDGE_RESPONSE,
          id: data.id,
          ok: Boolean(response?.ok) && !chrome.runtime.lastError,
          dataUrl: response && response.ok ? response.dataUrl : undefined,
          error:
            chrome.runtime.lastError?.message ??
            (!response || response.ok ? undefined : response.error),
        },
        event.origin,
      );
    },
  );
});
