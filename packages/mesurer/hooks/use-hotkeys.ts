import type { Dispatch, SetStateAction } from "react"
import { useLayoutEffect, useRef } from "react"
import {
  isOverlayEscapeConsumed,
  isTypingInMesurer,
  isTypingInPage,
} from "../core/keyboard-ownership"
import type { ToolMode } from "../core/types"

const DOUBLE_ESCAPE_MS = 400

type HotkeyOptions = {
  eventTarget: Window
  overlayRef: { current: HTMLElement | null }
  enabled: boolean
  clearTransientState: () => void
  hasTransientInteraction: () => boolean
  isActiveToolMode: () => boolean
  hasSelection: () => boolean
  clearSelection: () => void
  exitActiveTool: () => void
  exitMesurerCompletely: () => void
  undo: () => void
  redo: () => void
  removeSelected: () => boolean
  selectAllAnnotations: () => boolean
  setEnabled: Dispatch<SetStateAction<boolean>>
  setToolMode: Dispatch<SetStateAction<ToolMode>>
  setXrayVisible: Dispatch<SetStateAction<boolean>>
  setRulersVisible: Dispatch<SetStateAction<boolean>>
  setAltPressed: Dispatch<SetStateAction<boolean>>
  isOverlayActive: () => boolean
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>
  onInteract: () => void
  onColorPicker: () => void
  onScreenshot: () => void
  onCloseScreenshot: () => void
  isScreenshotActive: () => boolean
  onToggleXray: () => void
  onToggleRulers: () => void
  onToggleSettings: () => void
  isSettingsOpen: () => boolean
  onCloseColorPicker: () => void
  isColorPickerActive: () => boolean
}

const attachCapture = (
  roots: EventTarget[],
  type: string,
  listener: EventListener,
) => {
  for (const root of roots) root.addEventListener(type, listener, true)
  return () => {
    for (const root of roots) root.removeEventListener(type, listener, true)
  }
}

export const useHotkeys = (options: HotkeyOptions) => {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const lastEscapeAtRef = useRef(0)

  useLayoutEffect(() => {
    const target = options.eventTarget
    const seen = new WeakSet<Event>()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (seen.has(event)) return
      seen.add(event)
      const current = optionsRef.current
      if (isTypingInMesurer(event, target)) {
        return
      }
      if (event.key === "Escape") {
        if (isOverlayEscapeConsumed(event)) return
        if (current.isSettingsOpen()) {
          current.onToggleSettings()
          return
        }
        if (current.isScreenshotActive()) {
          current.onCloseScreenshot()
          return
        }
        if (current.isColorPickerActive()) {
          current.onCloseColorPicker()
          return
        }
        event.preventDefault()
        const now = Date.now()
        const doubleEscape = now - lastEscapeAtRef.current < DOUBLE_ESCAPE_MS
        lastEscapeAtRef.current = now
        if (doubleEscape) {
          current.exitMesurerCompletely()
          return
        }
        if (current.hasTransientInteraction()) {
          current.clearTransientState()
          return
        }
        if (current.isActiveToolMode()) {
          current.exitActiveTool()
          return
        }
        if (current.hasSelection()) {
          current.clearSelection()
          return
        }
        return
      }

      const hasPrimaryModifier =
        event.metaKey ||
        event.ctrlKey ||
        event.getModifierState("Meta") ||
        event.getModifierState("Control")
      const isSelectAll =
        hasPrimaryModifier &&
        ((event.key && event.key.toLowerCase() === "a") || event.code === "KeyA")

      if (isSelectAll) {
        if (isTypingInPage(target) && !current.isOverlayActive()) return
        const didSelect = current.selectAllAnnotations()
        if (didSelect || current.isOverlayActive()) {
          event.preventDefault()
          event.stopImmediatePropagation()
          current.overlayRef.current?.focus({ preventScroll: true })
        }
        return
      }

      if (!current.isOverlayActive() && isTypingInPage(target)) return

      if (hasPrimaryModifier) {
        if (event.key === ",") {
          event.preventDefault()
          current.onCloseScreenshot()
          current.onToggleSettings()
          current.onInteract()
          return
        }
        if (event.key.toLowerCase() !== "z") return
        if (event.shiftKey) {
          event.preventDefault()
          current.redo()
          return
        }
        event.preventDefault()
        current.undo()
        return
      }

      if (event.key.toLowerCase() === "m") {
        current.setEnabled((prev) => !prev)
      }

      const key = event.key.toLowerCase()
      if (event.altKey) return

      if (key === "p") {
        event.preventDefault()
        current.onCloseScreenshot()
        current.onColorPicker()
        current.onInteract()
        return
      }

      if (key === "c") {
        event.preventDefault()
        current.onScreenshot()
        current.onInteract()
        return
      }

      if (key === "x" || key === "r") {
        event.preventDefault()
        current.setEnabled(true)
        current.clearTransientState()
        current.onCloseColorPicker()
        current.onCloseScreenshot()
        if (key === "x") current.onToggleXray()
        else current.onToggleRulers()
        current.onInteract()
        return
      }

      if (key === "1" || key === "2") {
        current.clearTransientState()
        current.setEnabled(true)
        current.onCloseColorPicker()
        current.onCloseScreenshot()
        current.setXrayVisible(false)
        current.setRulersVisible(false)
        current.setToolMode(key === "1" ? "select" : "selection")
        current.onInteract()
        return
      }

      if (current.isOverlayActive()) {
        if (key === "a" && !hasPrimaryModifier) {
          current.clearTransientState()
          current.onCloseScreenshot()
          current.setToolMode((prev) =>
            prev === "text-inspector" ? "none" : "text-inspector",
          )
          current.onInteract()
          return
        }

        if (key === "i") {
          current.clearTransientState()
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "select" ? "none" : "select"))
          current.onInteract()
        }

        if (key === "s") {
          current.clearTransientState()
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "selection" ? "none" : "selection"))
          current.onInteract()
        }

        if (key === "g") {
          current.clearTransientState()
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "guides" ? "none" : "guides"))
          current.onInteract()
        }

        if (key === "d") {
          current.clearTransientState()
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "arrows" ? "none" : "arrows"))
          current.onInteract()
        }

        if (key === "n") {
          current.clearTransientState()
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "pen" ? "none" : "pen"))
          current.onInteract()
        }

        if (key === "t") {
          current.clearTransientState()
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "text" ? "none" : "text"))
          current.onInteract()
        }

        if (key === "h") {
          current.setGuideOrientation("horizontal")
          current.onInteract()
        }

        if (key === "v") {
          current.setGuideOrientation("vertical")
          current.onInteract()
        }
      }

      if (event.key === "Alt") {
        current.setAltPressed(true)
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        if (current.removeSelected()) event.preventDefault()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        optionsRef.current.setAltPressed(false)
      }
    }

    const roots: EventTarget[] = [target, target.document, target.document.documentElement]
    const overlayRoot = options.overlayRef.current?.getRootNode()
    if (overlayRoot && overlayRoot !== target.document) roots.push(overlayRoot)

    const detachKeyDown = attachCapture(roots, "keydown", handleKeyDown as EventListener)
    const detachKeyUp = attachCapture(roots, "keyup", handleKeyUp as EventListener)
    return () => {
      detachKeyDown()
      detachKeyUp()
    }
  }, [options.enabled, options.eventTarget, options.overlayRef])
}
