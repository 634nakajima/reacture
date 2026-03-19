'use client';

const PDFJS_VERSION = '4.8.69';
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

let pdfjsModule: PDFJSLib | null = null;
let loadPromise: Promise<PDFJSLib> | null = null;

async function loadPdfJs(): Promise<PDFJSLib> {
  if (pdfjsModule) return pdfjsModule;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const pdfjs = await import(
      /* webpackIgnore: true */
      `${PDFJS_CDN}/pdf.min.mjs`
    );
    pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`;
    pdfjsModule = pdfjs as unknown as PDFJSLib;
    return pdfjsModule;
  })();

  return loadPromise;
}

/**
 * PDFファイルを各ページの画像URL（blob URL）に変換する
 */
export async function pdfToImages(file: File, scale: number = 2): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    images.push(URL.createObjectURL(blob));
  }

  return images;
}

interface PDFJSLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(params: { data: ArrayBuffer }): { promise: Promise<PDFDocument> };
}

interface PDFDocument {
  numPages: number;
  getPage(num: number): Promise<PDFPage>;
}

interface PDFPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}
