let mathJaxPromise: Promise<void> | null = null

export function loadBundledMathJax(): Promise<void> {
  if (mathJaxPromise) return mathJaxPromise

  const mathJaxWindow = window as Window & { MathJax?: unknown }
  mathJaxWindow.MathJax = {
    startup: { typeset: false },
    options: {
      enableSpeech: false,
      enableBraille: false,
      enableEnrichment: false,
      menuOptions: {
        settings: { enrich: false, speech: false, braille: false },
      },
    },
  }

  mathJaxPromise = import('mathjax/tex-svg.js').then(() => undefined)
  return mathJaxPromise
}
