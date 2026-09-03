import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import {
  nearlyEqual,
  syncToolbarLayoutWidths,
  TOOLBAR_MOTION_FALLBACK_MS,
  toolbarMotionTiming,
  transformScaleX,
  transformTranslateX,
} from "../core/toolbar-motion"

type ToolGroup = "inspect" | "annotate"

type Playback = {
  layoutWidth: number
  duration: number
  animations: Animation[]
}

type Pose = {
  scaleX: number
  trailX: number
  trackX: number
  collapseX: number
  duration: number
}

type Nodes = {
  chrome: HTMLElement
  track: HTMLElement
  trailing: HTMLElement
  collapse: HTMLElement
}

const MIN_INTERRUPT_MS = 64

const readNodes = (
  motion: HTMLElement,
  stage: HTMLElement,
  trailing: HTMLElement,
  collapseStage: HTMLElement,
): Nodes | null => {
  const chrome = motion.querySelector(".mesurer-toolbar-chrome")
  const track = stage.querySelector(".mesurer-toolbar-tool-track")
  const collapse = collapseStage.querySelector(".mesurer-toolbar-minimize-track")
  if (
    !(chrome instanceof HTMLElement) ||
    !(track instanceof HTMLElement) ||
    !(collapse instanceof HTMLElement)
  ) {
    return null
  }
  return { chrome, track, trailing, collapse }
}

const clearMotionStyles = (motion: HTMLElement, nodes: Nodes, collapseStage: HTMLElement) => {
  delete motion.dataset.resizing
  collapseStage.style.width = ""
  for (const node of Object.values(nodes)) {
    node.style.transition = ""
    node.style.transform = ""
    node.style.willChange = ""
  }
}

const cancelPlayback = (play: Playback | null) => {
  if (!play) return
  for (const animation of play.animations) animation.cancel()
}

const applyPose = (
  nodes: Nodes,
  pose: Pick<Pose, "scaleX" | "trailX" | "trackX" | "collapseX">,
) => {
  nodes.chrome.style.transform = `scaleX(${pose.scaleX})`
  nodes.trailing.style.transform = `translateX(${pose.trailX}px)`
  nodes.track.style.transform = `translateX(${pose.trackX}px)`
  nodes.collapse.style.transform = `translateX(${pose.collapseX}px)`
}

const captureInterrupt = (motion: HTMLElement, nodes: Nodes, play: Playback): Pose => {
  const view = motion.ownerDocument.defaultView
  const computed = view?.getComputedStyle.bind(view) ?? getComputedStyle
  const elapsed = Number(play.animations[0]?.currentTime)
  const remaining = Number.isFinite(elapsed)
    ? Math.max(MIN_INTERRUPT_MS, play.duration - elapsed)
    : Math.max(MIN_INTERRUPT_MS, play.duration)
  const nextWidth = motion.offsetWidth
  const scaleX = transformScaleX(computed(nodes.chrome).transform)
  const trailX = transformTranslateX(computed(nodes.trailing).transform)
  const trackX = transformTranslateX(computed(nodes.track).transform)
  const collapseX = transformTranslateX(computed(nodes.collapse).transform)
  return {
    scaleX: nextWidth > 0 ? (play.layoutWidth * scaleX) / nextWidth : 1,
    trailX: trailX + (play.layoutWidth - nextWidth),
    trackX,
    collapseX,
    duration: remaining,
  }
}

const animateTransform = (
  node: HTMLElement,
  from: string,
  to: string,
  duration: number,
  easing: string,
) =>
  node.animate([{ transform: from }, { transform: to }], {
    duration,
    easing,
    fill: "forwards",
  })

