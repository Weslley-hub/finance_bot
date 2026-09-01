export function isPublicFileUrl(path?: string | null): boolean {
  if (!path) {
    return false;
  }

  return /^(https?:)?\/\//i.test(path.trim()) || /api\.telegram\.org\/file\//i.test(path);
}

export function assertPrivateStoragePath(path?: string | null): void {
  if (isPublicFileUrl(path)) {
    throw new Error('Comprovante, PDF e imagem não podem ficar em URL pública.');
  }
}
