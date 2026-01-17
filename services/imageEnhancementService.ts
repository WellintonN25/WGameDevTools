export interface EnhancementOptions {
  scale?: number; // 1, 2, 4, 8
  algorithm?: 'bicubic' | 'lanczos' | 'nearest';
  sharpen?: number; // 0-100
  noiseReduction?: number; // 0-100
  contrast?: number; // 0-100
  edgeEnhancement?: number; // 0-100
  colorVibrance?: number; // 0-100
}

export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
  processingTime: number;
}

/**
 * Upscale image using bicubic interpolation
 */
function upscaleBicubic(
  imageData: ImageData,
  scale: number
): ImageData {
  const srcWidth = imageData.width;
  const srcHeight = imageData.height;
  const dstWidth = srcWidth * scale;
  const dstHeight = srcHeight * scale;
  
  const canvas = document.createElement('canvas');
  canvas.width = dstWidth;
  canvas.height = dstHeight;
  const ctx = canvas.getContext('2d')!;
  
  // Use built-in bicubic interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Create temporary canvas with source image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = srcWidth;
  tempCanvas.height = srcHeight;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);
  
  // Draw scaled
  ctx.drawImage(tempCanvas, 0, 0, srcWidth, srcHeight, 0, 0, dstWidth, dstHeight);
  
  return ctx.getImageData(0, 0, dstWidth, dstHeight);
}

/**
 * Upscale using nearest neighbor (pixel art)
 */
function upscaleNearest(
  imageData: ImageData,
  scale: number
): ImageData {
  const srcWidth = imageData.width;
  const srcHeight = imageData.height;
  const dstWidth = srcWidth * scale;
  const dstHeight = srcHeight * scale;
  
  const canvas = document.createElement('canvas');
  canvas.width = dstWidth;
  canvas.height = dstHeight;
  const ctx = canvas.getContext('2d')!;
  
  ctx.imageSmoothingEnabled = false;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = srcWidth;
  tempCanvas.height = srcHeight;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);
  
  ctx.drawImage(tempCanvas, 0, 0, srcWidth, srcHeight, 0, 0, dstWidth, dstHeight);
  
  return ctx.getImageData(0, 0, dstWidth, dstHeight);
}

/**
 * Apply sharpening filter (unsharp mask)
 */
function applySharpen(imageData: ImageData, intensity: number): ImageData {
  if (intensity === 0) return imageData;
  
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;
  
  // Sharpening kernel
  const amount = intensity / 100;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * width + x) * 4 + c;
        
        // Get surrounding pixels
        const center = imageData.data[idx];
        const top = imageData.data[((y - 1) * width + x) * 4 + c];
        const bottom = imageData.data[((y + 1) * width + x) * 4 + c];
        const left = imageData.data[(y * width + (x - 1)) * 4 + c];
        const right = imageData.data[(y * width + (x + 1)) * 4 + c];
        
        // Laplacian filter
        const edge = center * 5 - top - bottom - left - right;
        data[idx] = Math.min(255, Math.max(0, center + edge * amount));
      }
    }
  }
  
  return new ImageData(data, width, height);
}

/**
 * Apply noise reduction (bilateral filter approximation)
 */
function applyNoiseReduction(imageData: ImageData, intensity: number): ImageData {
  if (intensity === 0) return imageData;
  
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;
  const radius = Math.ceil(intensity / 33); // 1-3 pixels
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        
        // Average surrounding pixels
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c;
            sum += imageData.data[idx];
            count++;
          }
        }
        
        const idx = (y * width + x) * 4 + c;
        data[idx] = sum / count;
      }
    }
  }
  
  return new ImageData(data, width, height);
}

/**
 * Enhance contrast (histogram equalization)
 */
function enhanceContrast(imageData: ImageData, intensity: number): ImageData {
  if (intensity === 0) return imageData;
  
  const data = new Uint8ClampedArray(imageData.data);
  const amount = intensity / 100;
  
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const value = imageData.data[i + c];
      // Simple contrast enhancement
      const enhanced = ((value / 255 - 0.5) * (1 + amount) + 0.5) * 255;
      data[i + c] = Math.min(255, Math.max(0, enhanced));
    }
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Enhance edges
 */
