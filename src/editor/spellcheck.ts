import { RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state'
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'
import {
  SpellcheckIssue,
  spellcheckActions,
  spellcheckExtension,
  spellcheckIssues,
  suggestionFetcher,
  type SpellcheckActionsConfig,
} from '@prosemark/spellcheck-frontend'
import createNSpell from 'nspell'
import aff from '../../node_modules/dictionary-en-gb/index.aff?raw'
import dic from '../../node_modules/dictionary-en-gb/index.dic?raw'

const spell = createNSpell({ aff, dic })
const PERSONAL_DICTIONARY_KEY = 'kea-personal-dictionary'
const WORD = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g
const replaceIssues = StateEffect.define<RangeSet<SpellcheckIssue>>()

function personalWords(): string[] {
  try { return JSON.parse(window.localStorage.getItem(PERSONAL_DICTIONARY_KEY) ?? '[]') as string[] } catch { return [] }
}

for (const word of personalWords()) spell.add(word)

function visibleIssues(view: EditorView): RangeSet<SpellcheckIssue> {
  const ranges = view.visibleRanges.map(range => ({
    from: view.state.doc.lineAt(range.from).from,
    to: view.state.doc.lineAt(range.to).to,
  }))
  const found: Array<ReturnType<SpellcheckIssue['range']>> = []
  let previousTo = -1
  for (const range of ranges) {
    const from = Math.max(range.from, previousTo)
    if (range.to <= from) continue
    const text = view.state.doc.sliceString(from, range.to)
    for (const match of text.matchAll(WORD)) {
      const word = match[0]
      if (word.length < 2 || spell.correct(word)) continue
      const start = from + (match.index ?? 0)
      found.push(new SpellcheckIssue(word).range(start, start + word.length))
    }
    previousTo = range.to
  }
  return RangeSet.of(found, true)
}

const issueField = StateField.define<RangeSet<SpellcheckIssue>>({
  create: () => RangeSet.empty,
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(replaceIssues)) return effect.value
    return transaction.docChanged ? value.map(transaction.changes) : value
  },
  provide: field => spellcheckIssues.from(field),
})

const viewportSpellcheck = ViewPlugin.fromClass(class {
  private timer = -1

  constructor(private readonly view: EditorView) { this.schedule(0) }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) this.schedule(180)
  }

  private schedule(delay: number): void {
    if (this.timer >= 0) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.timer = -1
      this.view.dispatch({ effects: replaceIssues.of(visibleIssues(this.view)) })
    }, delay)
  }

  destroy(): void { if (this.timer >= 0) window.clearTimeout(this.timer) }
})

function actions(word: string): SpellcheckActionsConfig {
  return { actions: [{
    label: `Add “${word}” to dictionary`,
    execute: (_selectedWord, view) => {
      spell.add(word)
      const words = Array.from(new Set([...personalWords(), word])).sort()
      window.localStorage.setItem(PERSONAL_DICTIONARY_KEY, JSON.stringify(words))
      view.dispatch({ effects: replaceIssues.of(visibleIssues(view)) })
    },
  }] }
}

export function createKeaSpellcheckExtensions(): readonly Extension[] {
  return [
    spellcheckExtension,
    issueField,
    viewportSpellcheck,
    suggestionFetcher.of(word => Promise.resolve(spell.suggest(word).slice(0, 8).map(suggestion => ({ word: suggestion })))),
    spellcheckActions.of(actions),
  ]
}
