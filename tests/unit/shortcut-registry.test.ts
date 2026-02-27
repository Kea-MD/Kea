import { describe, expect, it } from 'vitest'
import {
  formatShortcutForDisplay,
  getDefaultShortcutMap,
  isShortcutAction,
  normaliseShortcutBinding,
  resolveShortcutAction,
  shortcutFromKeyboardEvent,
  shortcutHasPrimaryModifier,
} from '../../src/modules/settings/shortcuts/shortcutRegistry'

describe('shortcutRegistry', () => {
  it('normalises shortcut bindings to canonical forms and aliases', () => {
    expect(normaliseShortcutBinding('cmd + shift + o')).toBe('Mod+Shift+O')
    expect(normaliseShortcutBinding('ctrl+\\')).toBe('Mod+\\')
    expect(normaliseShortcutBinding('option+comma')).toBe('Alt+,')
    expect(normaliseShortcutBinding('cmd+escape')).toBe('Mod+Escape')
    expect(normaliseShortcutBinding('cmd+space')).toBe('Mod+Space')
    expect(normaliseShortcutBinding('alt+f12')).toBe('Alt+F12')
    expect(normaliseShortcutBinding('')).toBe('')
  })

  it('rejects malformed shortcut bindings', () => {
    expect(normaliseShortcutBinding('cmd+o+p')).toBeNull()
    expect(normaliseShortcutBinding('shift')).toBeNull()
    expect(normaliseShortcutBinding('cmd+??')).toBeNull()
  })

  it('validates primary-modifier requirements', () => {
    expect(shortcutHasPrimaryModifier('Mod+P')).toBe(true)
    expect(shortcutHasPrimaryModifier('Alt+P')).toBe(true)
    expect(shortcutHasPrimaryModifier('Shift+P')).toBe(false)
    expect(shortcutHasPrimaryModifier('')).toBe(false)
    expect(shortcutHasPrimaryModifier('bad+binding')).toBe(false)
  })

  it('creates shortcut strings from keyboard events', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      shiftKey: true,
    })

    expect(shortcutFromKeyboardEvent(event)).toBe('Mod+Shift+O')

    const spaceEvent = new KeyboardEvent('keydown', {
      key: ' ',
      altKey: true,
    })
    expect(shortcutFromKeyboardEvent(spaceEvent)).toBe('Alt+Space')

    const modifierOnlyEvent = new KeyboardEvent('keydown', {
      key: 'Control',
      ctrlKey: true,
    })
    expect(shortcutFromKeyboardEvent(modifierOnlyEvent)).toBeNull()
  })

  it('resolves actions from configured shortcuts and ignores non-matches', () => {
    const shortcuts = getDefaultShortcutMap()

    const openSettingsEvent = new KeyboardEvent('keydown', {
      key: ',',
      metaKey: true,
    })

    expect(resolveShortcutAction(openSettingsEvent, shortcuts)).toBe('open_settings')

    shortcuts.open_settings = ''
    expect(resolveShortcutAction(openSettingsEvent, shortcuts)).toBeNull()
  })

  it('formats shortcuts for macOS and non-macOS labels', () => {
    expect(formatShortcutForDisplay('Mod+Shift+O', true)).toBe('⌘⇧O')
    expect(formatShortcutForDisplay('Mod+Shift+O', false)).toBe('Ctrl+Shift+O')
    expect(formatShortcutForDisplay('Alt+Space', true)).toBe('⌥Space')
    expect(formatShortcutForDisplay('', false)).toBe('Unassigned')
    expect(formatShortcutForDisplay('bad+binding', false)).toBe('Unassigned')
  })

  it('identifies valid shortcut action ids', () => {
    expect(isShortcutAction('open_file')).toBe(true)
    expect(isShortcutAction('not_real')).toBe(false)
  })
})
