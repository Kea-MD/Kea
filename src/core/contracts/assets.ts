export interface StoredDocumentAsset {
  relativePath: string
}

export interface DocumentAssetPort {
  storeImage: (documentPath: string, fileName: string, bytes: number[]) => Promise<StoredDocumentAsset>
}
