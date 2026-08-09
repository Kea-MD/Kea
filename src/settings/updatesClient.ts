import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { useEffect, useState } from 'react'
import packageJson from '../../package.json'
import { isTauriRuntime } from '../shared/platform/runtime'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'unavailable'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  availableVersion?: string
  notes?: string
  progress?: number
  message?: string
}

export interface UpdatesClient {
  getState: () => Promise<UpdateState>
  check: () => Promise<UpdateState>
  install: () => Promise<UpdateState>
  subscribe: (listener: (state: UpdateState) => void) => () => void
}

export interface UpdatesSettingsController {
  state: UpdateState
  check: () => Promise<void>
  install: () => Promise<void>
}

const currentVersion = packageJson.version
let state: UpdateState = { status: 'idle', currentVersion }
let activeUpdate: Update | null = null
let operation: Promise<UpdateState> | null = null
const listeners = new Set<(next: UpdateState) => void>()

function publish(next: Omit<UpdateState, 'currentVersion'> & { currentVersion?: string }): UpdateState {
  state = { currentVersion, ...next }
  listeners.forEach(listener => listener(state))
  return state
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function unavailableState(): UpdateState {
  return publish({
    status: 'unavailable',
    message: 'Update checks are only available in the installed Kea app.',
  })
}

async function checkForUpdates(): Promise<UpdateState> {
  if (!isTauriRuntime() || import.meta.env.DEV) return unavailableState()

  publish({ status: 'checking' })
  try {
    const next = await check()
    if (activeUpdate) await activeUpdate.close().catch(() => undefined)
    activeUpdate = next
    if (!next) return publish({ status: 'current' })

    return publish({
      status: 'available',
      availableVersion: next.version,
      notes: next.body,
    })
  } catch (error) {
    return publish({ status: 'error', message: errorMessage(error, 'Unable to check for updates.') })
  }
}

async function installUpdate(): Promise<UpdateState> {
  if (!isTauriRuntime() || import.meta.env.DEV) return unavailableState()
  if (!activeUpdate) {
    return publish({ status: 'error', message: 'Check for updates before installing an update.' })
  }

  const update = activeUpdate
  let downloadedBytes = 0
  let contentLength: number | undefined
  publish({
    status: 'downloading',
    availableVersion: update.version,
    notes: update.body,
    progress: 0,
  })
  try {
    await update.downloadAndInstall(event => {
      if (event.event === 'Started') {
        contentLength = event.data.contentLength
        return
      }
      if (event.event !== 'Progress') return
      downloadedBytes += event.data.chunkLength
      publish({
        status: 'downloading',
        availableVersion: update.version,
        notes: update.body,
        progress: contentLength ? Math.min(100, (downloadedBytes / contentLength) * 100) : undefined,
      })
    })
    publish({
      status: 'installing',
      availableVersion: update.version,
      notes: update.body,
      progress: 100,
    })
    await relaunch()
    return state
  } catch (error) {
    await update.close().catch(() => undefined)
    activeUpdate = null
    return publish({
      status: 'error',
      availableVersion: update.version,
      message: errorMessage(error, 'Unable to install the update.'),
    })
  }
}

async function runOnce(action: () => Promise<UpdateState>): Promise<UpdateState> {
  if (operation) return operation
  operation = action().finally(() => {
    operation = null
  })
  return operation
}

export const updatesClient: UpdatesClient = {
  getState: () => Promise.resolve(state),
  check: () => runOnce(checkForUpdates),
  install: () => runOnce(installUpdate),
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export async function executeUpdateAction(
  client: UpdatesClient,
  action: 'check' | 'install',
  current: UpdateState,
): Promise<UpdateState> {
  try {
    return await client[action]()
  } catch (error) {
    return {
      status: 'error',
      currentVersion: current.currentVersion,
      message: errorMessage(error, `Unable to ${action} updates.`),
    }
  }
}

export function useUpdatesSettingsController(
  client: UpdatesClient = updatesClient,
): UpdatesSettingsController {
  const [currentState, setState] = useState<UpdateState>(state)

  useEffect(() => {
    const unsubscribe = client.subscribe(setState)
    void client.getState().then(setState).catch(error => {
      setState(current => ({
        status: 'error',
        currentVersion: current.currentVersion,
        message: errorMessage(error, 'Unable to load update status.'),
      }))
    })
    return unsubscribe
  }, [client])

  async function run(action: 'check' | 'install'): Promise<void> {
    if (action === 'check') {
      setState(current => ({ status: 'checking', currentVersion: current.currentVersion }))
    }
    setState(await executeUpdateAction(client, action, currentState))
  }

  return {
    state: currentState,
    check: () => run('check'),
    install: () => run('install'),
  }
}

export function scheduleAutoUpdateCheck(client: UpdatesClient = updatesClient): () => void {
  if (!isTauriRuntime() || import.meta.env.DEV) return () => undefined
  let interval: number | undefined
  const run = () => {
    void client.check()
  }
  const timer = window.setTimeout(() => {
    run()
    interval = window.setInterval(run, 6 * 60 * 60 * 1000)
  }, 15_000)
  return () => {
    window.clearTimeout(timer)
    if (interval !== undefined) window.clearInterval(interval)
  }
}
