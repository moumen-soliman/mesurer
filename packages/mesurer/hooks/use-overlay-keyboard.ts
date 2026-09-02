import { useLayoutEffect, type RefObject } from "react"
import { installKeyboardGate } from "../core/keyboard-gate"
import {
  blurPageFocus,
  getDeepActiveElement,
  isInsideMesurer,
  isMesurerKeyboardEvent,
  setMesurerKeyboardOwned,
} from "../core/keyboard-ownership"

export const useOverlayKeyboard = ({
  eventTarget,
  overlayRef,
  overlayActive,
}: {
  eventTarget: Window
  overlayRef: RefObject<HTMLElement | null>
  overlayActive: boolean
}) => {
  useLayoutEffect(() => {
    installKeyboardGate(eventTarget)
    setMesurerKeyboardOwned(eventTarget.document, overlayActive)
    const overlay = overlayRef.current
    if (overlayActive && overlay && !isInsideMesurer(getDeepActiveElement(eventTarget))) {
      blurPageFocus(eventTarget)
      overlay.focus({ preventScroll: true })
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!overlayActive) return
      if (isInsideMesurer(getDeepActiveElement(eventTarget))) return
      if (isMesurerKeyboardEvent(event, eventTarget)) return
      const root = overlayRef.current
      if (!root) return
      blurPageFocus(eventTarget)
      root.focus({ preventScroll: true })
    }
    eventTarget.document.addEventListener("focusin", onFocusIn, true)
    return () => {
      setMesurerKeyboardOwned(eventTarget.document, false)
      eventTarget.document.removeEventListener("focusin", onFocusIn, true)
    }
  }, [eventTarget, overlayActive, overlayRef])
}
