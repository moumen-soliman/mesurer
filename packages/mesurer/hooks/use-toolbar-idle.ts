import { useEffect, type RefObject } from "react"
import type { ToolMode } from "../core/types"

export const useToolbarIdle = ({
  ownerWindow,
  toolbarRef,
  toolbarActive,
  toolMode,
  setToolbarActive,
}: {
  ownerWindow: Window
  toolbarRef: RefObject<HTMLDivElement | null>
  toolbarActive: boolean
  toolMode: ToolMode
  setToolbarActive: (active: boolean) => void
}) => {
  useEffect(() => {
    if (!toolbarActive || toolMode !== "none") return

    const handlePointerDown = (event: PointerEvent) => {
      const toolbarNode = toolbarRef.current
      if (toolbarNode && toolbarNode.contains(event.target as Node)) return
      setToolbarActive(false)
    }

    ownerWindow.addEventListener("pointerdown", handlePointerDown)
    return () => {
      ownerWindow.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [ownerWindow, setToolbarActive, toolbarActive, toolbarRef, toolMode])
}
