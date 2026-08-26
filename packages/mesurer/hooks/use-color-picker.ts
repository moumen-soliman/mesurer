import { useCallback, useState } from "react"
import {
  formatColor,
  parseCssColor,
  type ColorPickerFormat,
  type ColorSample,
} from "../core/colors"

type EyeDropperResult = { sRGBHex: string }
type EyeDropperLike = { open: () => Promise<EyeDropperResult> }
type WindowWithEyeDropper = Window & {
  EyeDropper?: new () => EyeDropperLike
}

type UseColorPickerOptions = {
  ownerWindow: Window
  clickFormat: ColorPickerFormat
  setEnabled: (enabled: boolean) => void
  setToolModeNone: () => void
}

export const useColorPicker = ({
  ownerWindow,
  clickFormat,
  setEnabled,
  setToolModeNone,
}: UseColorPickerOptions) => {
  const [active, setActive] = useState(false)
  const [sample, setSample] = useState<ColorSample | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  const open = useCallback(async () => {
    const EyeDropper = (ownerWindow as WindowWithEyeDropper).EyeDropper
    setEnabled(true)
    setToolModeNone()
    setActive(true)
    setSample(null)
    setUnsupported(!EyeDropper)
    if (!EyeDropper) return

    try {
      const result = await new EyeDropper().open()
      const nextSample = parseCssColor(result.sRGBHex)
      if (!nextSample) return
      setSample(nextSample)
      const clipboardWrite = ownerWindow.navigator.clipboard?.writeText(
        formatColor(nextSample, clickFormat),
      )
      void clipboardWrite?.catch(() => undefined)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setActive(false)
      }
    }
  }, [clickFormat, ownerWindow, setEnabled, setToolModeNone])

  return {
    active,
    sample,
    unsupported,
    setActive,
    open,
  }
}
