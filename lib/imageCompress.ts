/**
 * Compressão e redimensionamento de imagens no browser, antes do upload.
 *
 * Objectivo: reduzir o tamanho de fotos de telemóvel (3–10 MB) para algo
 * razoável (~200–600 KB) sem perda visível, antes do POST multipart. Isto
 * evita 413 do nginx, poupa banda e acelera o upload.
 *
 * Estratégia:
 *  - Lê o ficheiro via `createImageBitmap` (fallback `<img>`).
 *  - Redimensiona para `MAX_DIMENSION` no lado maior (mantém aspect ratio).
 *  - Exporta JPEG com qualidades decrescentes até resultar < 5 MB.
 *  - Salta compressão se o ficheiro já é pequeno ou se o output ficar
 *    maior que o original (ex.: PNG pequeno).
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITIES = [0.85, 0.75, 0.6];
const SKIP_BELOW_BYTES = 400 * 1024;          // 400 KB
const HARD_LIMIT_BYTES = 5 * 1024 * 1024;     // 5 MB (alinhado com multer)

export type CompressResult = {
  file: File;
  originalSize: number;
  compressed: boolean;
};

/**
 * Comprime se vale a pena; devolve sempre um `File` pronto a enviar.
 * Falhas (decode, canvas) → devolve o original sem comprimir.
 */
export async function compressImage(file: File): Promise<CompressResult> {
  const originalSize = file.size;

  // GIFs perdem animação se passarem por canvas → não tocar.
  if (file.type === 'image/gif') {
    return { file, originalSize, compressed: false };
  }
  // Não-imagem ou imagem já pequena → passa direto.
  if (!file.type.startsWith('image/') || originalSize <= SKIP_BELOW_BYTES) {
    return { file, originalSize, compressed: false };
  }

  let bitmap: ImageBitmap | HTMLImageElement | null = null;
  let revokeUrl: (() => void) | null = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
    } else {
      const url = URL.createObjectURL(file);
      revokeUrl = () => URL.revokeObjectURL(url);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Falha a decodificar imagem.'));
        img.src = url;
      });
      bitmap = img;
    }

    const srcW = (bitmap as ImageBitmap).width || (bitmap as HTMLImageElement).naturalWidth;
    const srcH = (bitmap as ImageBitmap).height || (bitmap as HTMLImageElement).naturalHeight;
    if (!srcW || !srcH) return { file, originalSize, compressed: false };

    const { width, height } = scaleToFit(srcW, srcH, MAX_DIMENSION);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, originalSize, compressed: false };
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);

    for (const q of JPEG_QUALITIES) {
      const blob = await canvasToBlob(canvas, 'image/jpeg', q);
      if (!blob) continue;
      // Se ficou maior que o original (raro, ex.: PNG pequeno com pouca cor)
      // ou se na 1ª qualidade já está abaixo do limite — usa este blob.
      if (blob.size >= originalSize && q === JPEG_QUALITIES[0]) {
        return { file, originalSize, compressed: false };
      }
      if (blob.size <= HARD_LIMIT_BYTES) {
        const baseName = file.name.replace(/\.[a-z0-9]+$/i, '') || 'image';
        const newFile = new File([blob], `${baseName}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        return { file: newFile, originalSize, compressed: true };
      }
    }

    // Não conseguimos descer abaixo do hard limit nem com q=0.6 → devolve
    // o original e deixa o validador a montante decidir (rejeitar ou enviar).
    return { file, originalSize, compressed: false };
  } catch {
    return { file, originalSize, compressed: false };
  } finally {
    if (bitmap && 'close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      (bitmap as ImageBitmap).close();
    }
    revokeUrl?.();
  }
}

/** Comprime várias imagens em paralelo. */
export function compressImages(files: File[]): Promise<CompressResult[]> {
  return Promise.all(files.map((f) => compressImage(f)));
}

function scaleToFit(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
