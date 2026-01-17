import React, { useState, useRef, useEffect } from 'react';
import { UploadIcon, DownloadIcon, SparklesIcon, WandIcon, LayersIcon } from './Icons';

declare global {
  interface Window {
    SelfieSegmentation: any;
  }
}

type BitStyle = '16bit' | '32bit' | '64bit';

const PixelArtGenerator: React.FC = () => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [processedImg, setProcessedImg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Settings State
  const [bitStyle, setBitStyle] = useState<BitStyle>('32bit');
  const [useColorQuantization, setUseColorQuantization] = useState(true);
  const [outlineColor, setOutlineColor] = useState<string | null>(null); // null = no outline
  const [contrast, setContrast] = useState(1); // 1 = normal
  const [saturation, setSaturation] = useState(1); // 1 = normal

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImgRef = useRef<HTMLImageElement | null>(null);
  const segmentationRef = useRef<any>(null);
  
  // Ref for Settings to avoid stale closures in MediaPipe callback
  const settingsRef = useRef({ bitStyle, useColorQuantization, outlineColor, contrast, saturation });

  useEffect(() => {
    settingsRef.current = { bitStyle, useColorQuantization, outlineColor, contrast, saturation };
  }, [bitStyle, useColorQuantization, outlineColor, contrast, saturation]);

  useEffect(() => {
    const initModel = async () => {
      try {
        const selfieSegmentation = new window.SelfieSegmentation({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });
        selfieSegmentation.setOptions({ modelSelection: 1 }); // 1 = Landscape/High Accuracy
        selfieSegmentation.onResults(onSegmentationResults);
        await selfieSegmentation.initialize();
        segmentationRef.current = selfieSegmentation;
      } catch (err) {
        console.error("Failed to load MediaPipe:", err);
      }
    };
    initModel();
  }, []);

  // Trigger re-processing when style/settings change
  useEffect(() => {
    if (imgSrc && originalImgRef.current && segmentationRef.current) {
        setIsProcessing(true);
        segmentationRef.current.send({ image: originalImgRef.current });
    }
  }, [bitStyle, useColorQuantization, outlineColor, contrast, saturation, imgSrc]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        originalImgRef.current = img;
        setImgSrc(url);
      };
    }
  };

  const onSegmentationResults = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // READ LATEST SETTINGS
    const { 
        bitStyle: currentBitStyle, 
        useColorQuantization: currentQuant,
        outlineColor: currentOutline,
        contrast: currentContrast,
        saturation: currentSat
    } = settingsRef.current;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = results.image.width;
    const height = results.image.height;

    // 1. SETUP CANVAS
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    // 2. DRAW SEGMENTATION MASK & IMAGE (With Adjustments)
    ctx.save();
    ctx.filter = `contrast(${currentContrast}) saturate(${currentSat})`;
    ctx.drawImage(results.segmentationMask, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(results.image, 0, 0, width, height);
    ctx.restore();

    // 3. ADVANCED PIXELATION PIPELINE
    
    // Determine pixel size based on bit style
    let pixelSize = 4;
    let paletteSize = 256;
    if (currentBitStyle === '16bit') { 
        pixelSize = 16;
        paletteSize = 16;
    }
    if (currentBitStyle === '32bit') { 
        pixelSize = 8;
        paletteSize = 64;
    }
    if (currentBitStyle === '64bit') { 
        pixelSize = 4;
        paletteSize = 256;
    }

    const targetWidth = Math.floor(width / pixelSize);
    const targetHeight = Math.floor(height / pixelSize);

    // Offscreen Canvas for Downscaling
    const offCanvas = document.createElement('canvas');
    offCanvas.width = targetWidth;
    offCanvas.height = targetHeight;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    
    if (offCtx) {
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

        const imageData = offCtx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        const originalData = new Uint8ClampedArray(data);

        // Build color palette using k-means clustering
        let palette: number[][] = [];
        if (currentQuant) {
            const colors: number[][] = [];
            for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] > 10) {
                    colors.push([data[i], data[i+1], data[i+2]]);
                }
            }
            
            palette = kMeansPalette(colors, Math.min(paletteSize, colors.length));
        }

        // Parse Outline Color
        let outlineR = 0, outlineG = 0, outlineB = 0;
        if (currentOutline) {
            const hex = currentOutline.replace('#', '');
            outlineR = parseInt(hex.substring(0, 2), 16);
            outlineG = parseInt(hex.substring(2, 4), 16);
            outlineB = parseInt(hex.substring(4, 6), 16);
        }

        // Apply palette reduction
        if (currentQuant && palette.length > 0) {
            for (let y = 0; y < targetHeight; y++) {
                for (let x = 0; x < targetWidth; x++) {
                    const i = (y * targetWidth + x) * 4;
                    
                    if (data[i+3] > 10) {
                        const color = [data[i], data[i+1], data[i+2]];
                        const nearest = findNearestColor(color, palette);
                        data[i] = nearest[0];
                        data[i+1] = nearest[1];
                        data[i+2] = nearest[2];
                    }
                }
            }
        }

        // Outline detection
        if (currentOutline) {
            for (let y = 0; y < targetHeight; y++) {
                for (let x = 0; x < targetWidth; x++) {
                    const i = (y * targetWidth + x) * 4;
                    const isTransparent = originalData[i+3] < 50;
                    
                    if (isTransparent) {
                        const neighbors = [
                            ((y-1) * targetWidth + x) * 4,
                            ((y+1) * targetWidth + x) * 4,
                            (y * targetWidth + (x-1)) * 4,
                            (y * targetWidth + (x+1)) * 4
                        ];

                        let hasOpaqueNeighbor = false;
                        for (const ni of neighbors) {
                            if (ni >= 0 && ni < originalData.length && originalData[ni+3] > 50) {
                                hasOpaqueNeighbor = true;
                                break;
                            }
                        }

                        if (hasOpaqueNeighbor) {
                            data[i] = outlineR;
                            data[i+1] = outlineG;
                            data[i+2] = outlineB;
                            data[i+3] = 255;
                        }
                    }
                }
            }
        }
        
        offCtx.putImageData(imageData, 0, 0);

        // AUTO-CROP: Find bounds of non-transparent pixels
        let minX = targetWidth, minY = targetHeight, maxX = 0, maxY = 0;
        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x++) {
                const i = (y * targetWidth + x) * 4;
                if (imageData.data[i+3] > 10) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        // Add padding (10% on each side)
        const padding = Math.max(2, Math.floor((maxX - minX) * 0.1));
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(targetWidth - 1, maxX + padding);
        maxY = Math.min(targetHeight - 1, maxY + padding);

        const cropWidth = maxX - minX + 1;
        const cropHeight = maxY - minY + 1;

        // Create cropped canvas
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        const croppedCtx = croppedCanvas.getContext('2d')!;
        croppedCtx.drawImage(offCanvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        // Upscale cropped image to fill canvas
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = false;
        
        // Calculate scale to fit canvas while maintaining aspect ratio
        const scaleX = width / (cropWidth * pixelSize);
        const scaleY = height / (cropHeight * pixelSize);
        const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to leave minimal margin
        
        const finalWidth = cropWidth * pixelSize * scale;
        const finalHeight = cropHeight * pixelSize * scale;
        const offsetX = (width - finalWidth) / 2;
        const offsetY = (height - finalHeight) / 2;

        // Draw each pixel from cropped canvas
        const croppedData = croppedCtx.getImageData(0, 0, cropWidth, cropHeight);
        const finalPixelSize = pixelSize * scale;
        
        for (let y = 0; y < cropHeight; y++) {
            for (let x = 0; x < cropWidth; x++) {
                const i = (y * cropWidth + x) * 4;
                if (croppedData.data[i+3] > 0) {
                    const r = croppedData.data[i];
                    const g = croppedData.data[i+1];
                    const b = croppedData.data[i+2];
                    const a = croppedData.data[i+3] / 255;
                    
                    // Main pixel
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
                    ctx.fillRect(
                        offsetX + x * finalPixelSize, 
                        offsetY + y * finalPixelSize, 
                        finalPixelSize, 
                        finalPixelSize
                    );
                    
                    // Subtle highlight for depth (only for larger pixels)
                    if (finalPixelSize >= 6 && a > 0.5) {
                        ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
                        ctx.fillRect(
                            offsetX + x * finalPixelSize, 
                            offsetY + y * finalPixelSize, 
                            finalPixelSize * 0.4, 
                            finalPixelSize * 0.4
                        );
                    }
                }
            }
        }
    }

    setProcessedImg(canvas.toDataURL('image/png'));
    setIsProcessing(false);
  };

  // K-means clustering for palette reduction
  function kMeansPalette(colors: number[][], k: number): number[][] {
    if (colors.length === 0) return [];
    if (colors.length <= k) return colors;
    
    // Initialize centroids randomly
    const centroids: number[][] = [];
    const step = Math.floor(colors.length / k);
    for (let i = 0; i < k; i++) {
      centroids.push([...colors[i * step]]);
    }
    
    // Run k-means for 5 iterations (enough for pixel art)
    for (let iter = 0; iter < 5; iter++) {
      const clusters: number[][][] = Array(k).fill(null).map(() => []);
      
      // Assign colors to nearest centroid
      for (const color of colors) {
        let minDist = Infinity;
        let bestCluster = 0;
        
        for (let j = 0; j < k; j++) {
          const dist = colorDistance(color, centroids[j]);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = j;
          }
        }
        
        clusters[bestCluster].push(color);
      }
      
      // Update centroids
      for (let j = 0; j < k; j++) {
        if (clusters[j].length > 0) {
          const avgR = clusters[j].reduce((sum, c) => sum + c[0], 0) / clusters[j].length;
          const avgG = clusters[j].reduce((sum, c) => sum + c[1], 0) / clusters[j].length;
          const avgB = clusters[j].reduce((sum, c) => sum + c[2], 0) / clusters[j].length;
          centroids[j] = [Math.round(avgR), Math.round(avgG), Math.round(avgB)];
        }
      }
    }
    
    return centroids;
  }

  function findNearestColor(color: number[], palette: number[][]): number[] {
    let minDist = Infinity;
    let nearest = palette[0];
    
    for (const paletteColor of palette) {
      const dist = colorDistance(color, paletteColor);
      if (dist < minDist) {
        minDist = dist;
        nearest = paletteColor;
      }
    }
    
    return nearest;
  }

  function colorDistance(c1: number[], c2: number[]): number {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return dr * dr + dg * dg + db * db;
  }

  const handleDownload = () => {
    if (processedImg) {
      const a = document.createElement('a');
      a.href = processedImg;
      a.download = `pixel-art-${bitStyle}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Controls */}
        <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-2xl flex flex-col gap-5">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   <WandIcon /> Pixel Studio <span className="text-[#4cbd6c] text-xs px-2 py-0.5 bg-[#4cbd6c]/10 rounded border border-[#4cbd6c]/20">PRO</span>
                 </h3>
                 
                 {/* Upload */}
                 <div 
                    onClick={() => document.getElementById('pixel-upload')?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-[#4cbd6c] bg-slate-800/50 hover:bg-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group"
                 >
                    {imgSrc ? (
                         <div className="relative w-full h-32 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-700">
                            <img src={imgSrc} alt="source" className="h-full object-contain" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[#4cbd6c] font-bold text-sm tracking-wider">REPLACE IMAGE</div>
                         </div>
                    ) : (
                        <>
                            <div className="p-3 bg-slate-800 rounded-full text-[#4cbd6c] group-hover:scale-110 transition-transform"><UploadIcon /></div>
                            <span className="text-sm text-slate-400 font-medium">Upload Source Image</span>
                        </>
                    )}
                    <input id="pixel-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                 </div>

                 {/* Settings Panel */}
                 <div className={`space-y-6 ${!imgSrc ? 'opacity-50 pointer-events-none' : ''}`}>
                    
                    {/* Resolution / Style */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bit Resolution</label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                             {(['16bit', '32bit', '64bit'] as BitStyle[]).map((style) => (
                                 <button 
                                    key={style}
                                    onClick={() => setBitStyle(style)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${bitStyle === style ? 'bg-[#4cbd6c]/20 border-[#4cbd6c] text-[#4cbd6c]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                 >
                                    {style.toUpperCase()}
                                 </button>
                             ))}
                        </div>
                    </div>

                    {/* Pre-Processing (Adjustments) */}
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Image Adjustments</label>
                        
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Contrast</span>
                                <span>{Math.round(contrast * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="0.5" max="2" step="0.1" 
                                value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-[#4cbd6c]"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Saturation</span>
                                <span>{Math.round(saturation * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="3" step="0.1" 
                                value={saturation} onChange={(e) => setSaturation(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-[#4cbd6c]"
                            />
                        </div>
                    </div>

                    {/* Post-Processing (Outline) */}
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Pixel Outline</span>
                            <span className="text-[10px] text-slate-500">Adds 1px border around sprite</span>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setOutlineColor(null)}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${outlineColor === null ? 'border-[#4cbd6c] scale-110' : 'border-slate-600 bg-transparent'}`}
                                title="No Outline"
                            >
                                <div className="w-full h-full relative">
                                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 -rotate-45 transform"></div>
                                </div>
                            </button>
                            <button 
                                onClick={() => setOutlineColor('#000000')}
                                className={`w-6 h-6 rounded-full bg-black border-2 transition-all ${outlineColor === '#000000' ? 'border-[#4cbd6c] scale-110' : 'border-slate-600'}`}
                                title="Black Outline"
                            />
                            <button 
                                onClick={() => setOutlineColor('#ffffff')}
                                className={`w-6 h-6 rounded-full bg-white border-2 transition-all ${outlineColor === '#ffffff' ? 'border-[#4cbd6c] scale-110' : 'border-slate-600'}`}
                                title="White Outline"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                        <span className="text-xs font-bold text-slate-400 uppercase">Retro Palette</span>
                        <div className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors ${useColorQuantization ? 'bg-[#4cbd6c]' : 'bg-slate-600'}`} onClick={() => setUseColorQuantization(!useColorQuantization)}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${useColorQuantization ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </div>
                    </div>

                    <button 
                        onClick={handleDownload}
                        disabled={isProcessing}
                        className="w-full py-4 bg-[#4cbd6c] hover:bg-[#3da35b] text-white rounded-xl font-bold text-sm tracking-wide uppercase shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        <DownloadIcon />
                        Download Asset (PNG)
                    </button>
                 </div>
            </div>
        </div>

        {/* RIGHT: Preview */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center bg-[#1c1917] rounded-2xl border border-slate-800 min-h-[600px] relative p-8 shadow-inner">
             {/* Hidden Processing Canvas */}
             <canvas ref={canvasRef} className="hidden" />

             {!imgSrc ? (
                 <div className="text-slate-600 flex flex-col items-center">
                    <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                        <SparklesIcon />
                    </div>
                    <span className="font-medium">Upload a photo to magic transform</span>
                    <span className="text-sm text-slate-700 mt-2">Supports JPG, PNG with auto-segmentation</span>
                 </div>
             ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                    {isProcessing && (
                         <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-xl">
                            <div className="w-12 h-12 border-4 border-[#4cbd6c] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[#4cbd6c] mt-4 font-mono text-xs tracking-widest uppercase">Processing...</span>
                         </div>
                    )}
                    {/* Display Result */}
                    {processedImg && (
                        <div className="relative group">
                            <img 
                                src={processedImg} 
                                alt="pixel-art-result" 
                                className="max-w-full max-h-[70vh] object-contain shadow-2xl bg-[url('https://upload.wikimedia.org/wikipedia/commons/2/23/Transparency_checkered_background.jpg')] bg-contain rounded-lg border border-slate-700" 
                                style={{imageRendering: 'pixelated'}}
                            />
                            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full text-xs text-white font-mono border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {bitStyle} | Outline: {outlineColor ? 'ON' : 'OFF'}
                            </div>
                        </div>
                    )}
                </div>
             )}
        </div>

      </div>
    </div>
  );
};

export default PixelArtGenerator;