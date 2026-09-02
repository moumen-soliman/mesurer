export const MESURER_KEYBOARD_ATTR = "data-mesurer-kb"

export const isEditableElement = (node: EventTarget | null) => {
  if (!(node instanceof Element)) return false
  const element = node as HTMLElement
  const tag = element.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (element.isContentEditable) return true
  const editable = element.getAttribute("contenteditable")
  return editable !== null && editable !== "false"
}

export const getDeepActiveElement = (eventTarget: Window) => {
  let active: Element | null = eventTarget.document.activeElement
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement
  }
  return active
}

export const isInsideMesurer = (node: EventTarget | null) => {
  if (!(node instanceof Node)) return false
  let current: Node | null = node
  while (current) {
    if (current instanceof Element && current.classList.contains("mesurer-root")) {
      return true
    }
    const parent: Node | null = current.parentNode
    current = parent instanceof ShadowRoot ? parent.host : parent
  }
  return false
}

export const isMesurerUiNode = (node: EventTarget | null) => {
  if (isInsideMesurer(node)) return true
  if (!(node instanceof Element)) return false
  return Boolean(node.shadowRoot?.querySelector(".mesurer-root"))
}

export const isMesurerKeyboardEvent = (event: Event, eventTarget: Window) => {
  if (isInsideMesurer(getDeepActiveElement(eventTarget))) return true
  return event.composedPath().some((node) => isMesurerUiNode(node))
}

export const isTypingInMesurer = (event: KeyboardEvent, eventTarget: Window) => {
  const active = getDeepActiveElement(eventTarget)
  if (isEditableElement(active) && isInsideMesurer(active)) return true
  return event.composedPath().some(
    (node) => isEditableElement(node) && isMesurerUiNode(node),
  )
}

export const isOverlayEscapeConsumed = (event: KeyboardEvent) =>
  event.composedPath().some((node) => {
    if (!(node instanceof Element)) return false
    const role = node.getAttribute("role")
    return role === "menu" || role === "listbox"
  })

export const isTypingInPage = (eventTarget: Window) => {
  const active = getDeepActiveElement(eventTarget)
  return isEditableElement(active) && !isInsideMesurer(active)
}

export const isBrowserReservedChord = (event: KeyboardEvent) => {
  const hasMod =
    event.metaKey ||
    event.ctrlKey ||
    event.getModifierState("Meta") ||
    event.getModifierState("Control")
  if (!hasMod) return false
  const key = event.key.toLowerCase()
  return key !== "z" && key !== "a" && key !== ","
}

export const setMesurerKeyboardOwned = (document: Document, owned: boolean) => {
  if (owned) document.documentElement.setAttribute(MESURER_KEYBOARD_ATTR, "1")
  else document.documentElement.removeAttribute(MESURER_KEYBOARD_ATTR)
}

export const blurPageFocus = (eventTarget: Window) => {
  const active = getDeepActiveElement(eventTarget)
  if (!active || isInsideMesurer(active)) return
  if (active instanceof HTMLElement) active.blur()
}
