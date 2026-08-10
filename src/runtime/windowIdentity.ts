import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauriRuntime } from '../shared/platform/runtime'

export function getWindowLabel(): string {
  return isTauriRuntime() ? getCurrentWindow().label : 'web'
}
