import { useSyncExternalStore } from "react"

const subscribeHydration = () => () => {}

export const useHydrated = () =>
  useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  )