export const useToolbarGroupMotion = ({
  eventTarget,
  toolGroup,
  minimized,
  motionRef,
  stageRef,
  trailingRef,
  collapseRef,
  inspectPanelRef,
  annotatePanelRef,
  expandedPanelRef,
  iconSlotRef,
}: {
  eventTarget: Window
  toolGroup: ToolGroup
  minimized: boolean
  motionRef: RefObject<HTMLDivElement | null>
  stageRef: RefObject<HTMLDivElement | null>
  trailingRef: RefObject<HTMLDivElement | null>
  collapseRef: RefObject<HTMLDivElement | null>
  inspectPanelRef: RefObject<HTMLDivElement | null>
  annotatePanelRef: RefObject<HTMLDivElement | null>
  expandedPanelRef: RefObject<HTMLDivElement | null>
  iconSlotRef: RefObject<HTMLButtonElement | null>
}) => {
  const readyRef = useRef(false)
  const barWidthRef = useRef(0)
  const groupRef = useRef(toolGroup)
  const minimizedRef = useRef(minimized)
  const playRef = useRef<Playback | null>(null)
  const interruptRef = useRef<Pose | null>(null)

  const markReady = useCallback(() => {
    readyRef.current = true
    const motion = motionRef.current
    if (!motion) return
    motion.dataset.ready = "true"
    barWidthRef.current = motion.offsetWidth
  }, [motionRef])

  useLayoutEffect(() => {
    const motion = motionRef.current
    const stage = stageRef.current
    const trailing = trailingRef.current
    const collapseStage = collapseRef.current
    if (!motion || !stage || !trailing || !collapseStage) return
    const nodes = readNodes(motion, stage, trailing, collapseStage)
    if (!nodes) return

    const inspectPanel = inspectPanelRef.current
    const annotatePanel = annotatePanelRef.current
    const expandedPanel = expandedPanelRef.current
    const iconSlot = iconSlotRef.current
    if (
      !inspectPanel ||
      !annotatePanel ||
      !expandedPanel ||
      !iconSlot
    ) {
      return
    }

    syncToolbarLayoutWidths({
      stage,
      collapseStage,
      inspectPanel,
      annotatePanel,
      expandedPanel,
      iconSlot,
    })

    const fromMinimized = minimizedRef.current
    const closing = !fromMinimized && minimized
    const expandedWidth =
      parseFloat(collapseStage.style.getPropertyValue("--msr-expanded-w")) || 0
    const iconWidth =
      parseFloat(collapseStage.style.getPropertyValue("--msr-icon-w")) || 0
    if (closing && expandedWidth > 0) {
      collapseStage.style.width = `${expandedWidth}px`
      void collapseStage.offsetWidth
    } else {
      collapseStage.style.width = ""
    }

    const toWidth = motion.offsetWidth
    const inspectWidth =
      parseFloat(stage.style.getPropertyValue("--msr-inspect-w")) || 0
    const toTrack = toolGroup === "annotate" ? -inspectWidth : 0
    const toCollapse = minimized ? -expandedWidth : 0
    const interrupt = interruptRef.current
    interruptRef.current = null

    const fromWidth = barWidthRef.current
    const fromGroup = groupRef.current
    const padding = Math.max(0, toWidth - collapseStage.offsetWidth)
    const closeScale =
      closing && toWidth > 0 && iconWidth > 0 ? (iconWidth + padding) / toWidth : 1
    const fromScale = interrupt
      ? interrupt.scaleX
      : closing
        ? 1
        : fromWidth > 0 && toWidth > 0
          ? fromWidth / toWidth
          : 1
    const toScale = closing ? closeScale : 1
    const fromTrail = interrupt
      ? interrupt.trailX
      : closing
        ? 0
        : fromWidth - toWidth
    const fromTrack = interrupt
      ? interrupt.trackX
      : fromGroup === "annotate"
        ? -inspectWidth
        : 0
    const fromCollapse = interrupt
      ? interrupt.collapseX
      : fromMinimized
        ? -expandedWidth
        : 0
    const timing = toolbarMotionTiming(
      getComputedStyle(motion).getPropertyValue("--msr-toolbar-motion").trim() ||
        `${TOOLBAR_MOTION_FALLBACK_MS}ms ease`,
    )
    const duration = interrupt ? interrupt.duration : timing.duration
    const atRest =
      nearlyEqual(fromScale, toScale, 0.002) &&
      nearlyEqual(fromTrail, 0) &&
      nearlyEqual(fromTrack, toTrack) &&
      nearlyEqual(fromCollapse, toCollapse)

    const settle = () => {
      barWidthRef.current = motion.offsetWidth
      groupRef.current = toolGroup
      minimizedRef.current = minimized
    }
    const stop = () => {
      cancelPlayback(playRef.current)
      playRef.current = null
    }
    const rest = () => {
      stop()
      clearMotionStyles(motion, nodes, collapseStage)
      settle()
    }

    const skipMotion =
      !readyRef.current ||
      eventTarget.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      toWidth < 1 ||
      (!interrupt && fromWidth < 1) ||
      atRest
    if (skipMotion) {
      rest()
      return
    }

    stop()
    motion.dataset.resizing = "true"
    for (const node of Object.values(nodes)) {
      node.style.transition = "none"
      node.style.willChange = "transform"
    }
    applyPose(nodes, {
      scaleX: fromScale,
      trailX: fromTrail,
      trackX: fromTrack,
      collapseX: fromCollapse,
    })
    void motion.offsetWidth

    const animations = [
      animateTransform(
        nodes.chrome,
        `scaleX(${fromScale})`,
        `scaleX(${toScale})`,
        duration,
        timing.easing,
      ),
      animateTransform(
        nodes.trailing,
        `translateX(${fromTrail}px)`,
        "translateX(0px)",
        duration,
        timing.easing,
      ),
      animateTransform(
        nodes.track,
        `translateX(${fromTrack}px)`,
        `translateX(${toTrack}px)`,
        duration,
        timing.easing,
      ),
      animateTransform(
        nodes.collapse,
        `translateX(${fromCollapse}px)`,
        `translateX(${toCollapse}px)`,
        duration,
        timing.easing,
      ),
    ]
    playRef.current = { layoutWidth: toWidth, duration, animations }

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      applyPose(nodes, {
        scaleX: toScale,
        trailX: 0,
        trackX: toTrack,
        collapseX: toCollapse,
      })
      rest()
    }
    for (const animation of animations) {
      void animation.finished.then(finish, () => undefined)
    }
    const timeout = eventTarget.setTimeout(finish, duration + 32)
    return () => {
      eventTarget.clearTimeout(timeout)
      if (finished) return
      const play = playRef.current
      if (!motion.isConnected) {
        finish()
        return
      }
      if (!play) {
        clearMotionStyles(motion, nodes, collapseStage)
        return
      }
      const pose = captureInterrupt(motion, nodes, play)
      stop()
      interruptRef.current = pose
      applyPose(nodes, pose)
    }
  }, [
    annotatePanelRef,
    collapseRef,
    eventTarget,
    expandedPanelRef,
    iconSlotRef,
    inspectPanelRef,
    minimized,
    motionRef,
    stageRef,
    toolGroup,
    trailingRef,
  ])

  return { markReady }
}
