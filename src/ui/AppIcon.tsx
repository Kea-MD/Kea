import {
  ArrowRight,
  ArrowRightLeft,
  Bold,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleX,
  Code2,
  Copy,
  ExternalLink,
  FileOutput,
  FilePenLine,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  Heading,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Quote,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sigma,
  Strikethrough,
  Sun,
  Table2,
  Trash2,
  Undo2,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'

const icons = {
  add: Plus,
  arrowRight: ArrowRight,
  bold: Bold,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  close: X,
  closeCircle: CircleX,
  code: Code2,
  copy: Copy,
  externalLink: ExternalLink,
  file: FileText,
  fileEdit: FilePenLine,
  fileNew: FilePlus,
  folder: Folder,
  folderNew: FolderPlus,
  folderOpen: FolderOpen,
  heading: Heading,
  image: Image,
  italic: Italic,
  link: Link2,
  list: List,
  listOrdered: ListOrdered,
  listTodo: ListTodo,
  maths: Sigma,
  menu: MoreHorizontal,
  minus: Minus,
  moon: Moon,
  move: ArrowRightLeft,
  panelClose: PanelLeftClose,
  panelOpen: PanelLeftOpen,
  quote: Quote,
  redo: Redo2,
  refresh: RefreshCw,
  rename: Pencil,
  reveal: FolderSearch,
  save: Save,
  saveAs: FileOutput,
  search: Search,
  settings: Settings,
  strikethrough: Strikethrough,
  sun: Sun,
  table: Table2,
  trash: Trash2,
  undo: Undo2,
  workflow: Workflow,
} satisfies Record<string, LucideIcon>

export type AppIconName = keyof typeof icons

export function AppIcon({ name, display = false, className = '' }: {
  name: AppIconName
  display?: boolean
  className?: string
}) {
  const Icon = icons[name]
  return (
    <Icon
      size={display ? 56 : 16}
      strokeWidth={1.8}
      className={`shrink-0 text-current${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
    />
  )
}
