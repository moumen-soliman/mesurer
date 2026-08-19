import type { SettingsTab } from "../components/settings-panel"
import type { ToolMode } from "./types"

export const settingsTabForContext = ({
  screenshotOpen,
  colorPickerActive,
  toolMode,
  rulersVisible,
}: {
  screenshotOpen: boolean
  colorPickerActive: boolean
  toolMode: ToolMode
  rulersVisible: boolean
}): SettingsTab => {
  if (screenshotOpen) return "screenshot"
  if (colorPickerActive) return "color-picker"
  if (toolMode === "guides") return "guides"
  if (toolMode === "select" || toolMode === "text-inspector") return "select"
  if (rulersVisible) return "rulers"
  return "general"
}
