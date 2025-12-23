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