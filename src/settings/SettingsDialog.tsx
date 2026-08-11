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

const settingsSectionClass = 'rounded-[14px] border border-[#dedede] bg-white px-4 py-[14px] dark:border-white/[0.13] dark:bg-[#202020] [&_.settings-row+.settings-row]:border-t [&_.settings-row+.settings-row]:border-[#dedede] dark:[&_.settings-row+.settings-row]:border-white/[0.13] [&_.settings-shortcut-group+.settings-shortcut-group]:mt-3'
const settingsHeadingClass = 'mb-0.5 text-[13px] font-semibold tracking-[0.01em] text-[#1a1a1a] dark:text-[#f3f3f3]'
const settingsLinkClass = 'cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-[5px] text-xs text-[#1a1a1a] hover:bg-black/[0.08] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#f3f3f3] dark:hover:bg-white/10'

export interface SettingsDialogProps {
  settings: ReactSettings
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
  onRestoreWorkspaceChange: (value: boolean) => void
  onRevealSidebarOnEdgeHoverChange: (value: boolean) => void
  onRevealTopChromeOnEdgeHoverChange: (value: boolean) => void
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
    className={`relative h-[21px] w-9 flex-none cursor-pointer rounded-full border p-0.5 transition-[background,border-color] duration-120${checked ? ' border-transparent bg-[#1a1a1a] dark:bg-[#f3f3f3]' : ' border-[#c8c8c8] bg-[#c8c8c8] dark:border-[#484848] dark:bg-[#484848]'}`}
    onClick={() => onChange(!checked)}
  ><span className={`block h-[15px] w-[15px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-120${checked ? ' translate-x-[15px] dark:bg-[#1a1a1a]' : ''}`} aria-hidden="true" /></button>
}

