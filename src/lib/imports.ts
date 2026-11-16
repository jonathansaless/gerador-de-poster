import type { SourceAsset } from './config';

const MAX_BYTES = 80 * 1024 * 1024;

export function assertValidFile(file: File) {
  if (file.size > MAX_BYTES) throw new Error('Este arquivo tem mais de 80 MB. Reduza o arquivo e tente novamente.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'pdf'];
  if (!extension || !allowed.includes(extension)) {
    throw new Error('Formato não aceito. Use PNG, JPG, WEBP, GIF, BMP ou PDF.');
  }
  return extension === 'pdf';
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Não foi possível abrir esta imagem. Verifique se o arquivo está íntegro.'));
  });
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('Imagem sem dimensões válidas.');
  return img;
}

export async function loadAsset(file: File, pdfPage = 1): Promise<SourceAsset> {
  const isPdf = assertValidFile(file);
  if (!isPdf) {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      return {
        name: file.name, kind: 'image', file, image, url,
        width: image.naturalWidth, height: image.naturalHeight,
        pdfPage: 1, pdfPages: 1,
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  // The worker and the PDF parser are only downloaded after a PDF is uploaded.
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const doc = await task.promise;
  try {
    if (pdfPage > doc.numPages || pdfPage < 1) throw new Error('Essa página não existe neste PDF.');
    const page = await doc.getPage(pdfPage);
    const base = page.getViewport({ scale: 1 });
    // Limit the longest edge to avoid exhausting memory on phones.
    const scale = Math.min(4.5, 3600 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('O navegador não conseguiu preparar a visualização do PDF.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao converter a página do PDF.')), 'image/png'));
    const url = URL.createObjectURL(blob);
    try {
      const image = await loadImage(url);
      canvas.width = canvas.height = 0;
      return {
        name: file.name, kind: 'pdf', file, image, url,
        width: image.naturalWidth, height: image.naturalHeight,
        pdfPages: doc.numPages, pdfPage,
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  } finally {
    await doc.destroy();
  }
}
