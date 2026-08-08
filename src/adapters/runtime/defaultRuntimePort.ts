import type { RuntimePort } from '../../core/contracts'
import { isTauriRuntime } from '../../shared/platform/runtime'
import { tauriRuntimePort } from '../tauri/runtimePort'
import { webRuntimePort } from '../web/runtimePort'

export const defaultRuntimePort: RuntimePort = isTauriRuntime() ? tauriRuntimePort : webRuntimePort
