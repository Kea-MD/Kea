import { Markdown } from 'tiptap-markdown'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'

/**
 * Configure the Markdown extension for TipTap
 */
export function configureMarkdownExtension() {
  return Markdown.configure({
    html: false, // Don't allow raw HTML
    tightLists: true, // Tight list formatting
    bulletListMarker: '-', // Use - for bullets
    breaks: false, // Don't treat \n as <br>
    transformPastedText: true, // Transform pasted markdown
    transformCopiedText: true, // Transform copied text to markdown
  })
}

/**
 * Get the list of extensions for markdown parsing
 */
export function getBaseExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4],
      },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
    }),
    Image,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Color,
    TextStyle,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Subscript,
    Superscript,
  ]
}

/**
 * Handle edge cases in markdown content
 */
export function preprocessMarkdown(markdown: string): string {
  if (!markdown || markdown.trim() === '') {
    return ''
  }
  
  // Handle potential frontmatter (just strip it for now, Phase 1 will handle it)
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/
  if (frontmatterRegex.test(markdown)) {
    markdown = markdown.replace(frontmatterRegex, '')
  }
  
  return markdown
}

/**
 * Validate markdown content
 */
export function isValidMarkdown(content: string): boolean {
  // Basic validation - markdown is essentially always valid
  // but we can check for some edge cases
  return typeof content === 'string'
}