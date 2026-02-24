import {
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'

import { renderMarkdownHtml } from '../markdown/renderMarkdownHtml'

const focusChangeEffect = StateEffect.define<boolean>()

function focusEditorWithoutScroll(view: EditorView): void {
  const content = view.contentDOM as HTMLElement
  try {
    content.focus({ preventScroll: true })
  } catch {
    view.focus()
  }
}

const editorFocusStateField = StateField.define<boolean>({
  create() {
    return false
  },
  update(isFocused, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(focusChangeEffect)) {
        return effect.value
      }
    }

    return isFocused
  },
})

class RenderedMarkdownWidget extends WidgetType {
  constructor(private readonly html: string) {
    super()
  }

  eq(other: RenderedMarkdownWidget): boolean {
    return other.html === this.html
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-rendered-markdown-block'
    wrapper.innerHTML = this.html

    wrapper.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest('a')

      if (link instanceof HTMLAnchorElement && (event.metaKey || event.ctrlKey) && link.href) {
        event.preventDefault()
        event.stopPropagation()
        window.open(link.href, '_blank', 'noopener,noreferrer')
        return
      }

      event.preventDefault()
      event.stopPropagation()

      view.dispatch({
        selection: { anchor: 0 },
      })

      focusEditorWithoutScroll(view)
    })

    return wrapper
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== 'mousedown'
  }
}

function buildRenderedDecorations(state: EditorState): DecorationSet {
  const isFocused = state.field(editorFocusStateField)
  if (isFocused || state.doc.length === 0) {
    return Decoration.none
  }

  const source = state.doc.toString()
  const html = renderMarkdownHtml(source)

  return Decoration.set([
    Decoration.replace({
      widget: new RenderedMarkdownWidget(html),
      block: true,
    }).range(0, state.doc.length),
  ], true)
}

function createRenderedDecorationsField() {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildRenderedDecorations(state)
    },

    update(decorations, transaction) {
      const hasFocusChange = transaction.effects.some((effect) => effect.is(focusChangeEffect))
      if (transaction.docChanged || hasFocusChange) {
        return buildRenderedDecorations(transaction.state)
      }

      return decorations.map(transaction.changes)
    },

    provide(field) {
      return EditorView.decorations.from(field)
    },
  })
}

const focusTrackerPlugin = ViewPlugin.fromClass(
  class {
    private lastFocus: boolean

    constructor(view: EditorView) {
      this.lastFocus = view.hasFocus
      if (this.lastFocus) {
        queueMicrotask(() => {
          view.dispatch({
            effects: focusChangeEffect.of(true),
          })
        })
      }
    }

    update(update: ViewUpdate): void {
      if (!update.focusChanged) {
        return
      }

      const isFocused = update.view.hasFocus
      if (isFocused === this.lastFocus) {
        return
      }

      this.lastFocus = isFocused

      queueMicrotask(() => {
        update.view.dispatch({
          effects: focusChangeEffect.of(isFocused),
        })
      })
    }
  },
)

export function renderedMarkdownMode(): Extension {
  return [
    editorFocusStateField,
    createRenderedDecorationsField(),
    focusTrackerPlugin,
  ]
}
