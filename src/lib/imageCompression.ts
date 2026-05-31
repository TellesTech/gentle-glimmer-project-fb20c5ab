/**
 * Utilitário de compressão de imagens
 * Redimensiona e comprime imagens antes do upload para otimizar performance
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
  preserveTransparency?: boolean;
  outputFormat?: 'auto' | 'jpeg' | 'png';
}

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
  format: 'image/jpeg' | 'image/png';
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.7,
  maxSizeKB: 500,
  preserveTransparency: false,
  outputFormat: 'auto',
};

/**
 * Comprime uma imagem para o tamanho máximo especificado
 */
export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<CompressionResult> {
  const { maxWidth, maxHeight, quality, maxSizeKB, preserveTransparency, outputFormat } = {
    ...DEFAULT_OPTIONS,
    preserveTransparency: false,
    outputFormat: 'auto' as const,
    ...options,
  };

  const originalSize = file.size;
  
  // Detectar se é PNG transparente
  const isPng = file.type === 'image/png';
  
  // Determinar formato de saída
  let format: 'image/jpeg' | 'image/png' = 'image/jpeg';
  if (outputFormat === 'png' || (outputFormat === 'auto' && preserveTransparency && isPng)) {
    format = 'image/png';
  } else if (outputFormat === 'jpeg') {
    format = 'image/jpeg';
  }

  // Carregar imagem
  const img = await loadImage(file);
  
  // Calcular novas dimensões
  let { width, height } = calculateDimensions(
    img.width,
    img.height,
    maxWidth,
    maxHeight
  );

  // Comprimir iterativamente até atingir o tamanho máximo
  let currentQuality = quality;
  let blob: Blob;
  let attempts = 0;
  const maxAttempts = 5;
  const targetSize = maxSizeKB * 1024;

  do {
    blob = await createCompressedBlob(img, width, height, currentQuality, format);
    
    // Se ainda está muito grande, reduzir qualidade ou dimensões
    if (blob.size > targetSize && attempts < maxAttempts) {
      if (currentQuality > 0.3) {
        currentQuality -= 0.1;
      } else {
        // Reduzir dimensões em 20%
        width = Math.round(width * 0.8);
        height = Math.round(height * 0.8);
        currentQuality = quality; // Resetar qualidade
      }
    }
    
    attempts++;
  } while (blob.size > targetSize && attempts < maxAttempts);

  const compressedSize = blob.size;
  const compressionRatio = 1 - (compressedSize / originalSize);

  return {
    blob,
    originalSize,
    compressedSize,
    compressionRatio,
    width,
    height,
    format,
  };
}

/**
 * Comprime múltiplas imagens em paralelo
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<{ results: CompressionResult[]; totalSaved: number }> {
  const results = await Promise.all(
    files.map(file => compressImage(file, options))
  );

  const totalSaved = results.reduce(
    (acc, r) => acc + (r.originalSize - r.compressedSize),
    0
  );

  return { results, totalSaved };
}

/**
 * Carrega um arquivo de imagem como HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };
    
    img.src = url;
  });
}

/**
 * Calcula novas dimensões mantendo a proporção
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  return { width, height };
}

/**
 * Cria um blob comprimido a partir de uma imagem
 */
function createCompressedBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Falha ao criar contexto do canvas'));
      return;
    }

    // Usar melhor qualidade de interpolação
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Se JPEG, preencher fundo branco (não tem transparência)
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }
    // Se PNG, não preencher - manter transparência
    
    ctx.drawImage(img, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Falha ao criar blob'));
        }
      },
      format,
      quality
    );
  });
}

/**
 * Formata o tamanho do arquivo para exibição
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
