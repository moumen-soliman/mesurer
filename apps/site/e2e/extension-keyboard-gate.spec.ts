import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const extensionGate = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../extension/dist/keyboard-gate.js",
);

test("extension keyboard gate isolates Mesurer and bridges page-editor shortcuts", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const root = document.createElement("div");
    root.className = "mesurer-root";
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    root.append(editor);
    shadow.append(root);
    document.body.append(host);
    const prompt = document.createElement("textarea");
    document.body.append(prompt);

    const state = {
      pageListenerEvents: 0,
      editorEvents: 0,
      bridgedEvents: 0,
    };
    editor.addEventListener("keydown", () => {
      state.editorEvents += 1;
    });
    (window as Window & { __gateState?: Record<string, number> }).__gateState = state;
    (window as Window & { __gateEditor?: HTMLElement }).__gateEditor = editor;
    (window as Window & { __gatePrompt?: HTMLTextAreaElement }).__gatePrompt = prompt;
  });
  await page.addScriptTag({ path: extensionGate });

  const result = await page.evaluate(async () => {
    const state = (window as Window & { __gateState: Record<string, number> }).__gateState;
    const editor = (window as Window & { __gateEditor: HTMLElement }).__gateEditor;
    const prompt = (window as Window & { __gatePrompt: HTMLTextAreaElement }).__gatePrompt;
    document.addEventListener("keydown", () => {
      state.pageListenerEvents += 1;
    });
    window.addEventListener("message", (event) => {
      if (event.data?.type === "__MESURER_KEYBOARD_BRIDGE__") state.bridgedEvents += 1;
    });

    document.documentElement.setAttribute("data-mesurer-kb", "1");
    editor.focus();
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );
    const afterEditor = { ...state };

    prompt.focus();
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    const owned = { ...afterEditor };

    document.documentElement.removeAttribute("data-mesurer-kb");
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );

    return { owned, bridgedEvents: state.bridgedEvents, releasedPageListenerEvents: state.pageListenerEvents };
  });

  expect(result.owned.editorEvents).toBe(1);
  expect(result.owned.pageListenerEvents).toBe(0);
  expect(result.bridgedEvents).toBe(1);
  expect(result.releasedPageListenerEvents).toBe(1);
});
