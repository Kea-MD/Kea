import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

import { tauriDocumentStoragePort } from '../../src/platform/tauri/documentStorage'
import { tauriWorkspacePort } from '../../src/platform/tauri/workspaceFs'

describe('tauri ports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls invoke with document storage commands', async () => {
    invokeMock.mockResolvedValueOnce({ path: '/p.md', content: '# p', name: 'p.md' })
    await tauriDocumentStoragePort.readFile('/p.md')
    expect(invokeMock).toHaveBeenCalledWith('read_file', { path: '/p.md' })

    invokeMock.mockResolvedValueOnce({ path: '/o.md', content: '# o', name: 'o.md' })
    await tauriDocumentStoragePort.openMarkdownFile()
    expect(invokeMock).toHaveBeenCalledWith('open_markdown_file')

    invokeMock.mockResolvedValueOnce(undefined)
    await tauriDocumentStoragePort.saveMarkdownFile('/p.md', '# updated')
    expect(invokeMock).toHaveBeenCalledWith('save_markdown_file', { path: '/p.md', content: '# updated' })

    invokeMock.mockResolvedValueOnce({ path: '/save-as.md', name: 'save-as.md' })
    await tauriDocumentStoragePort.saveMarkdownFileAs('# new')
    expect(invokeMock).toHaveBeenCalledWith('save_markdown_file_as', { content: '# new' })
  })

  it('calls invoke with workspace commands', async () => {
    invokeMock.mockResolvedValueOnce({ path: '/workspace', name: 'workspace', entries: [] })
    await tauriWorkspacePort.openFolderDialog()
    expect(invokeMock).toHaveBeenCalledWith('open_folder_dialog')

    invokeMock.mockResolvedValueOnce([])
    await tauriWorkspacePort.readDirectory('/workspace')
    expect(invokeMock).toHaveBeenCalledWith('read_directory', { path: '/workspace' })

    invokeMock.mockResolvedValueOnce({ path: '/workspace/new.md', content: '', name: 'new.md' })
    await tauriWorkspacePort.createFile('/workspace/new.md', '')
    expect(invokeMock).toHaveBeenCalledWith('create_file', { path: '/workspace/new.md', content: '' })

    invokeMock.mockResolvedValueOnce({ path: '/workspace/new-folder', name: 'new-folder', is_dir: true, is_markdown: false })
    await tauriWorkspacePort.createFolder('/workspace/new-folder')
    expect(invokeMock).toHaveBeenCalledWith('create_folder', { path: '/workspace/new-folder' })

    invokeMock.mockResolvedValueOnce('/workspace/renamed.md')
    await tauriWorkspacePort.renameItem('/workspace/old.md', 'renamed.md')
    expect(invokeMock).toHaveBeenCalledWith('rename_item', { oldPath: '/workspace/old.md', newName: 'renamed.md' })

    invokeMock.mockResolvedValueOnce(undefined)
    await tauriWorkspacePort.deleteItem('/workspace/delete.md')
    expect(invokeMock).toHaveBeenCalledWith('delete_item', { path: '/workspace/delete.md' })

    invokeMock.mockResolvedValueOnce('/workspace/target/file.md')
    await tauriWorkspacePort.moveItem('/workspace/source/file.md', '/workspace/target')
    expect(invokeMock).toHaveBeenCalledWith('move_item', {
      sourcePath: '/workspace/source/file.md',
      targetDir: '/workspace/target',
    })
  })
})