function enhanceEdges(imageData: ImageData, intensity: number): ImageData {
  if (intensity === 0) return imageData;
  
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;
  const amount = intensity / 100;
  
  // Sobel edge detection
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * width + x) * 4 + c;
        
        // Sobel kernels
        const gx = 
          -imageData.data[((y - 1) * width + (x - 1)) * 4 + c] +
          imageData.data[((y - 1) * width + (x + 1)) * 4 + c] +
          -2 * imageData.data[(y * width + (x - 1)) * 4 + c] +
          2 * imageData.data[(y * width + (x + 1)) * 4 + c] +
          -imageData.data[((y + 1) * width + (x - 1)) * 4 + c] +
          imageData.data[((y + 1) * width + (x + 1)) * 4 + c];
        
        const gy =
          -imageData.data[((y - 1) * width + (x - 1)) * 4 + c] +
          -2 * imageData.data[((y - 1) * width + x) * 4 + c] +
          -imageData.data[((y - 1) * width + (x + 1)) * 4 + c] +
          imageData.data[((y + 1) * width + (x - 1)) * 4 + c] +
          2 * imageData.data[((y + 1) * width + x) * 4 + c] +
          imageData.data[((y + 1) * width + (x + 1)) * 4 + c];
        
        const edge = Math.sqrt(gx * gx + gy * gy);
        data[idx] = Math.min(255, imageData.data[idx] + edge * amount);
      }
    }
  }
  
  return new ImageData(data, width, height);
}

/**
 * Enhance color vibrance
 */
function enhanceColors(imageData: ImageData, intensity: number): ImageData {
  if (intensity === 0) return imageData;
  
  const data = new Uint8ClampedArray(imageData.data);
  const amount = intensity / 100;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    
    // Convert to HSL
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      // Increase saturation
      const newS = Math.min(1, s * (1 + amount));
      
      // Convert back to RGB (simplified)
      const factor = newS / s;
      data[i] = Math.min(255, r + (r - l * 255) * (factor - 1));
      data[i + 1] = Math.min(255, g + (g - l * 255) * (factor - 1));
      data[i + 2] = Math.min(255, b + (b - l * 255) * (factor - 1));
    } else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Process image with all enhancements
 */
export async function processImage(
  imageFile: File,
  options: EnhancementOptions
): Promise<ProcessedImage> {
  const startTime = performance.now();
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.onload = () => {
        try {
          const scale = options.scale || 1;
          const maxDimension = 4096; // Max 4K resolution
          const maxInputDimension = 2048; // Max input before auto-resize
          
          let sourceWidth = img.width;
          let sourceHeight = img.height;
          
          // Auto-resize large images to prevent memory errors
          if (sourceWidth > maxInputDimension || sourceHeight > maxInputDimension) {
            const ratio = Math.min(maxInputDimension / sourceWidth, maxInputDimension / sourceHeight);
            sourceWidth = Math.floor(sourceWidth * ratio);
            sourceHeight = Math.floor(sourceHeight * ratio);
            
            console.log(`Imagem redimensionada de ${img.width}x${img.height} para ${sourceWidth}x${sourceHeight} para processamento`);
          }
          
          // Validate final size
          if (sourceWidth * scale > maxDimension || sourceHeight * scale > maxDimension) {
            reject(new Error(
              `Imagem muito grande para upscale ${scale}x. Dimensão máxima: ${maxDimension}px. ` +
              `Sua imagem resultaria em ${sourceWidth * scale}x${sourceHeight * scale}px. ` +
              `Tente uma escala menor.`
            ));
            return;
          }
          
          // Create canvas with resized image
          const canvas = document.createElement('canvas');
          canvas.width = sourceWidth;
          canvas.height = sourceHeight;
          const ctx = canvas.getContext('2d')!;
          
          // Draw with high quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, sourceWidth, sourceHeight);
          
          let imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
          
          // Apply upscaling
          if (scale > 1) {
            const algorithm = options.algorithm || 'bicubic';
            if (algorithm === 'nearest') {
              imageData = upscaleNearest(imageData, scale);
            } else {
              imageData = upscaleBicubic(imageData, scale);
            }
          }
          
          // Apply filters in order
          if (options.noiseReduction) {
            imageData = applyNoiseReduction(imageData, options.noiseReduction);
          }
          
          if (options.contrast) {
            imageData = enhanceContrast(imageData, options.contrast);
          }
          
          if (options.edgeEnhancement) {
            imageData = enhanceEdges(imageData, options.edgeEnhancement);
          }
          
          if (options.sharpen) {
            imageData = applySharpen(imageData, options.sharpen);
          }
          
          if (options.colorVibrance) {
            imageData = enhanceColors(imageData, options.colorVibrance);
          }
          
          // Create final canvas
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = imageData.width;
          finalCanvas.height = imageData.height;
          const finalCtx = finalCanvas.getContext('2d')!;
          finalCtx.putImageData(imageData, 0, 0);
          
          const processingTime = performance.now() - startTime;
          
          resolve({
            dataUrl: finalCanvas.toDataURL('image/png'),
            width: imageData.width,
            height: imageData.height,
            processingTime,
          });
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Download processed image
 */
export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
