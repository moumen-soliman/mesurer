import { installKeyboardGate } from "../../../packages/mesurer/core/keyboard-gate"

installKeyboardGate(window, {
  isolateMesurerEvents: true,
  isolationHostId: "mesurer-extension-host",
})
