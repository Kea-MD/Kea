import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  formatShortcutForDisplay,
  shortcutDefinitions,
  shortcutFromKeyboardEvent,
  type ShortcutActionId,
} from '../modules/settings/shortcuts/shortcutRegistry'
import { isMacPlatform } from '../shared/platform/runtime'
import type { ThemeMode } from '../theme'
import type { ReactSettings } from './useSettings'
import { useUpdatesSettingsController } from './updatesClient'

export interface SettingsDialogProps {
  settings: ReactSettings
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
  onRestoreWorkspaceChange: (value: boolean) => void
  onEdgeGlowChange: (value: boolean) => void
  onSetShortcut: (actionId: ShortcutActionId, binding: string) => boolean
  onResetShortcut: (actionId: ShortcutActionId) => void
  onResetAllShortcuts: () => void
  onClose: () => void
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={label}
    className={`react-settings-toggle${checked ? ' is-checked' : ''}`}
    onClick={() => onChange(!checked)}
  ><span aria-hidden="true" /></button>
}

function SettingRow({ label, description, children, className = '' }: { label: string; description: string; children: ReactNode; className?: string }) {
  return <div className={`react-settings-row ${className}`}>
    <div className="react-settings-copy">
      <p className="react-settings-label">{label}</p>
      <p className="react-settings-description">{description}</p>
    </div>
    {children}
  </div>
}

function UpdatesSection(): React.JSX.Element {
  const { state, check, install } = useUpdatesSettingsController()
  const description = state.status === 'available'
    ? `Version ${state.availableVersion} is ready to install.`
    : state.status === 'current'
      ? 'Kea is up to date.'
      : state.status === 'checking'
        ? 'Checking for a newer version…'
        : state.status === 'downloading'
          ? `Downloading update${state.progress === undefined ? '…' : ` (${Math.round(state.progress)}%)`}`
          : state.status === 'installing'
            ? 'Installing the update. Kea will restart shortly.'
            : state.status === 'error' || state.status === 'unavailable'
              ? (state.message ?? 'Update checks are unavailable.')
              : 'Check for a newer version of Kea.'

  const busy = state.status === 'checking' || state.status === 'downloading' || state.status === 'installing'
  return <section className="react-settings-section" aria-labelledby="react-updates-settings-title">
    <h3 id="react-updates-settings-title">Updates</h3>
    <SettingRow label={`Version ${state.currentVersion}`} description={description}>
      {state.status === 'available' ? (
        <button type="button" className="react-settings-link" onClick={() => void install()}>
          Install and restart
        </button>
      ) : (
        <button type="button" className="react-settings-link" disabled={busy} onClick={() => void check()}>
          {state.status === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
      )}
    </SettingRow>
  </section>
}

export function SettingsDialog({ settings, themeMode, onThemeModeChange, onRestoreWorkspaceChange, onEdgeGlowChange, onSetShortcut, onResetShortcut, onResetAllShortcuts, onClose }: SettingsDialogProps) {
  const [editingShortcutId, setEditingShortcutId] = useState<ShortcutActionId | null>(null)
  const [shortcutError, setShortcutError] = useState('')
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const isMac = isMacPlatform()

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && editingShortcutId === null) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingShortcutId, onClose])

  const stopEditing = () => {
    setEditingShortcutId(null)
    setShortcutError('')
  }

  const handleCapture = (actionId: ShortcutActionId, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (editingShortcutId !== actionId) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      stopEditing()
      return
    }
    const binding = shortcutFromKeyboardEvent(event.nativeEvent)
    if (!binding) return
    if (!onSetShortcut(actionId, binding)) {
      setShortcutError('Shortcut must include Ctrl/Cmd or Alt and a non-modifier key.')
      return
    }
    stopEditing()
  }

  const startEditing = (actionId: ShortcutActionId) => {
    setEditingShortcutId(actionId)
    setShortcutError('')
  }

  const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return <div className="react-settings-overlay" role="presentation" onMouseDown={handleOverlayMouseDown}>
    <section className="react-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="react-settings-title" onMouseDown={event => event.stopPropagation()}>
      <header className="react-settings-header">
        <h2 id="react-settings-title">Settings</h2>
        <button ref={closeButtonRef} type="button" className="react-settings-close" aria-label="Close settings" title="Close settings" onClick={onClose}>×</button>
      </header>

      <div className="react-settings-content">
        <UpdatesSection />
        <section className="react-settings-section" aria-labelledby="react-appearance-settings-title">
          <h3 id="react-appearance-settings-title">Appearance</h3>
          <SettingRow label="Theme" description="Choose light, dark, or follow your system theme.">
            <label className="sr-only" htmlFor="react-settings-theme">Theme</label>
            <select id="react-settings-theme" className="react-settings-select" value={themeMode} onChange={event => onThemeModeChange(event.target.value as ThemeMode)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </SettingRow>
          <SettingRow label="Edge glow effect" description="Show the mouse glow trail around the window edge.">
            <Toggle checked={settings.edgeGlowEnabled} label="Toggle edge glow effect" onChange={onEdgeGlowChange} />
          </SettingRow>
        </section>

        <section className="react-settings-section" aria-labelledby="react-workspace-settings-title">
          <h3 id="react-workspace-settings-title">Workspace</h3>
          <SettingRow label="Restore previous workspace on launch" description="Re-open your last folder automatically when Kea starts.">
            <Toggle checked={settings.restoreWorkspaceOnLaunch} label="Restore previous workspace on launch" onChange={onRestoreWorkspaceChange} />
          </SettingRow>
        </section>

        <section className="react-settings-section" aria-labelledby="react-shortcut-settings-title">
          <div className="react-settings-section-header">
            <h3 id="react-shortcut-settings-title">Shortcuts</h3>
            <button type="button" className="react-settings-link" title="Reset all shortcuts" onClick={() => { onResetAllShortcuts(); stopEditing() }}>Reset all</button>
          </div>
          {(['File', 'Edit', 'View'] as const).map(category => <div className="react-settings-shortcut-group" key={category}>
            <h4>{category}</h4>
            {shortcutDefinitions.filter(shortcut => shortcut.category === category).map(shortcut => <SettingRow key={shortcut.id} className="react-settings-shortcut-row" label={shortcut.label} description={shortcut.description}>
              <div className="react-settings-shortcut-controls">
                <button type="button" className={`react-settings-shortcut-chip${editingShortcutId === shortcut.id ? ' is-capturing' : ''}`} title={editingShortcutId === shortcut.id ? 'Press a key combination' : 'Edit shortcut'} onClick={() => startEditing(shortcut.id)} onKeyDown={event => handleCapture(shortcut.id, event)}>
                  {editingShortcutId === shortcut.id ? 'Press keys…' : formatShortcutForDisplay(settings.shortcuts[shortcut.id], isMac)}
                </button>
                <button type="button" className="react-settings-link" title="Reset this shortcut" onClick={() => { onResetShortcut(shortcut.id); setShortcutError('') }}>Reset</button>
                <button type="button" className="react-settings-link" title="Clear this shortcut" onClick={() => { onSetShortcut(shortcut.id, ''); setShortcutError(''); if (editingShortcutId === shortcut.id) stopEditing() }}>Clear</button>
              </div>
            </SettingRow>)}
          </div>)}
          {shortcutError && <p className="react-settings-error" role="alert">{shortcutError}</p>}
        </section>
      </div>
    </section>
  </div>
}
