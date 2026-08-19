import type { PointerEvent as ReactPointerEvent } from "react"
import { GUIDE_HITBOX_SIZE } from "../core/constants"
import type { Guide } from "../core/types"
import type { GuideStyle } from "../core/persistence"

type GuideLineProps = {
  guide: Guide
  selected: boolean
  hovered: boolean
  style: GuideStyle
  pointerEvents: boolean
  colorActive: string
  colorHover: string
  colorDefault: string
  onPointerDown: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
}

export function GuideLine({
  guide,
  selected,
  hovered,
  style,
  pointerEvents,
  colorActive,
  colorHover,
  colorDefault,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: GuideLineProps) {
  const strokeColor = selected
    ? colorActive
    : hovered
      ? colorHover
      : colorDefault
  const strokeWidth = style.width
  const isSolid = style.pattern === "solid"
  const backgroundImage = style.pattern === "solid"
    ? undefined
    : style.pattern === "dotted"
      ? `radial-gradient(circle, ${strokeColor} 0 ${strokeWidth / 2}px, transparent ${strokeWidth / 2 + 0.5}px)`
      : `repeating-linear-gradient(${guide.orientation === "vertical" ? "to bottom" : "to right"}, ${strokeColor} 0 ${style.dashLength}px, transparent ${style.dashLength}px ${style.dashLength + style.gap}px)`
  const backgroundSize = style.pattern === "dotted"
    ? guide.orientation === "vertical"
      ? `${strokeWidth}px ${style.dashLength + style.gap}px`
      : `${style.dashLength + style.gap}px ${strokeWidth}px`
    : undefined
  const position = Math.round(guide.position)
  const strokeOffset = GUIDE_HITBOX_SIZE / 2 - Math.floor((strokeWidth - 1) / 2)

  return (
    <div
      className="msr:absolute"
      data-mesurer-guide="true"
      style={
        guide.orientation === "vertical"
          ? {
              left: position - GUIDE_HITBOX_SIZE / 2,
              top: 0,
              width: GUIDE_HITBOX_SIZE,
              height: "100%",
              pointerEvents: pointerEvents ? "auto" : "none",
            }
          : {
              top: position - GUIDE_HITBOX_SIZE / 2,
              left: 0,
              height: GUIDE_HITBOX_SIZE,
              width: "100%",
              pointerEvents: pointerEvents ? "auto" : "none",
            }
      }
      onPointerDown={(event) => onPointerDown(guide, event)}
      onPointerUp={(event) => onPointerUp(guide, event)}
      onPointerCancel={(event) => onPointerCancel(guide, event)}
    >
      <div
        className="msr:absolute"
        style={
          guide.orientation === "vertical"
            ? {
                left: strokeOffset,
                top: 0,
                width: strokeWidth,
                height: "100%",
                backgroundColor: isSolid ? strokeColor : "transparent",
                backgroundImage,
                backgroundSize,
                opacity: style.opacity,
              }
            : {
                top: strokeOffset,
                left: 0,
                height: strokeWidth,
                width: "100%",
                backgroundColor: isSolid ? strokeColor : "transparent",
                backgroundImage,
                backgroundSize,
                opacity: style.opacity,
              }
        }
      />
    </div>
  )
}

type GuidePreviewLineProps = {
  orientation: "vertical" | "horizontal"
  position: number
  color: string
}

export function GuidePreviewLine({
  orientation,
  position,
  color,
}: GuidePreviewLineProps) {
  return (
    <div
      className="msr:pointer-events-none msr:absolute"
      style={
        orientation === "vertical"
          ? {
              left: position - GUIDE_HITBOX_SIZE / 2,
              top: 0,
              width: GUIDE_HITBOX_SIZE,
              height: "100%",
            }
          : {
              top: position - GUIDE_HITBOX_SIZE / 2,
              left: 0,
              height: GUIDE_HITBOX_SIZE,
              width: "100%",
            }
      }
    >
      <div
        className="msr:absolute"
        style={
          orientation === "vertical"
            ? {
                left: GUIDE_HITBOX_SIZE / 2 - 1,
                top: 0,
                width: 2,
                height: "100%",
                backgroundColor: color,
              }
            : {
                top: GUIDE_HITBOX_SIZE / 2 - 1,
                left: 0,
                height: 2,
                width: "100%",
                backgroundColor: color,
              }
        }
      />
    </div>
  )
}
