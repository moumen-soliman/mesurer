import { useEffect, useRef } from "react"
import type {
  MesurerPersistence,
  MesurerPersistenceSnapshot,
} from "../core/persistence"

type PersistenceLifecycleOptions = {
  ownerWindow: Window
  activePersistence: MesurerPersistence
  persistSettings: () => void
  persistState: () => void
  settingsPersistOnReload: boolean
  saveWorkspace: () => void
  applyPersistenceSnapshot: (snapshot: MesurerPersistenceSnapshot | null) => void
  storedState: MesurerPersistenceSnapshot | null | undefined
  applyingExternalPersistenceRef: { current: boolean }
  workspacePersistTimeoutRef: { current: number | null }
}

export const usePersistenceLifecycle = ({
  ownerWindow,
  activePersistence,
  persistSettings,
  persistState,
  settingsPersistOnReload,
  saveWorkspace,
  applyPersistenceSnapshot,
  storedState,
  applyingExternalPersistenceRef,
  workspacePersistTimeoutRef,
}: PersistenceLifecycleOptions) => {

  useEffect(() => {
    return () => activePersistence.setErrorHandler?.(undefined)
  }, [activePersistence])

  useEffect(() => {
    if (applyingExternalPersistenceRef.current) {
      applyingExternalPersistenceRef.current = false
      return
    }
    persistSettings()
    if (settingsPersistOnReload) persistState()
  }, [
    applyingExternalPersistenceRef,
    persistSettings,
    persistState,
    settingsPersistOnReload,
  ])

  useEffect(() => {
    if (!settingsPersistOnReload) return
    const handleBeforeUnload = () => saveWorkspace()
    ownerWindow.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      ownerWindow.removeEventListener("beforeunload", handleBeforeUnload)
      if (workspacePersistTimeoutRef.current !== null) {
        ownerWindow.clearTimeout(workspacePersistTimeoutRef.current)
        workspacePersistTimeoutRef.current = null
        saveWorkspace()
      }
    }
  }, [ownerWindow, saveWorkspace, settingsPersistOnReload])

  const previousPersistenceRef = useRef(activePersistence)
  useEffect(() => {
    if (previousPersistenceRef.current === activePersistence) return
    previousPersistenceRef.current = activePersistence
    applyPersistenceSnapshot(storedState ?? null)
  }, [activePersistence, applyPersistenceSnapshot, storedState])

  useEffect(() => {
    const unsubscribe = activePersistence.subscribe?.(applyPersistenceSnapshot)
    return unsubscribe
  }, [activePersistence, applyPersistenceSnapshot])
}
