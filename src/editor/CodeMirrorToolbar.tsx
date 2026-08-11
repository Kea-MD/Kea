import { useRef, type WheelEvent } from 'react'
import type { EditorCommand, EditorController } from '../core/contracts/editor'
import { AppIcon, type AppIconName } from '../ui/AppIcon'

interface ToolbarButtonProps {
  icon: AppIconName
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
}

function ToolbarButton({ icon, label, shortcut, disabled = false, onClick }: ToolbarButtonProps) {
  const title = shortcut ? `${label} (${shortcut})` : label
  return (
    <button
      type="button"
      className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--react-dark-600)] transition-colors duration-120 hover:not-disabled:bg-[var(--react-hover-background)] hover:not-disabled:text-[var(--react-dark-700)] disabled:cursor-not-allowed disabled:opacity-36 dark:text-[var(--react-light-500)] dark:hover:not-disabled:bg-[rgba(238,238,246,0.11)] dark:hover:not-disabled:text-[var(--react-light-50)]"
      aria-label={label}
      title={title}
      disabled={disabled}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      <AppIcon name={icon} />
    </button>
  )
}

function ToolbarDivider() {
  return <span className="mx-[5px] h-5 w-px flex-none bg-[var(--react-dark-300)] dark:bg-[rgba(238,238,246,0.18)]" aria-hidden="true" />
}

interface InsertItemProps {
  icon: AppIconName
  label: string
  disabled: boolean
  onClick: () => void
}

function InsertItem({ icon, label, disabled, onClick }: InsertItemProps) {
  return (
    <button type="button" className="flex cursor-pointer items-center gap-[9px] rounded-md border-0 bg-transparent px-[9px] py-[7px] text-left text-xs text-[var(--react-dark-700)] hover:not-disabled:bg-[var(--react-hover-background)] disabled:opacity-36 dark:text-[var(--react-light-200)]" role="menuitem" disabled={disabled} onClick={onClick}>
      <AppIcon name={icon} />
      <span>{label}</span>
    </button>
  )
}

export interface CodeMirrorToolbarProps {
  editor: EditorController | null
}

