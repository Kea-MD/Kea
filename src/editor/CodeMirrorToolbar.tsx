import { useRef, type ReactNode, type WheelEvent } from 'react'
import {
  Bold,
  ChevronDown,
  Code2,
  Heading,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  MoreHorizontal,
  Quote,
  Redo2,
  Search,
  Sigma,
  Strikethrough,
  Table2,
  Undo2,
  Workflow,
} from 'lucide-react'
import type { EditorCommand, EditorController } from '../core/contracts/editor'

interface ToolbarButtonProps {
  icon: ReactNode
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
      className="markdown-toolbar-button"
      aria-label={label}
      title={title}
      disabled={disabled}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  )
}

function ToolbarDivider() {
  return <span className="markdown-toolbar-divider" aria-hidden="true" />
}

interface InsertItemProps {
  icon: ReactNode
  label: string
  disabled: boolean
  onClick: () => void
}

function InsertItem({ icon, label, disabled, onClick }: InsertItemProps) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      {icon}
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
    <div className="markdown-toolbar-viewport">
      <div ref={scrollerRef} className="markdown-toolbar-scroll" onWheel={handleWheel}>
      <div className="markdown-toolbar-scroll-content">
      <span className="markdown-toolbar-scroll-gutter" aria-hidden="true" />
      <div className="markdown-toolbar-controls" role="toolbar" aria-label="Text formatting tools">
      <div className="markdown-toolbar-group" aria-label="History and search">
        <ToolbarButton icon={<Undo2 size={17} />} label="Undo" shortcut="⌘Z" disabled={!capabilities?.canUndo} onClick={() => run('undo')} />
        <ToolbarButton icon={<Redo2 size={17} />} label="Redo" shortcut="⇧⌘Z" disabled={!capabilities?.canRedo} onClick={() => run('redo')} />
        <ToolbarButton icon={<Search size={17} />} label="Find" shortcut="⌘F" disabled={disabled} onClick={() => run('find')} />
      </div>
      <ToolbarDivider />
      <label className="markdown-heading-select">
        <Heading size={16} aria-hidden="true" />
        <span className="sr-only">Text style</span>
        <select
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
        <ChevronDown size={13} aria-hidden="true" />
      </label>
      <ToolbarDivider />
      <div className="markdown-toolbar-group" aria-label="Inline formatting">
        <ToolbarButton icon={<Bold size={17} />} label="Bold" shortcut="⌘B" disabled={disabled} onClick={() => run('bold')} />
        <ToolbarButton icon={<Italic size={17} />} label="Italic" shortcut="⌘I" disabled={disabled} onClick={() => run('italic')} />
        <ToolbarButton icon={<Strikethrough size={17} />} label="Strikethrough" disabled={disabled} onClick={() => run('strikethrough')} />
        <ToolbarButton icon={<Code2 size={17} />} label="Inline code" shortcut="⌘`" disabled={disabled} onClick={() => run('code')} />
        <ToolbarButton icon={<Link2 size={17} />} label="Insert link" shortcut="⌘K" disabled={disabled} onClick={() => run('insert-link')} />
      </div>
      <ToolbarDivider />
      <div className="markdown-toolbar-group markdown-toolbar-group-blocks" aria-label="Blocks and lists">
        <ToolbarButton icon={<List size={17} />} label="Bullet list" disabled={disabled} onClick={() => run('bullet-list')} />
        <ToolbarButton icon={<ListOrdered size={17} />} label="Ordered list" disabled={disabled} onClick={() => run('ordered-list')} />
        <ToolbarButton icon={<ListTodo size={17} />} label="Task list" disabled={disabled} onClick={() => run('task-list')} />
        <ToolbarButton icon={<Quote size={17} />} label="Blockquote" disabled={disabled} onClick={() => run('blockquote')} />
      </div>
      <ToolbarDivider />
      <details className="markdown-insert-menu">
        <summary aria-label="More insert tools" title="More insert tools">
          <MoreHorizontal size={18} />
        </summary>
        <div className="markdown-insert-menu-panel" role="menu" aria-label="Insert content">
          <InsertItem icon={<Code2 size={16} />} label="Code block" disabled={disabled} onClick={() => runInsert('code-block')} />
          <InsertItem icon={<Table2 size={16} />} label="Table" disabled={disabled} onClick={() => runInsert('insert-table')} />
          <InsertItem icon={<Image size={16} />} label="Image" disabled={disabled} onClick={() => runInsert('insert-image')} />
          <InsertItem icon={<Workflow size={16} />} label="Mermaid diagram" disabled={disabled} onClick={() => runInsert('insert-mermaid')} />
          <InsertItem icon={<Sigma size={16} />} label="Maths block" disabled={disabled} onClick={() => runInsert('insert-math')} />
          <InsertItem icon={<Minus size={16} />} label="Horizontal rule" disabled={disabled} onClick={() => runInsert('insert-hr')} />
        </div>
      </details>
      </div>
      <span className="markdown-toolbar-scroll-gutter" aria-hidden="true" />
      </div>
      </div>
    </div>
  )
}
