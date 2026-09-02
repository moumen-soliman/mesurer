import {
  getDeepActiveElement,
  isBrowserReservedChord,
  isInsideMesurer,
  isMesurerKeyboardEvent,
  isMesurerUiNode,
  MESURER_KEYBOARD_ATTR,
} from "./keyboard-ownership"

const INSTALLED = "__MESURER_KEYBOARD_GATE__"

type GateWindow = Window & { [INSTALLED]?: boolean }

const ownsKeyboard = (view: Window) =>
  view.document.documentElement.hasAttribute(MESURER_KEYBOARD_ATTR)

const installValueGuard = (view: Window, proto: object) => {
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value")
  if (!descriptor?.get || !descriptor.set) return
  Object.defineProperty(proto, "value", {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() {
      return descriptor.get!.call(this)
    },
    set(value: string) {
      if (ownsKeyboard(view) && !isMesurerUiNode(this)) return
      descriptor.set!.call(this, value)
    },
  })
}

export const installKeyboardGate = (view: Window = window) => {
  const gated = view as GateWindow
  if (gated[INSTALLED]) return
  gated[INSTALLED] = true

  const nativeFocus = HTMLElement.prototype.focus
  HTMLElement.prototype.focus = function (
    this: HTMLElement,
    ...args: Parameters<typeof nativeFocus>
  ) {
    if (ownsKeyboard(view) && !isMesurerUiNode(this)) return
    return nativeFocus.apply(this, args)
  }

  installValueGuard(view, HTMLInputElement.prototype)
  installValueGuard(view, HTMLTextAreaElement.prototype)

  const nativeExecCommand = view.document.execCommand.bind(view.document)
  view.document.execCommand = (commandId, showUI, value) => {
    if (
      ownsKeyboard(view) &&
      commandId.toLowerCase() === "inserttext" &&
      !isInsideMesurer(getDeepActiveElement(view))
    ) {
      return false
    }
    return nativeExecCommand(commandId, showUI, value)
  }

  const blockPageKey = (event: Event) => {
    if (!ownsKeyboard(view) || isMesurerKeyboardEvent(event, view)) return
    if (event instanceof KeyboardEvent && isBrowserReservedChord(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  for (const type of ["keydown", "keypress", "keyup", "beforeinput"]) {
    view.addEventListener(type, blockPageKey, true)
  }
}
