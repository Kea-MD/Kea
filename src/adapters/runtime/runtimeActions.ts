import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from '../../shared/platform/runtime'

export async function reloadApplication(): Promise<void> {
  try {
    if (isTauriRuntime()) await invoke('reload_window')
    else window.location.reload()
  } catch (error) {
    console.error('Failed to reload application:', error)
  }
}

export async function openDeveloperTools(): Promise<void> {
  if (!isTauriRuntime()) return
  try {
    await invoke('open_devtools')
  } catch (error) {
    console.error('Failed to open developer tools:', error)
  }
}

export async function openNewWindow(): Promise<void> {
  if (!isTauriRuntime()) return
  try {
    await invoke('create_editor_window')
  } catch (error) {
    console.error('Failed to open a new window:', error)
  }
}
