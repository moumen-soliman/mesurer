type ChromeRuntime = {
  id?: string
  getManifest?: () => { update_url?: string }
}

const getChromeRuntime = (): ChromeRuntime | undefined => {
  try {
    return (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
  } catch {
    return undefined
  }
}

const isStoreExtension = (runtime: ChromeRuntime) => {
  try {
    return Boolean(runtime.getManifest?.().update_url)
  } catch {
    return false
  }
}

const isDevRuntime = () => {
  try {
    const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
    if (env?.DEV) return true
  } catch {
    // Bundlers without import.meta.env fall through.
  }
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } })
    .process?.env?.NODE_ENV
  return nodeEnv === "development"
}

export const getReleaseChannel = (): "dev" | "build" | null => {
  const runtime = getChromeRuntime()
  if (runtime?.id) return isStoreExtension(runtime) ? null : "build"
  return isDevRuntime() ? "dev" : null
}
