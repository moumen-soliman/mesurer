import { useLayoutEffect, type RefObject } from "react"
import { installKeyboardGate } from "../core/keyboard-gate"
import {
  blurPageFocus,
  getDeepActiveElement,
  isEditableElement,
  isInsideMesurer,
  isMesurerKeyboardEvent,
  setMesurerKeyboardOwned,
} from "../core/keyboard-ownership"

const isTypingInPageField = (eventTarget: Window) => {
  const active = getDeepActiveElement(eventTarget)
  return isEditableElement(active) && !isInsideMesurer(active)
}

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
    const overlay = overlayRef.current
    const typingInPage = isTypingInPageField(eventTarget)
    const owned = overlayActive && !typingInPage
    setMesurerKeyboardOwned(eventTarget.document, owned)
    if (owned && overlay && !isInsideMesurer(getDeepActiveElement(eventTarget))) {
      blurPageFocus(eventTarget)
      overlay.focus({ preventScroll: true })
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!overlayActive) return
      const active = getDeepActiveElement(eventTarget)
      if (isEditableElement(active) && !isInsideMesurer(active)) {
        if (!event.isTrusted) {
          setMesurerKeyboardOwned(eventTarget.document, true)
          const root = overlayRef.current
          if (!root) return
          blurPageFocus(eventTarget)
          root.focus({ preventScroll: true })
          return
        }
        setMesurerKeyboardOwned(eventTarget.document, false)
        return
      }
      if (isInsideMesurer(active)) {
        setMesurerKeyboardOwned(eventTarget.document, true)
        return
      }
      if (isMesurerKeyboardEvent(event, eventTarget)) return
      const root = overlayRef.current
      if (!root) return
      setMesurerKeyboardOwned(eventTarget.document, true)
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
