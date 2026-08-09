import { invoke } from '@tauri-apps/api/core'
import type { DocumentAssetPort, StoredDocumentAsset } from '../../core/contracts/assets'

export const tauriDocumentAssetPort: DocumentAssetPort = {
  async storeImage(documentPath, fileName, bytes): Promise<StoredDocumentAsset> {
    const relativePath = await invoke<string>('store_document_asset', { documentPath, fileName, bytes })
    return { relativePath }
  },
}
