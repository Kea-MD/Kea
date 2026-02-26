import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

interface MissingHoverHint {
  file: string
  line: number
  tag: 'button' | 'Button'
}

const projectRoot = process.cwd()
const srcRoot = join(projectRoot, 'src')

function getVueFilePaths(directoryPath: string): string[] {
  const entries = readdirSync(directoryPath, { withFileTypes: true })

  return entries.flatMap(entry => {
    const fullPath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      return getVueFilePaths(fullPath)
    }

    return entry.name.endsWith('.vue') ? [fullPath] : []
  })
}

function findMissingHoverHints(vueFilePath: string): MissingHoverHint[] {
  const source = readFileSync(vueFilePath, 'utf8')
  const templateMatch = source.match(/<template(?:\s[^>]*)?>[\s\S]*?<\/template>/)

  if (!templateMatch || typeof templateMatch.index !== 'number') {
    return []
  }

  const templateSource = templateMatch[0]
  const templateStartOffset = templateMatch.index
  const buttonTagPattern = /<(button|Button)\b[\s\S]*?>/g

  return [...templateSource.matchAll(buttonTagPattern)]
    .map(tagMatch => {
      const tagSource = tagMatch[0]
      const relativeOffset = tagMatch.index ?? 0
      const absoluteOffset = templateStartOffset + relativeOffset
      const line = source.slice(0, absoluteOffset).split('\n').length

      return {
        file: relative(projectRoot, vueFilePath),
        line,
        tag: tagMatch[1] as 'button' | 'Button',
        hasTitle: /\s(?:title|:title)\s*=/.test(tagSource),
      }
    })
    .filter(match => !match.hasTitle)
    .map(({ file, line, tag }) => ({ file, line, tag }))
}

describe('site-wide hover hints', () => {
  it('requires a title attribute on all button elements', () => {
    const missingHoverHints = getVueFilePaths(srcRoot).flatMap(findMissingHoverHints)

    if (missingHoverHints.length > 0) {
      const details = missingHoverHints
        .map(missing => `- ${missing.file}:${missing.line} <${missing.tag}> missing title/:title`)
        .join('\n')

      throw new Error(`Found buttons without hover hints:\n${details}`)
    }

    expect(missingHoverHints).toHaveLength(0)
  })
})
