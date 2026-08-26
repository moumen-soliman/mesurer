import { useEffect, useRef } from "react"
import { syncXrayStyles } from "../runtime/xray-styles"

export const useXray = (ownerDocument: Document, visible: boolean) => {
  const appliedRef = useRef<{ doc: Document; visible: boolean } | null>(null)
  if (
    appliedRef.current?.doc !== ownerDocument ||
    appliedRef.current?.visible !== visible
  ) {
    if (appliedRef.current && appliedRef.current.doc !== ownerDocument) {
      appliedRef.current.doc.body.classList.remove("xray-mode")
    }
    syncXrayStyles(ownerDocument, visible)
    appliedRef.current = { doc: ownerDocument, visible }
  }

  const documentRef = useRef(ownerDocument)
  documentRef.current = ownerDocument

  useEffect(() => {
    return () => {
      documentRef.current.body.classList.remove("xray-mode")
    }
  }, [])
}
