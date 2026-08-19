import {
  useCallback,
  useMemo,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react"
import { getSnapGuidePosition } from "../core/guides"
import type { Guide } from "../core/types"
import { createId } from "../core/utils"

type UseRulerGuidesOptions = {
  ownerDocument: Document
  ownerWindow: Window
  overlayRef: RefObject<HTMLDivElement | null>
  enabled: boolean
  snapGuidesEnabled: boolean
  selectNewGuideEnabled: boolean
  settingsOpen: boolean
  settingsTab: string
  guides: Guide[]
  createActionCommit: () => () => void
  setGuides: Dispatch<SetStateAction<Guide[]>>
  setSelectedGuideIds: Dispatch<SetStateAction<string[]>>
  setDraggingGuideId: Dispatch<SetStateAction<string | null>>
  scheduleGuideDragHold: (
    id: string,
    onHold: (guideId: string) => void,
  ) => void
  clearGuideDragHold: () => void
}

export const useRulerGuides = ({
  ownerDocument,
  ownerWindow,
  overlayRef,
  enabled,
  snapGuidesEnabled,
  selectNewGuideEnabled,
  settingsOpen,
  settingsTab,
  guides,
  createActionCommit,
  setGuides,
  setSelectedGuideIds,
  setDraggingGuideId,
  scheduleGuideDragHold,
  clearGuideDragHold,
}: UseRulerGuidesOptions) => {
  const snapGuidePosition = useCallback(
    (
      orientation: "vertical" | "horizontal",
      position: number,
      draggingGuideId: string | null = null,
    ) =>
      getSnapGuidePosition({
        orientation,
        point:
          orientation === "vertical"
            ? { x: position, y: 0 }
            : { x: 0, y: position },
        snapGuidesEnabled,
        overlayNode: overlayRef.current,
        guides,
        draggingGuideId,
        document: ownerDocument,
      }),
    [guides, overlayRef, ownerDocument, snapGuidesEnabled],
  )

  const startGuideFromRuler = useCallback(
    (orientation: "vertical" | "horizontal", position: number) => {
      const id = createId()
      const commit = createActionCommit()
      commit()
      setSelectedGuideIds([])
      setGuides((prev) => [
        ...prev,
        { id, orientation, position: snapGuidePosition(orientation, position) },
      ])
      return id
    },
    [
      createActionCommit,
      setGuides,
      setSelectedGuideIds,
      snapGuidePosition,
    ],
  )

  const moveGuideFromRuler = useCallback(
    (id: string, position: number) => {
      setGuides((prev) =>
        prev.map((guide) =>
          guide.id === id
            ? {
                ...guide,
                position: snapGuidePosition(guide.orientation, position, id),
              }
            : guide,
        ),
      )
    },
    [setGuides, snapGuidePosition],
  )

  const finishGuideFromRuler = useCallback(
    (id: string) => {
      if (selectNewGuideEnabled) {
        setSelectedGuideIds([id])
      }
    },
    [selectNewGuideEnabled, setSelectedGuideIds],
  )

  const cancelGuideFromRuler = useCallback(
    (id: string) => {
      setGuides((prev) => prev.filter((guide) => guide.id !== id))
    },
    [setGuides],
  )

  const handleGuidePointerDown = useCallback(
    (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => {
      const commit = createActionCommit()
      if (!enabled) return
      event.stopPropagation()
      event.preventDefault()
      if (event.shiftKey) {
        commit()
        setSelectedGuideIds((prev) =>
          prev.includes(guide.id)
            ? prev.filter((id) => id !== guide.id)
            : [...prev, guide.id],
        )
        return
      }

      commit()
      setSelectedGuideIds([guide.id])
      scheduleGuideDragHold(guide.id, setDraggingGuideId)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [
      createActionCommit,
      enabled,
      scheduleGuideDragHold,
      setDraggingGuideId,
      setSelectedGuideIds,
    ],
  )

  const handleGuidePointerUp = useCallback(
    (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation()
      clearGuideDragHold()
      setDraggingGuideId((prev) => (prev === guide.id ? null : prev))
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    [clearGuideDragHold, setDraggingGuideId],
  )

  const overlayGuides = useMemo((): Guide[] => {
    if (guides.length > 0) return guides
    if (!settingsOpen || settingsTab !== "guides") return guides
    return [
      {
        id: "__mesurer-preview-vertical",
        orientation: "vertical",
        position: ownerWindow.innerWidth / 2,
      },
      {
        id: "__mesurer-preview-horizontal",
        orientation: "horizontal",
        position: ownerWindow.innerHeight / 2,
      },
    ]
  }, [guides, ownerWindow, settingsOpen, settingsTab])

  return {
    startGuideFromRuler,
    moveGuideFromRuler,
    finishGuideFromRuler,
    cancelGuideFromRuler,
    handleGuidePointerDown,
    handleGuidePointerUp,
    overlayGuides,
  }
}