export function CodeMirrorToolbar({ editor }: CodeMirrorToolbarProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const run = (command: EditorCommand) => editor?.execute(command)
  const capabilities = editor?.getCapabilities()
  const disabled = !editor

  const runInsert = (command: EditorCommand) => {
    run(command)
    document.querySelector<HTMLDetailsElement>('.markdown-insert-menu[open]')?.removeAttribute('open')
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current
    if (!scroller || Math.abs(event.deltaX) > 0.01 || event.deltaY === 0 || scroller.scrollWidth <= scroller.clientWidth) return
    const previousScrollLeft = scroller.scrollLeft
    scroller.scrollLeft += event.deltaY
    if (scroller.scrollLeft !== previousScrollLeft) event.preventDefault()
  }

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div ref={scrollerRef} className="flex min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onWheel={handleWheel}>
      <div className="flex min-w-full w-max items-center justify-center-safe">
      <span className="block h-px w-14 flex-none" aria-hidden="true" />
      <div className="flex min-h-7 w-max min-w-0 flex-none items-center gap-0.5" role="toolbar" aria-label="Text formatting tools">
      <div className="inline-flex flex-none items-center gap-0.5" aria-label="History and search">
        <ToolbarButton icon="undo" label="Undo" shortcut="⌘Z" disabled={!capabilities?.canUndo} onClick={() => run('undo')} />
        <ToolbarButton icon="redo" label="Redo" shortcut="⇧⌘Z" disabled={!capabilities?.canRedo} onClick={() => run('redo')} />
        <ToolbarButton icon="search" label="Find" shortcut="⌘F" disabled={disabled} onClick={() => run('find')} />
      </div>
      <ToolbarDivider />
      <label className="inline-flex h-7 cursor-pointer items-center gap-[3px] rounded-md border border-current px-1.5 text-[var(--react-dark-600)] dark:text-[var(--react-light-500)]">
        <AppIcon name="heading" />
        <span className="sr-only">Text style</span>
        <select
          className="min-w-[54px] appearance-none border-0 bg-transparent text-xs text-inherit outline-0"
          aria-label="Text style"
          value=""
          disabled={disabled}
          onChange={event => {
            if (event.target.value) run(event.target.value as EditorCommand)
          }}
        >
          <option value="">Style</option>
          <option value="heading-paragraph">Paragraph</option>
          <option value="heading-1">Heading 1</option>
          <option value="heading-2">Heading 2</option>
          <option value="heading-3">Heading 3</option>
          <option value="heading-4">Heading 4</option>
          <option value="heading-5">Heading 5</option>
          <option value="heading-6">Heading 6</option>
        </select>
        <AppIcon name="chevronDown" />
      </label>
      <ToolbarDivider />
      <div className="inline-flex flex-none items-center gap-0.5" aria-label="Inline formatting">
        <ToolbarButton icon="bold" label="Bold" shortcut="⌘B" disabled={disabled} onClick={() => run('bold')} />
        <ToolbarButton icon="italic" label="Italic" shortcut="⌘I" disabled={disabled} onClick={() => run('italic')} />
        <ToolbarButton icon="strikethrough" label="Strikethrough" disabled={disabled} onClick={() => run('strikethrough')} />
        <ToolbarButton icon="code" label="Inline code" shortcut="⌘`" disabled={disabled} onClick={() => run('code')} />
        <ToolbarButton icon="link" label="Insert link" shortcut="⌘K" disabled={disabled} onClick={() => run('insert-link')} />
      </div>
      <ToolbarDivider />
      <div className="inline-flex flex-none items-center gap-0.5" aria-label="Blocks and lists">
        <ToolbarButton icon="list" label="Bullet list" disabled={disabled} onClick={() => run('bullet-list')} />
        <ToolbarButton icon="listOrdered" label="Ordered list" disabled={disabled} onClick={() => run('ordered-list')} />
        <ToolbarButton icon="listTodo" label="Task list" disabled={disabled} onClick={() => run('task-list')} />
        <ToolbarButton icon="quote" label="Blockquote" disabled={disabled} onClick={() => run('blockquote')} />
      </div>
      <ToolbarDivider />
      <details className="markdown-insert-menu group relative flex-none">
        <summary className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md text-[var(--react-dark-600)] hover:bg-[var(--react-hover-background)] hover:text-[var(--react-dark-700)] group-open:bg-[var(--react-hover-background)] group-open:text-[var(--react-dark-700)] [&::-webkit-details-marker]:hidden dark:text-[var(--react-light-500)]" aria-label="More insert tools" title="More insert tools">
          <AppIcon name="menu" />
        </summary>
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 hidden w-[190px] gap-0.5 rounded-[10px] border border-[var(--react-border)] bg-[var(--react-panel-background)] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] group-open:grid" role="menu" aria-label="Insert content">
          <InsertItem icon="code" label="Code block" disabled={disabled} onClick={() => runInsert('code-block')} />
          <InsertItem icon="table" label="Table" disabled={disabled} onClick={() => runInsert('insert-table')} />
          <InsertItem icon="image" label="Image" disabled={disabled} onClick={() => runInsert('insert-image')} />
          <InsertItem icon="workflow" label="Mermaid diagram" disabled={disabled} onClick={() => runInsert('insert-mermaid')} />
          <InsertItem icon="maths" label="Maths block" disabled={disabled} onClick={() => runInsert('insert-math')} />
          <InsertItem icon="minus" label="Horizontal rule" disabled={disabled} onClick={() => runInsert('insert-hr')} />
        </div>
      </details>
      </div>
      <span className="block h-px w-14 flex-none" aria-hidden="true" />
      </div>
      </div>
    </div>
  )
}
