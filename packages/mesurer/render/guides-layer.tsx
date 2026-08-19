import type { PointerEvent as ReactPointerEvent } from "react"
import type { Guide } from "../core/types"
import type { GuideStyle } from "../core/persistence"
import { GuideLine, GuidePreviewLine } from "./guide-line"

type GuideColors = {
  active: string
  hover: string
  default: string
  preview: string
}

type GuidesLayerProps = {
  guides: Guide[]
  selectedIds: string[]
  hoverId: string | null
  style: GuideStyle
  pointerEvents: boolean
  colors: GuideColors
  preview: { orientation: "vertical" | "horizontal"; position: number } | null
  onPointerDown: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
}

export function GuidesLayer({
  guides,
  selectedIds,
  hoverId,
  style,
  pointerEvents,
  colors,
  preview,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: GuidesLayerProps) {
  return (
    <>
      {preview ? (
        <GuidePreviewLine
          orientation={preview.orientation}
          position={preview.position}
          color={colors.preview}
        />
      ) : null}
      {guides.map((guide) => (
        <GuideLine
          key={guide.id}
          guide={guide}
          selected={selectedIds.includes(guide.id)}
          hovered={hoverId === guide.id}
          style={style}
          pointerEvents={pointerEvents}
          colorActive={colors.active}
          colorHover={colors.hover}
          colorDefault={colors.default}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      ))}
    </>
  )
}
