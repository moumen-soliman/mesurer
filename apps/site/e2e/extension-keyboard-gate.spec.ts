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
      pageInputEvents: 0,
      editorEvents: 0,
      bridgedEvents: 0,
    };
    document.addEventListener("keydown", () => {
      state.pageListenerEvents += 1;
    });
    document.addEventListener("input", () => {
      state.pageInputEvents += 1;
    });
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
    window.addEventListener("message", (event) => {
      if (event.data?.type === "__MESURER_KEYBOARD_BRIDGE__") state.bridgedEvents += 1;
    });

    document.documentElement.setAttribute("data-mesurer-kb", "1");
    const toolbar = document.createElement("button");
    toolbar.type = "button";
    toolbar.className = "mesurer-root";
    document.body.append(toolbar);
    toolbar.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );
    const afterToolbar = { ...state };
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

    document.documentElement.removeAttribute("data-mesurer-kb");
    prompt.focus();
    document.documentElement.setAttribute("data-mesurer-kb", "1");
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "t",
        code: "KeyT",
      }),
    );
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "z",
        code: "KeyZ",
        ctrlKey: true,
      }),
    );
    prompt.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: "x",
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

    return {
      owned,
      afterToolbar,
      bridgedEvents: state.bridgedEvents,
      pageInputEvents: state.pageInputEvents,
      releasedPageListenerEvents: state.pageListenerEvents,
    };
  });

  expect(result.owned.editorEvents).toBe(1);
  expect(result.afterToolbar.pageListenerEvents).toBe(0);
  expect(result.owned.pageListenerEvents).toBe(1);
  expect(result.pageInputEvents).toBe(0);
  expect(result.bridgedEvents).toBe(3);
  expect(result.releasedPageListenerEvents).toBe(2);
});
