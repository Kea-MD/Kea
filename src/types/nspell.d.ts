declare module 'nspell' {
  export interface NSpellInstance {
    correct: (word: string) => boolean
    suggest: (word: string) => string[]
    add: (word: string) => void
  }
  export default function nspell(dictionary: { aff: Uint8Array | string; dic: Uint8Array | string }): NSpellInstance
}
