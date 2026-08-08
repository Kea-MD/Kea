import type { DocumentCommand } from './documentCommands'
import { runReconcilePipeline } from './reconcilePipeline'

interface DocumentCommandHooks {
  normalise?: (command: DocumentCommand) => void
  reconcile?: (command: DocumentCommand) => void
  persist?: (command: DocumentCommand) => void
  broadcast?: (command: DocumentCommand) => void
}

interface DispatchDocumentCommandOptions<TResult> {
  command: DocumentCommand
  apply: () => TResult
  hooks?: DocumentCommandHooks
}

export function dispatchDocumentCommand<TResult>(
  options: DispatchDocumentCommandOptions<TResult>
): TResult {
  let result!: TResult

  runReconcilePipeline(options.command, [
    ({ command }) => {
      options.hooks?.normalise?.(command)
    },
    () => {
      result = options.apply()
    },
    ({ command }) => {
      options.hooks?.reconcile?.(command)
    },
    ({ command }) => {
      options.hooks?.persist?.(command)
    },
    ({ command }) => {
      options.hooks?.broadcast?.(command)
    },
  ])

  return result
}
