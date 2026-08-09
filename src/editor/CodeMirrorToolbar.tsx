import type { ReactNode } from 'react'
import {
  Bold,
  Code2,
  Heading,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
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
  disabled?: boolean
  onClick: () => void
}

function ToolbarButton({ icon, label, disabled = false, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="markdown-toolbar-button"
      aria-label={label}
      title={label}
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

export interface CodeMirrorToolbarProps {
  editor: EditorController | null
}

export function CodeMirrorToolbar({ editor }: CodeMirrorToolbarProps) {
  const run = (command: EditorCommand) => editor?.execute(command)
  const capabilities = editor?.getCapabilities()

  return (
    <div className="markdown-toolbar-controls" aria-label="Text formatting tools">
      <ToolbarButton icon={<Undo2 size={17} strokeWidth={1.8} />} label="Undo" disabled={!capabilities?.canUndo} onClick={() => run('undo')} />
      <ToolbarButton icon={<Redo2 size={17} strokeWidth={1.8} />} label="Redo" disabled={!capabilities?.canRedo} onClick={() => run('redo')} />
      <ToolbarButton icon={<Search size={17} strokeWidth={1.8} />} label="Find" disabled={!editor} onClick={() => run('find')} />
      <ToolbarDivider />
      <label className="markdown-heading-select">
        <Heading size={16} strokeWidth={1.8} aria-hidden="true" />
        <span className="sr-only">Text style</span>
        <select
          aria-label="Text style"
          value=""
          disabled={!editor}
          onChange={event => {
            if (event.target.value) run(event.target.value as EditorCommand)
          }}
        >
          <option value="">Text</option>
          <option value="heading-1">Heading 1</option>
          <option value="heading-2">Heading 2</option>
          <option value="heading-3">Heading 3</option>
          <option value="heading-4">Heading 4</option>
          <option value="heading-5">Heading 5</option>
          <option value="heading-6">Heading 6</option>
        </select>
      </label>
      <ToolbarDivider />
      <ToolbarButton icon={<Bold size={17} strokeWidth={1.9} />} label="Bold" disabled={!editor} onClick={() => run('bold')} />
      <ToolbarButton icon={<Italic size={17} strokeWidth={1.9} />} label="Italic" disabled={!editor} onClick={() => run('italic')} />
      <ToolbarButton icon={<Strikethrough size={17} strokeWidth={1.8} />} label="Strikethrough" disabled={!editor} onClick={() => run('strikethrough')} />
      <ToolbarButton icon={<Code2 size={17} strokeWidth={1.8} />} label="Inline code" disabled={!editor} onClick={() => run('code')} />
      <ToolbarDivider />
      <ToolbarButton icon={<List size={17} strokeWidth={1.8} />} label="Bullet list" disabled={!editor} onClick={() => run('bullet-list')} />
      <ToolbarButton icon={<ListOrdered size={17} strokeWidth={1.8} />} label="Ordered list" disabled={!editor} onClick={() => run('ordered-list')} />
      <ToolbarButton icon={<ListTodo size={17} strokeWidth={1.8} />} label="Task list" disabled={!editor} onClick={() => run('task-list')} />
      <ToolbarDivider />
      <ToolbarButton icon={<Quote size={17} strokeWidth={1.8} />} label="Blockquote" disabled={!editor} onClick={() => run('blockquote')} />
      <ToolbarButton icon={<Code2 size={17} strokeWidth={1.8} />} label="Code block" disabled={!editor} onClick={() => run('code-block')} />
      <ToolbarButton icon={<Workflow size={17} strokeWidth={1.8} />} label="Insert Mermaid diagram" disabled={!editor} onClick={() => run('insert-mermaid')} />
      <ToolbarButton icon={<Sigma size={17} strokeWidth={1.8} />} label="Insert maths block" disabled={!editor} onClick={() => run('insert-math')} />
      <ToolbarButton icon={<Minus size={17} strokeWidth={1.8} />} label="Horizontal rule" disabled={!editor} onClick={() => run('insert-hr')} />
      <ToolbarDivider />
      <ToolbarButton icon={<Table2 size={17} strokeWidth={1.8} />} label="Insert table" disabled={!editor} onClick={() => run('insert-table')} />
      <ToolbarButton icon={<Link2 size={17} strokeWidth={1.8} />} label="Insert link" disabled={!editor} onClick={() => run('insert-link')} />
      <ToolbarButton icon={<Image size={17} strokeWidth={1.8} />} label="Insert image" disabled={!editor} onClick={() => run('insert-image')} />
    </div>
  )
}
