export interface AnimationOptions {
  fps: number;
  loop: number; // 0 = infinite
  reverse: boolean; // ping-pong effect
  quality: number; // 1-10 for GIF
}

export interface AnimationFrame {
  id: string;
  dataUrl: string;
  delay?: number; // optional custom delay in ms
}

/**
 * Create animated GIF from frames
 */
export async function createGIF(
  frames: AnimationFrame[],
  options: AnimationOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Dynamic import to avoid loading gif.js if not needed
    import('gif.js').then((module) => {
      const GIF = (module as any).default || module;
      
      // Load first frame to get dimensions
      const img = new Image();
      img.onload = () => {
        const gif = new GIF({
          workers: 2,
          quality: options.quality,
          width: img.width,
          height: img.height,
          repeat: options.loop,
          workerScript: '/node_modules/gif.js/dist/gif.worker.js'
        });

        const delay = Math.floor(1000 / options.fps);
        const framesToProcess = options.reverse 
          ? [...frames, ...frames.slice().reverse()] 
          : frames;

        let loadedCount = 0;
        const images: HTMLImageElement[] = [];

        // Load all images first
        framesToProcess.forEach((frame, index) => {
          const frameImg = new Image();
          frameImg.onload = () => {
            images[index] = frameImg;
            loadedCount++;

            if (loadedCount === framesToProcess.length) {
              // All images loaded, add to GIF
              images.forEach((img, i) => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                
                gif.addFrame(canvas, { 
                  delay: framesToProcess[i].delay || delay 
                });
              });

              gif.on('finished', (blob: Blob) => {
                resolve(blob);
              });

              gif.on('error', (error: Error) => {
                reject(error);
              });

              gif.render();
            }
          };
          frameImg.onerror = () => reject(new Error(`Failed to load frame ${index}`));
          frameImg.src = frame.dataUrl;
        });
      };
      img.onerror = () => reject(new Error('Failed to load first frame'));
      img.src = frames[0].dataUrl;
    }).catch(reject);
  });
}

/**
 * Create animated WebP from frames
 * Note: Browser support varies, works best in Chrome/Edge
 */
export async function createWebP(
  frames: AnimationFrame[],
  options: AnimationOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;

      const delay = Math.floor(1000 / options.fps);
      const framesToProcess = options.reverse 
        ? [...frames, ...frames.slice().reverse()] 
        : frames;

      // For WebP, we'll create individual frames and let the browser handle it
      // This is a simplified version - true animated WebP requires WebCodecs API
      // For now, we'll create a high-quality static WebP of the first frame
      // TODO: Implement proper animated WebP when WebCodecs API is more widely supported
      
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create WebP'));
        }
      }, 'image/webp', 0.9);
    };
    img.onerror = () => reject(new Error('Failed to load first frame'));
    img.src = frames[0].dataUrl;
  });
}

/**
 * Optimize frames by resizing if too large
 */
export function optimizeFrames(
  frames: AnimationFrame[],
  maxDimension: number = 800
): Promise<AnimationFrame[]> {
  return Promise.all(
    frames.map((frame) => {
      return new Promise<AnimationFrame>((resolve) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);

          resolve({
            ...frame,
            dataUrl: canvas.toDataURL('image/png')
          });
        };
        img.src = frame.dataUrl;
      });
    })
  );
}

/**
 * Download blob as file
 */
export function downloadAnimation(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
