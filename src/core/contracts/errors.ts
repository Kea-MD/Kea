export type KeaErrorCode =
  | 'cancelled'
  | 'not-found'
  | 'permission'
  | 'conflict'
  | 'io'
  | 'unknown'

export interface KeaError {
  code: KeaErrorCode
  message: string
  cause?: unknown
}
