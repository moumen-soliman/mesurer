import { useLayoutEffect } from "react"
import { installKeyboardGate } from "../core/keyboard-gate"
import {
  getDeepActiveElement,
  isInsideMesurer,
  isEditableElement,
  isMesurerUiNode,
  setMesurerKeyboardOwned,
} from "../core/keyboard-ownership"

export const useOverlayKeyboard = ({
  eventTarget,
  overlayActive,
}: {
  eventTarget: Window
  overlayActive: boolean
}) => {
  useLayoutEffect(() => {
    installKeyboardGate(eventTarget)
    const claimedRef = { current: false }
    const owned =
      overlayActive &&
      (claimedRef.current || isInsideMesurer(getDeepActiveElement(eventTarget)))
    setMesurerKeyboardOwned(eventTarget.document, owned)

    const onFocusIn = () => {
      if (!overlayActive) return
      const active = getDeepActiveElement(eventTarget)
      if (isInsideMesurer(active)) {
        claimedRef.current = true
        setMesurerKeyboardOwned(eventTarget.document, true)
        return
      }
      if (active instanceof Element && !isInsideMesurer(active)) {
        claimedRef.current = false
        setMesurerKeyboardOwned(eventTarget.document, false)
        return
      }
      setMesurerKeyboardOwned(eventTarget.document, claimedRef.current)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!overlayActive) return
      const path = event.composedPath()
      const pageEditor = path.some(
        (node) => isEditableElement(node) && !isInsideMesurer(node),
      )
      if (pageEditor) {
        claimedRef.current = false
        setMesurerKeyboardOwned(eventTarget.document, false)
        return
      }
      if (path.some((node) => isMesurerUiNode(node))) {
        claimedRef.current = true
        setMesurerKeyboardOwned(eventTarget.document, true)
        return
      }
      claimedRef.current = false
      setMesurerKeyboardOwned(eventTarget.document, false)
    }
    eventTarget.document.addEventListener("focusin", onFocusIn, true)
    eventTarget.document.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      claimedRef.current = false
      setMesurerKeyboardOwned(eventTarget.document, false)
      eventTarget.document.removeEventListener("focusin", onFocusIn, true)
      eventTarget.document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [eventTarget, overlayActive])
}
