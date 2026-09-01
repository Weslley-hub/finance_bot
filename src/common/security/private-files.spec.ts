import { assertPrivateStoragePath, isPublicFileUrl } from './private-files';

describe('isPublicFileUrl', () => {
  it('detecta http(s) e CDN do Telegram', () => {
    expect(isPublicFileUrl('https://files.example.com/recibo.pdf')).toBe(true);
    expect(
      isPublicFileUrl('https://api.telegram.org/file/botTOKEN/fotos/1.jpg'),
    ).toBe(true);
    expect(isPublicFileUrl('documentos/familia/recibo.pdf')).toBe(false);
  });
});

describe('assertPrivateStoragePath', () => {
  it('bloqueia comprovante em URL pública', () => {
    expect(() =>
      assertPrivateStoragePath('https://cdn.example.com/comprovante.jpg'),
    ).toThrow(/URL pública/);
  });

  it('permite caminho local privado', () => {
    expect(() => assertPrivateStoragePath('storage/receipts/abc.pdf')).not.toThrow();
  });
});
