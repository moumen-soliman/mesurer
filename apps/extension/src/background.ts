import { CAPTURE_VISIBLE_MESSAGE } from "./messages";

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    })
    .catch((error) => {
      console.error("Mesurer failed to inject", error);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== CAPTURE_VISIBLE_MESSAGE) return false;
  const windowId = sender.tab?.windowId;
  if (windowId === undefined) {
    sendResponse({ ok: false, error: "No window to capture" });
    return false;
  }

  chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError?.message ?? "Capture failed",
      });
      return;
    }
    sendResponse({ ok: true, dataUrl });
  });
  return true;
});
