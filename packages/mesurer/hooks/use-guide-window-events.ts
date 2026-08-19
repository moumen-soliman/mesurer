import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react"
import { GUIDE_HITBOX_SIZE } from "../core/constants"
import type { Guide } from "../core/types"

type GuideDrag = {
  id: string
  orientation: "vertical" | "horizontal"
  pointerId: number
  commit: () => void
  committed: boolean
}

type UseGuideWindowEventsOptions = {
  ownerDocument: Document
  ownerWindow: Window
  enabled: boolean
  settingsOpen: boolean
  toolMode: string
  guides: Guide[]
  toolbarRef: RefObject<HTMLDivElement | null>
  createActionCommit: () => () => void
  setGuides: Dispatch<SetStateAction<Guide[]>>
  setSelectedGuideIds: Dispatch<SetStateAction<string[]>>
}

export const useGuideWindowEvents = ({
  ownerDocument,
  ownerWindow,
  enabled,
  settingsOpen,
  toolMode,
  guides,
  toolbarRef,
  createActionCommit,
  setGuides,
  setSelectedGuideIds,
}: UseGuideWindowEventsOptions) => {
  const guideScrollRef = useRef({
    x: ownerWindow.scrollX,
    y: ownerWindow.scrollY,
  })
  const guideDragRef = useRef<GuideDrag | null>(null)
  const guideUserSelectRef = useRef<string | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      const next = {
        x: ownerWindow.scrollX,
        y: ownerWindow.scrollY,
      }
      const deltaX = next.x - guideScrollRef.current.x
      const deltaY = next.y - guideScrollRef.current.y
      guideScrollRef.current = next
      if (deltaX === 0 && deltaY === 0) return

      setGuides((prev) =>
        prev.map((guide) => ({
          ...guide,
          position:
            guide.position -
            (guide.orientation === "vertical" ? deltaX : deltaY),
        })),
      )
    }

    ownerWindow.addEventListener("scroll", handleScroll, true)
    return () => ownerWindow.removeEventListener("scroll", handleScroll, true)
  }, [ownerWindow, setGuides])

  useEffect(() => {
    if (!enabled) return

    const handleGuidePointerDown = (event: PointerEvent) => {
      if (settingsOpen) return
      if (toolbarRef.current?.contains(event.target as Node)) return
      const OwnerElement = (ownerWindow as Window & { Element: typeof Element })
        .Element
      const guideTarget = event.composedPath().some(
        (target) =>
          target instanceof OwnerElement &&
          target.hasAttribute("data-mesurer-guide"),
      )
      if (guideTarget && toolMode !== "none") return

      const point = { x: event.clientX, y: event.clientY }
      const guide = guides.find((candidate) => {
        const distance =
          candidate.orientation === "vertical"
            ? Math.abs(candidate.position - point.x)
            : Math.abs(candidate.position - point.y)
        return distance <= GUIDE_HITBOX_SIZE / 2
      })
      if (!guide) return

      if (event.button === 0 && !event.shiftKey && toolMode === "none") {
        guideDragRef.current = {
          id: guide.id,
          orientation: guide.orientation,
          pointerId: event.pointerId,
          commit: createActionCommit(),
          committed: false,
        }
      }

      setSelectedGuideIds((prev) =>
        event.shiftKey
          ? prev.includes(guide.id)
            ? prev.filter((id) => id !== guide.id)
            : [...prev, guide.id]
          : [guide.id],
      )
    }

    const handleGuidePointerMove = (event: PointerEvent) => {
      const drag = guideDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const position =
        drag.orientation === "vertical" ? event.clientX : event.clientY
      if (!drag.committed) {
        event.preventDefault()
        if (guideUserSelectRef.current === null) {
          guideUserSelectRef.current =
            ownerDocument.documentElement.style.userSelect
          ownerDocument.documentElement.style.userSelect = "none"
        }
        ownerWindow.getSelection()?.removeAllRanges()
        drag.commit()
        drag.committed = true
      }
      setGuides((prev) =>
        prev.map((guide) =>
          guide.id === drag.id ? { ...guide, position } : guide,
        ),
      )
    }

    const handleGuidePointerEnd = (event: PointerEvent) => {
      if (guideDragRef.current?.pointerId === event.pointerId) {
        guideDragRef.current = null
        if (guideUserSelectRef.current !== null) {
          ownerDocument.documentElement.style.userSelect =
            guideUserSelectRef.current
          guideUserSelectRef.current = null
        }
      }
    }

    ownerWindow.addEventListener("pointerdown", handleGuidePointerDown, true)
    ownerWindow.addEventListener("pointermove", handleGuidePointerMove, true)
    ownerWindow.addEventListener("pointerup", handleGuidePointerEnd, true)
    ownerWindow.addEventListener("pointercancel", handleGuidePointerEnd, true)
    return () => {
      ownerWindow.removeEventListener(
        "pointerdown",
        handleGuidePointerDown,
        true,
      )
      ownerWindow.removeEventListener(
        "pointermove",
        handleGuidePointerMove,
        true,
      )
      ownerWindow.removeEventListener("pointerup", handleGuidePointerEnd, true)
      ownerWindow.removeEventListener(
        "pointercancel",
        handleGuidePointerEnd,
        true,
      )
      if (guideUserSelectRef.current !== null) {
        ownerDocument.documentElement.style.userSelect =
          guideUserSelectRef.current
        guideUserSelectRef.current = null
      }
    }
  }, [
    createActionCommit,
    enabled,
    guides,
    ownerDocument,
    ownerWindow,
    setGuides,
    setSelectedGuideIds,
    settingsOpen,
    toolMode,
    toolbarRef,
  ])
}
