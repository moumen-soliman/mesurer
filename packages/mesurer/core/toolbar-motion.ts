export const TOOLBAR_MOTION_FALLBACK_MS = 200

export const toolbarMotionMs = (motion: string) => {
  const value = Number.parseFloat(motion)
  if (!Number.isFinite(value)) return TOOLBAR_MOTION_FALLBACK_MS
  const unit = motion.trim().match(/[\d.]+\s*(m?s)/i)?.[1]
  return unit?.toLowerCase() === "s" ? value * 1000 : value
}

export const toolbarMotionTiming = (motion: string) => {
  const duration = toolbarMotionMs(motion)
  const easing = motion.replace(/^[\d.]+\s*m?s\s*/i, "").trim() || "ease"
  return { duration, easing }
}

export const transformScaleX = (value: string) => {
  if (!value || value === "none") return 1
  try {
    return new DOMMatrix(value).a
  } catch {
    return 1
  }
}

export const transformTranslateX = (value: string) => {
  if (!value || value === "none") return 0
  try {
    return new DOMMatrix(value).e
  } catch {
    return 0
  }
}

export const nearlyEqual = (a: number, b: number, epsilon = 0.5) =>
  Math.abs(a - b) < epsilon

export const syncToolbarLayoutWidths = ({
  stage,
  collapseStage,
  inspectPanel,
  annotatePanel,
  expandedPanel,
  iconSlot,
}: {
  stage: HTMLElement
  collapseStage: HTMLElement
  inspectPanel: HTMLElement
  annotatePanel: HTMLElement
  expandedPanel: HTMLElement
  iconSlot: HTMLElement
}) => {
  const inspectWidth = inspectPanel.offsetWidth
  const annotateWidth = annotatePanel.offsetWidth
  if (inspectWidth > 0) stage.style.setProperty("--msr-inspect-w", `${inspectWidth}px`)
  if (annotateWidth > 0) stage.style.setProperty("--msr-annotate-w", `${annotateWidth}px`)
  void stage.offsetWidth
  const expandedWidth = expandedPanel.offsetWidth
  const iconWidth = iconSlot.offsetWidth
  if (expandedWidth > 0) {
    collapseStage.style.setProperty("--msr-expanded-w", `${expandedWidth}px`)
  }
  if (iconWidth > 0) {
    collapseStage.style.setProperty("--msr-icon-w", `${iconWidth}px`)
  }
  void collapseStage.offsetWidth
}
