import { useEffect } from "react"
import { syncXrayStyles } from "../runtime/xray-styles"

export const useXray = (ownerDocument: Document, visible: boolean) => {
  useEffect(() => {
    syncXrayStyles(ownerDocument, visible)
    return () => {
      ownerDocument.body.classList.remove("xray-mode")
    }
  }, [ownerDocument, visible])
}
