import { isMacPlatform } from '../../../shared/platform/runtime'

export type ShortcutActionId =
  | 'new_file'
  | 'open_file'
  | 'open_folder'
  | 'save'
  | 'save_as'
  | 'close_tab'
  | 'toggle_sidebar'
  | 'quick_open'
  | 'undo'
  | 'redo'
  | 'find'
  | 'toggle_editor_mode'
  | 'open_settings'

export interface ShortcutDefinition {
  id: ShortcutActionId
  label: string
  description: string
  category: 'File' | 'Edit' | 'View'
  defaultBinding: string
}

export const shortcutDefinitions: ShortcutDefinition[] = [
  {
    id: 'new_file',
    label: 'New file',
    description: 'Create a new untitled tab.',
    category: 'File',
    defaultBinding: 'Mod+N',
  },
  {
    id: 'open_file',
    label: 'Open file',
    description: 'Open a markdown file picker.',
    category: 'File',
    defaultBinding: 'Mod+O',
  },
  {
    id: 'open_folder',
    label: 'Open folder',
    description: 'Select a workspace folder.',
    category: 'File',
    defaultBinding: 'Mod+Shift+O',
  },
  {
    id: 'save',
    label: 'Save',
    description: 'Save the active file.',
    category: 'File',
    defaultBinding: 'Mod+S',
  },
  {
    id: 'save_as',
    label: 'Save as',
    description: 'Save the active file to a new path.',
    category: 'File',
    defaultBinding: 'Mod+Shift+S',
  },
  {
    id: 'close_tab',
    label: 'Close tab',
    description: 'Close the active editor tab.',
    category: 'File',
    defaultBinding: 'Mod+W',
  },
  {
    id: 'undo',
    label: 'Undo',
    description: 'Undo the last editor change.',
    category: 'Edit',
    defaultBinding: 'Mod+Z',
  },
  {
    id: 'redo',
    label: 'Redo',
    description: 'Redo the last undone editor change.',
    category: 'Edit',
    defaultBinding: 'Mod+Shift+Z',
  },
  {
    id: 'find',
    label: 'Find',
    description: 'Open find inside the active editor.',
    category: 'Edit',
    defaultBinding: 'Mod+F',
  },
  {
    id: 'toggle_sidebar',
    label: 'Toggle sidebar',
    description: 'Show or hide the workspace sidebar.',
    category: 'View',
    defaultBinding: 'Mod+\\',
  },
  {
    id: 'quick_open',
    label: 'Quick open',
    description: 'Search and open files from the workspace.',
    category: 'View',
    defaultBinding: 'Mod+P',
  },
  {
    id: 'toggle_editor_mode',
    label: 'Toggle editor mode',
    description: 'Switch between source and rendered modes.',
    category: 'View',
    defaultBinding: 'Mod+E',
  },
  {
    id: 'open_settings',
    label: 'Open settings',
    description: 'Open the settings dialog.',
    category: 'View',
    defaultBinding: 'Mod+,',
  },
]

export type ShortcutMap = Record<ShortcutActionId, string>

export const shortcutActionIds: ShortcutActionId[] = shortcutDefinitions.map(definition => definition.id)

const shortcutActionSet = new Set<ShortcutActionId>(shortcutActionIds)

const specialKeyAliases: Record<string, string> = {
  comma: ',',
  period: '.',
  slash: '/',
  backslash: '\\',
  esc: 'Escape',
  escape: 'Escape',
  return: 'Enter',
  enter: 'Enter',
  tab: 'Tab',
  space: 'Space',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
}

function normaliseKeyToken(token: string): string | null {
  const trimmed = token.trim()
  if (!trimmed) return null

  const alias = specialKeyAliases[trimmed.toLowerCase()]
  if (alias) return alias

  if (trimmed.length === 1) {
    return /^[a-z]$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed
  }

  if (/^f\d{1,2}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  if (/^[a-z0-9]+$/i.test(trimmed)) {
    return trimmed[0].toUpperCase() + trimmed.slice(1)
  }

  return null
}

function keyFromEvent(eventKey: string): string | null {
  if (eventKey === 'Shift' || eventKey === 'Meta' || eventKey === 'Control' || eventKey === 'Alt') {
    return null
  }

  if (eventKey === ' ') {
    return 'Space'
  }

  return normaliseKeyToken(eventKey)
}

export function isShortcutAction(value: string): value is ShortcutActionId {
  return shortcutActionSet.has(value as ShortcutActionId)
}

export function getDefaultShortcutMap(): ShortcutMap {
  return shortcutDefinitions.reduce<ShortcutMap>((result, definition) => {
    result[definition.id] = definition.defaultBinding
    return result
  }, {} as ShortcutMap)
}

export function normaliseShortcutBinding(binding: string): string | null {
  if (!binding.trim()) {
    return ''
  }

  const tokens = binding
    .split('+')
    .map(token => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) return ''

  let hasMod = false
  let hasAlt = false
  let hasShift = false
  let key: string | null = null

  for (const token of tokens) {
    const lowered = token.toLowerCase()

    if (
      lowered === 'mod' ||
      lowered === 'cmdorctrl' ||
      lowered === 'ctrlormeta' ||
      lowered === 'ctrl' ||
      lowered === 'control' ||
      lowered === 'cmd' ||
      lowered === 'command' ||
      lowered === 'meta'
    ) {
      hasMod = true
      continue
    }

    if (lowered === 'alt' || lowered === 'option') {
      hasAlt = true
      continue
    }

    if (lowered === 'shift') {
      hasShift = true
      continue
    }

    const normalisedKey = normaliseKeyToken(token)
    if (!normalisedKey || key) {
      return null
    }

    key = normalisedKey
  }

  if (!key) {
    return null
  }

  const parts: string[] = []
  if (hasMod) parts.push('Mod')
  if (hasAlt) parts.push('Alt')
  if (hasShift) parts.push('Shift')
  parts.push(key)

  return parts.join('+')
}

export function shortcutHasPrimaryModifier(binding: string): boolean {
  const normalised = normaliseShortcutBinding(binding)
  if (normalised === null || normalised === '') return false

  return normalised.includes('Mod+') || normalised.includes('Alt+')
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  const key = keyFromEvent(event.key)
  if (!key) return null

  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push('Mod')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(key)

  return parts.join('+')
}

export function resolveShortcutAction(event: KeyboardEvent, shortcuts: ShortcutMap): ShortcutActionId | null {
  const eventShortcut = shortcutFromKeyboardEvent(event)
  if (!eventShortcut) return null

  for (const actionId of shortcutActionIds) {
    const configured = normaliseShortcutBinding(shortcuts[actionId])
    if (configured && configured === eventShortcut) {
      return actionId
    }
  }

  return null
}

export function formatShortcutForDisplay(binding: string, isMac = isMacPlatform()): string {
  const normalised = normaliseShortcutBinding(binding)
  if (normalised === null || normalised === '') {
    return 'Unassigned'
  }

  const tokens = normalised.split('+')
  const key = tokens[tokens.length - 1]

  const macTokens: string[] = []
  const pcTokens: string[] = []

  if (tokens.includes('Mod')) {
    macTokens.push('⌘')
    pcTokens.push('Ctrl')
  }

  if (tokens.includes('Alt')) {
    macTokens.push('⌥')
    pcTokens.push('Alt')
  }

  if (tokens.includes('Shift')) {
    macTokens.push('⇧')
    pcTokens.push('Shift')
  }

  const displayKey = key === 'Space' ? 'Space' : key

  if (isMac) {
    return `${macTokens.join('')}${displayKey}`
  }

  return [...pcTokens, displayKey].join('+')
}