function SettingRow({ label, description, children, className = '', descriptionSelectable = false }: { label: string; description: string; children: ReactNode; className?: string; descriptionSelectable?: boolean }) {
  return <div className={`settings-row flex items-center justify-between gap-3 py-[11px] ${className}`}>
    <div className="min-w-0">
      <p className="m-0 text-[13px] font-medium text-[#1a1a1a] dark:text-[#f3f3f3]">{label}</p>
      <p className={`mt-1 mb-0 text-xs leading-[1.45] text-[#707070] dark:text-[#b0b0b0]${descriptionSelectable ? ' select-text' : ''}`}>{description}</p>
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
  return <section className={settingsSectionClass} aria-labelledby="react-updates-settings-title">
    <h3 className={settingsHeadingClass} id="react-updates-settings-title">Updates</h3>
    <SettingRow label={`Version ${state.currentVersion}`} description={description} descriptionSelectable={state.status === 'error' || state.status === 'unavailable'}>
      {state.status === 'available' ? (
        <button type="button" className={settingsLinkClass} onClick={() => void install()}>
          Install and restart
        </button>
      ) : (
        <button type="button" className={settingsLinkClass} disabled={busy} onClick={() => void check()}>
          {state.status === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
      )}
    </SettingRow>
  </section>
}

export function SettingsDialog({ settings, themeMode, onThemeModeChange, onRestoreWorkspaceChange, onRevealSidebarOnEdgeHoverChange, onRevealTopChromeOnEdgeHoverChange, onEdgeGlowChange, onSetShortcut, onResetShortcut, onResetAllShortcuts, onClose }: SettingsDialogProps) {
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

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/28 p-6 backdrop-blur-lg backdrop-saturate-[1.15] max-[768px]:items-end max-[768px]:p-3 dark:bg-black/72" role="presentation" onMouseDown={handleOverlayMouseDown}>
    <section className="max-h-[min(820px,calc(100vh-40px))] w-[min(760px,100%)] overflow-hidden rounded-[20px] border border-[#dedede] bg-[#f7f7f7] text-[#1a1a1a] shadow-[0_24px_80px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.12)] max-[768px]:max-h-[calc(100vh-24px)] max-[768px]:rounded-[18px] dark:border-white/[0.13] dark:bg-[#171717] dark:text-[#f3f3f3]" role="dialog" aria-modal="true" aria-labelledby="react-settings-title" onMouseDown={event => event.stopPropagation()}>
      <header className="flex items-center justify-between gap-3 border-b border-[#dedede] px-6 pt-5 pb-[18px] max-[768px]:px-[18px] max-[768px]:pt-[18px] max-[768px]:pb-4 dark:border-white/[0.13]">
        <h2 className="m-0 text-lg font-semibold tracking-[-0.01em] text-[#1a1a1a] dark:text-[#f3f3f3]" id="react-settings-title">Settings</h2>
        <button ref={closeButtonRef} type="button" className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[9px] border-0 bg-transparent text-[22px] leading-none text-[#707070] hover:bg-black/[0.08] hover:text-[#1a1a1a] dark:text-[#b0b0b0] dark:hover:bg-white/10 dark:hover:text-[#f3f3f3]" aria-label="Close settings" title="Close settings" onClick={onClose}>×</button>
      </header>

      <div className="flex max-h-[calc(min(820px,100vh-40px)-70px)] flex-col gap-3 overflow-y-auto px-6 pt-[18px] pb-6 [scrollbar-color:var(--react-scrollbar-thumb)_transparent] [scrollbar-width:thin] max-[768px]:max-h-[calc(100vh-94px)] max-[768px]:px-[14px] max-[768px]:pt-[14px] max-[768px]:pb-[18px] [&::-webkit-scrollbar]:h-[var(--react-scrollbar-thumb-size)] [&::-webkit-scrollbar]:w-[var(--react-scrollbar-thumb-size)] [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-thumb]:min-h-7 [&::-webkit-scrollbar-thumb]:min-w-7 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--react-scrollbar-thumb)] [&::-webkit-scrollbar-thumb:hover]:bg-[var(--react-scrollbar-thumb-hover)] [&::-webkit-scrollbar-track]:bg-transparent">
        <UpdatesSection />
        <section className={settingsSectionClass} aria-labelledby="react-appearance-settings-title">
          <h3 className={settingsHeadingClass} id="react-appearance-settings-title">Appearance</h3>
          <SettingRow label="Theme" description="Choose light, dark, or follow your system theme.">
            <label className="sr-only" htmlFor="react-settings-theme">Theme</label>
            <select id="react-settings-theme" className="w-[138px] flex-none rounded-lg border border-[#dedede] bg-[#f1f1f1] px-2.5 py-2 text-xs text-[#1a1a1a] hover:border-[color-mix(in_srgb,#1a1a1a_52%,#dedede)] dark:border-white/[0.13] dark:bg-[#111] dark:text-[#f3f3f3] dark:hover:border-[color-mix(in_srgb,#f3f3f3_52%,rgba(255,255,255,0.13))]" value={themeMode} onChange={event => onThemeModeChange(event.target.value as ThemeMode)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </SettingRow>
          <SettingRow label="Edge glow effect" description="Show the mouse glow trail around the window edge.">
            <Toggle checked={settings.edgeGlowEnabled} label="Toggle edge glow effect" onChange={onEdgeGlowChange} />
          </SettingRow>
        </section>

        <section className={settingsSectionClass} aria-labelledby="react-workspace-settings-title">
          <h3 className={settingsHeadingClass} id="react-workspace-settings-title">Workspace</h3>
          <SettingRow label="Reveal sidebar on edge hover" description="Show the sidebar when the pointer reaches the left edge of the window.">
            <Toggle checked={settings.revealSidebarOnEdgeHover} label="Reveal sidebar on edge hover" onChange={onRevealSidebarOnEdgeHoverChange} />
          </SettingRow>
          <SettingRow label="Reveal tabs and toolbar on top hover" description="Show the tabs and toolbar when the pointer reaches the top edge of the window.">
            <Toggle checked={settings.revealTopChromeOnEdgeHover} label="Reveal tabs and toolbar on top hover" onChange={onRevealTopChromeOnEdgeHoverChange} />
          </SettingRow>
          <SettingRow label="Restore previous workspace on launch" description="Re-open your last folder automatically when Kea starts.">
            <Toggle checked={settings.restoreWorkspaceOnLaunch} label="Restore previous workspace on launch" onChange={onRestoreWorkspaceChange} />
          </SettingRow>
        </section>

        <section className={settingsSectionClass} aria-labelledby="react-shortcut-settings-title">
          <div className="mb-0.5 flex items-center justify-between gap-2.5">
            <h3 className={settingsHeadingClass} id="react-shortcut-settings-title">Shortcuts</h3>
            <button type="button" className={settingsLinkClass} title="Reset all shortcuts" onClick={() => { onResetAllShortcuts(); stopEditing() }}>Reset all</button>
          </div>
          {(['File', 'Edit', 'View'] as const).map(category => <div className="settings-shortcut-group" key={category}>
            <h4 className="mb-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#969696] dark:text-[#898989]">{category}</h4>
            {shortcutDefinitions.filter(shortcut => shortcut.category === category && shortcut.id !== 'toggle_editor_mode').map(shortcut => <SettingRow key={shortcut.id} className="grid grid-cols-[minmax(0,1fr)_auto] max-[768px]:flex max-[768px]:flex-col max-[768px]:items-start" label={shortcut.label} description={shortcut.description}>
              <div className="flex flex-none flex-wrap items-center justify-end gap-1.5 max-[768px]:w-full max-[768px]:justify-start">
                <button type="button" className={`min-w-28 cursor-pointer rounded-lg border border-[#dedede] bg-[#f1f1f1] px-2.5 py-[7px] text-center text-xs font-semibold text-[#1a1a1a] hover:border-[color-mix(in_srgb,#1a1a1a_52%,#dedede)] dark:border-white/[0.13] dark:bg-[#111] dark:text-[#f3f3f3] dark:hover:border-[color-mix(in_srgb,#f3f3f3_52%,rgba(255,255,255,0.13))]${editingShortcutId === shortcut.id ? ' bg-black/[0.08] shadow-[0_0_0_1px_color-mix(in_srgb,#1a1a1a_30%,transparent)] dark:bg-white/10 dark:shadow-[0_0_0_1px_color-mix(in_srgb,#f3f3f3_30%,transparent)]' : ''}`} title={editingShortcutId === shortcut.id ? 'Press a key combination' : 'Edit shortcut'} onClick={() => startEditing(shortcut.id)} onKeyDown={event => handleCapture(shortcut.id, event)}>
                  {editingShortcutId === shortcut.id ? 'Press keys…' : formatShortcutForDisplay(settings.shortcuts[shortcut.id], isMac)}
                </button>
                <button type="button" className={settingsLinkClass} title="Reset this shortcut" onClick={() => { onResetShortcut(shortcut.id); setShortcutError('') }}>Reset</button>
                <button type="button" className={settingsLinkClass} title="Clear this shortcut" onClick={() => { onSetShortcut(shortcut.id, ''); setShortcutError(''); if (editingShortcutId === shortcut.id) stopEditing() }}>Clear</button>
              </div>
            </SettingRow>)}
          </div>)}
          {shortcutError && <p className="mt-2 mb-0 select-text text-xs text-[#c43d39]" role="alert">{shortcutError}</p>}
        </section>
      </div>
    </section>
  </div>
}
