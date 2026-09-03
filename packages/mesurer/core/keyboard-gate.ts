import {
  isBrowserReservedChord,
  isInsideMesurer,
  isMesurerKeyboardBridgeKey,
  isMesurerKeyboardEvent,
  isMesurerUiNode,
  MESURER_KEYBOARD_BRIDGE,
  MESURER_KEYBOARD_ATTR,
} from "./keyboard-ownership"

const INSTALLED = "__MESURER_KEYBOARD_GATE__"

type GateWindow = Window & { [INSTALLED]?: boolean }

const MESURER_EVENT_TYPES = new Set([
  "beforeinput",
  "blur",
  "compositionend",
  "compositionstart",
  "compositionupdate",
  "copy",
  "cut",
  "focus",
  "focusin",
  "focusout",
  "input",
  "keydown",
  "keypress",
  "keyup",
  "paste",
])

const ownsKeyboard = (view: Window) =>
  view.document.documentElement.hasAttribute(MESURER_KEYBOARD_ATTR)

const isMesurerEventPath = (event: Event) =>
  event.composedPath().some((node) => isMesurerUiNode(node))

export const installKeyboardGate = (
  view: Window = window,
  { isolateMesurerEvents = false }: { isolateMesurerEvents?: boolean } = {},
) => {
  const gated = view as GateWindow
  if (gated[INSTALLED]) return
  gated[INSTALLED] = true

  const blockPageKey = (event: Event) => {
    if (
      !ownsKeyboard(view) ||
      isMesurerKeyboardEvent(event, view) ||
      isInsideMesurer(event.target)
    ) {
      return
    }
    if (event instanceof KeyboardEvent) {
      if (isBrowserReservedChord(event)) return
      if (event.type === "keydown" || event.type === "keyup") {
        if (isMesurerKeyboardBridgeKey(event.key, event)) {
          view.postMessage(
            {
              type: MESURER_KEYBOARD_BRIDGE,
              eventType: event.type,
              key: event.key,
              code: event.code,
              location: event.location,
              repeat: event.repeat,
              altKey: event.altKey,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey,
            },
            view.location.origin === "null" ? "*" : view.location.origin,
          )
        }
      }
    }
    event.preventDefault()
    if (isolateMesurerEvents) event.stopImmediatePropagation()
    else event.stopPropagation()
  }

  const blockPageFocus = (event: Event) => {
    if (
      !ownsKeyboard(view) ||
      isMesurerKeyboardEvent(event, view) ||
      isInsideMesurer(event.target)
    ) {
      return
    }
    if (isolateMesurerEvents) event.stopImmediatePropagation()
    else event.stopPropagation()
  }

  for (const type of ["keydown", "keypress", "keyup", "beforeinput"]) {
    view.addEventListener(type, blockPageKey, true)
  }
  for (const type of ["focus", "blur", "focusin", "focusout"]) {
    view.addEventListener(type, blockPageFocus, true)
  }

  if (!isolateMesurerEvents) return

  const nativeAddEventListener = EventTarget.prototype.addEventListener
  const nativeRemoveEventListener = EventTarget.prototype.removeEventListener
  const wrappedListeners = new WeakMap<
    EventListenerOrEventListenerObject,
    Map<string, EventListener>
  >()
  const listenerKey = (
    type: string,
    options?: boolean | EventListenerOptions,
  ) => `${type}:${typeof options === "boolean" ? options : Boolean(options?.capture)}`

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (!listener || !MESURER_EVENT_TYPES.has(type)) {
      return nativeAddEventListener.call(this, type, listener, options)
    }
    const key = listenerKey(type, options)
    let wrappers = wrappedListeners.get(listener)
    if (!wrappers) {
      wrappers = new Map()
      wrappedListeners.set(listener, wrappers)
    }
    let wrapped = wrappers.get(key)
    if (!wrapped) {
      const once = typeof options !== "boolean" && Boolean(options?.once)
      const signal = typeof options !== "boolean" ? options?.signal : undefined
      wrapped = function (this: EventTarget, event: Event) {
        if (ownsKeyboard(view) && isMesurerEventPath(event)) {
          if (once && !signal?.aborted) {
            nativeAddEventListener.call(this, type, wrapped!, options)
          }
          return
        }
        if (typeof listener === "function") listener.call(this, event)
        else listener.handleEvent(event)
      }
      wrappers.set(key, wrapped)
    }
    return nativeAddEventListener.call(this, type, wrapped, options)
  }

  EventTarget.prototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    const wrapped = listener
      ? wrappedListeners.get(listener)?.get(listenerKey(type, options))
      : undefined
    return nativeRemoveEventListener.call(this, type, wrapped ?? listener, options)
  }
}
