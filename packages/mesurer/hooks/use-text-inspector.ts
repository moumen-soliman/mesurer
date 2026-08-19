import { useEffect, useRef } from "react"
import type { ToolMode } from "../core/types"
import {
  createTextInspector,
  type TextInspectorAPI,
} from "../runtime/text-inspector"

export const useTextInspector = (
  portalTarget: HTMLElement | ShadowRoot,
  toolMode: ToolMode,
): TextInspectorAPI => {
  const textInspectorRef = useRef<TextInspectorAPI | null>(null)
  if (!textInspectorRef.current) {
    textInspectorRef.current = createTextInspector({ portalTarget })
  }
  const textInspector = textInspectorRef.current

  useEffect(() => {
    if (toolMode === "text-inspector") {
      textInspector.enable()
    } else {
      textInspector.disable()
    }
  }, [textInspector, toolMode])

  useEffect(() => {
    return () => {
      textInspector.destroy()
    }
  }, [textInspector])

  return textInspector
}
