export interface ReconcileContext<TCommand> {
  command: TCommand
}

export type ReconcileStage<TCommand> = (context: ReconcileContext<TCommand>) => void

export function runReconcilePipeline<TCommand>(
  command: TCommand,
  stages: ReconcileStage<TCommand>[]
): ReconcileContext<TCommand> {
  const context: ReconcileContext<TCommand> = {
    command,
  }

  for (const stage of stages) {
    stage(context)
  }

  return context
}
