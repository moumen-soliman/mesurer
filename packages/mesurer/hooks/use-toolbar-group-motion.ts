import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import {
  nearlyEqual,
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
  duration: number
}

type Nodes = {
  chrome: HTMLElement
  track: HTMLElement
  trailing: HTMLElement
}

const MIN_INTERRUPT_MS = 64

const readNodes = (
  motion: HTMLElement,
  stage: HTMLElement,
  trailing: HTMLElement,
): Nodes | null => {
  const chrome = motion.querySelector(".mesurer-toolbar-chrome")
  const track = stage.querySelector(".mesurer-toolbar-tool-track")
  if (!(chrome instanceof HTMLElement) || !(track instanceof HTMLElement)) {
    return null
  }
  return { chrome, track, trailing }
}

const clearMotionStyles = (motion: HTMLElement, nodes: Nodes) => {
  delete motion.dataset.resizing
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

const applyPose = (nodes: Nodes, pose: Pick<Pose, "scaleX" | "trailX" | "trackX">) => {
  nodes.chrome.style.transform = `scaleX(${pose.scaleX})`
  nodes.trailing.style.transform = `translateX(${pose.trailX}px)`
  nodes.track.style.transform = `translateX(${pose.trackX}px)`
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
  return {
    scaleX: nextWidth > 0 ? (play.layoutWidth * scaleX) / nextWidth : 1,
    trailX: trailX + (play.layoutWidth - nextWidth),
    trackX,
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
  motionRef,
  stageRef,
  trailingRef,
}: {
  eventTarget: Window
  toolGroup: ToolGroup
  motionRef: RefObject<HTMLDivElement | null>
  stageRef: RefObject<HTMLDivElement | null>
  trailingRef: RefObject<HTMLDivElement | null>
}) => {
  const readyRef = useRef(false)
  const barWidthRef = useRef(0)
  const groupRef = useRef(toolGroup)
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
    if (!motion || !stage || !trailing) return
    const nodes = readNodes(motion, stage, trailing)
    if (!nodes) return

    const toWidth = motion.offsetWidth
    const inspectWidth =
      parseFloat(stage.style.getPropertyValue("--msr-inspect-w")) || 0
    const toTrack = toolGroup === "annotate" ? -inspectWidth : 0
    const interrupt = interruptRef.current
    interruptRef.current = null

    const fromWidth = barWidthRef.current
    const fromGroup = groupRef.current
    const fromScale = interrupt
      ? interrupt.scaleX
      : fromWidth > 0 && toWidth > 0
        ? fromWidth / toWidth
        : 1
    const fromTrail = interrupt ? interrupt.trailX : fromWidth - toWidth
    const fromTrack = interrupt
      ? interrupt.trackX
      : fromGroup === "annotate"
        ? -inspectWidth
        : 0
    const timing = toolbarMotionTiming(
      getComputedStyle(motion).getPropertyValue("--msr-toolbar-motion").trim() ||
        `${TOOLBAR_MOTION_FALLBACK_MS}ms ease`,
    )
    const duration = interrupt ? interrupt.duration : timing.duration
    const atRest =
      nearlyEqual(fromScale, 1, 0.002) &&
      nearlyEqual(fromTrail, 0) &&
      nearlyEqual(fromTrack, toTrack)

    const settle = () => {
      barWidthRef.current = toWidth
      groupRef.current = toolGroup
    }
    const stop = () => {
      cancelPlayback(playRef.current)
      playRef.current = null
    }
    const rest = () => {
      stop()
      clearMotionStyles(motion, nodes)
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
    applyPose(nodes, { scaleX: fromScale, trailX: fromTrail, trackX: fromTrack })
    void motion.offsetWidth

    const animations = [
      animateTransform(nodes.chrome, `scaleX(${fromScale})`, "scaleX(1)", duration, timing.easing),
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
    ]
    playRef.current = { layoutWidth: toWidth, duration, animations }

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      applyPose(nodes, { scaleX: 1, trailX: 0, trackX: toTrack })
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
        clearMotionStyles(motion, nodes)
        return
      }
      const pose = captureInterrupt(motion, nodes, play)
      stop()
      interruptRef.current = pose
      applyPose(nodes, pose)
    }
  }, [eventTarget, motionRef, stageRef, toolGroup, trailingRef])

  return { markReady }
}
