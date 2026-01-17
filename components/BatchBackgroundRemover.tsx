import React, { useState, useRef, useEffect } from 'react';
import { UploadIcon, DownloadIcon, XIcon, WandIcon, LayersIcon } from './Icons';
import JSZip from 'jszip';

interface ProcessedImage {
  id: string;
  originalName: string;
  originalUrl: string;
  processedUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

declare global {
  interface Window {
    SelfieSegmentation: any;
  }
}

const BatchBackgroundRemover: React.FC = () => {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const segmentationRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Settings
  const [qualityMode, setQualityMode] = useState(1); // 1 = High Accuracy
  const [edgeBlur, setEdgeBlur] = useState(2);

  useEffect(() => {
    let isMounted = true;
    
    const initModel = async () => {
      try {
        const selfieSegmentation = new window.SelfieSegmentation({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });
        
        selfieSegmentation.setOptions({ modelSelection: qualityMode });
        selfieSegmentation.onResults(handleSegmentationResults);
        await selfieSegmentation.initialize();
        
        if (isMounted) {
          segmentationRef.current = selfieSegmentation;
          setIsModelLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load MediaPipe:", err);
      }
    };
    
    initModel();
    
    return () => { isMounted = false; };
  }, [qualityMode]);

  // Handle results from MediaPipe (called specifically when processing queue)
  const handleSegmentationResults = (results: any) => {
    // This function is just a placeholder here.
    // In sequential processing, we handle results directly in the loop or promise chain 
    // but MediaPipe's onResults is a callback. 
    // We'll use a Promise-based wrapper properly in processQueue.
  };

  const processImageOneByOne = async (imgElement: HTMLImageElement): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!segmentationRef.current || !canvasRef.current) {
        reject('Model or canvas not ready');
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
         reject('Canvas context failed');
         return;
      }

      // One-time result handler for this specific image
      segmentationRef.current.onResults((results: any) => {
          canvas.width = results.image.width;
          canvas.height = results.image.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          ctx.save();
          // Draw mask with blur
          if (edgeBlur > 0) ctx.filter = `blur(${edgeBlur}px)`;
          ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
          ctx.filter = 'none';
          
          // Composite
          ctx.globalCompositeOperation = 'source-in';
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          
          resolve(canvas.toDataURL('image/png'));
      });

      segmentationRef.current.send({ image: imgElement });
    });
  };

  const processQueue = async (queue: ProcessedImage[]) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: queue.length });

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (item.status === 'completed') {
             setProgress(p => ({ ...p, current: p.current + 1 }));
             continue;
        }

        // Update status to processing
        setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'processing' } : img));

        try {
            // Load image element
            const img = new Image();
            img.src = item.originalUrl;
            img.crossOrigin = "anonymous";
            await new Promise((r) => { img.onload = r; });

            // Process
            const resultUrl = await processImageOneByOne(img);

            // Update status to completed
            setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'completed', processedUrl: resultUrl } : img));
        } catch (error) {
            console.error(error);
            setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'error' } : img));
        }
        
        setProgress(p => ({ ...p, current: p.current + 1 }));
    }

    setIsProcessing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: ProcessedImage[] = Array.from(files).map((file: File, idx) => ({
      id: `${Date.now()}-${idx}`,
      originalName: file.name,
      originalUrl: URL.createObjectURL(file),
      processedUrl: null,
      status: 'pending'
    }));

    setImages(prev => [...prev, ...newImages]);
    
    // Auto start processing if not already running
    if (!isProcessing) {
        // We need to pass the FULL updated list including new ones, but state update is async.
        // So we pass newImages combined with potentially pending old ones.
        // Actually, easiest is to wait for effect or just trigger processQueue with newImages appended locally
        // A standard approach is to let effect handle it or just trigger manually button.
        // Let's trigger manually or auto. I'll make a button "Start Processing" to be safe, or auto.
        // Auto is better user experience.
        setTimeout(() => processQueue([...images, ...newImages].filter(i => i.status === 'pending')), 500); 
    } else {
        // If already processing, the loop won't pick up new ones dynamically effortlessly 
        // without more complex queue logic. 
        // For 'MVP', let's just add to state and user clicks "Process Pending" if needed, 
        // or we rely on the loop finishing and user triggering again.
        // Let's add a "Process All Pending" button.
    }
  };

  const handleDownloadAll = async () => {
     const zip = new JSZip();
     const processed = images.filter(img => img.status === 'completed' && img.processedUrl);
     
     if (processed.length === 0) return;

     processed.forEach(img => {
         const data = img.processedUrl!.split(',')[1];
         zip.file(`processed_${img.originalName.replace(/\.[^/.]+$/, "")}.png`, data, {base64: true});
     });

     const content = await zip.generateAsync({type:"blob"});
     const link = document.createElement('a');
     link.href = URL.createObjectURL(content);
     link.download = `batch_removed_${Date.now()}.zip`;
     link.click();
  };
  
  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.originalUrl));
    setImages([]);
    setProgress({ current: 0, total: 0 });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    <LayersIcon /> Batch Background Remover
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                    Process multiple images automatically.
                </p>
             </div>
             
             <div className="flex gap-3">
                 {isModelLoaded ? (
                     <div className="text-[#4cbd6c] text-xs font-bold px-3 py-1 bg-[#4cbd6c]/10 rounded border border-[#4cbd6c]/20 flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#4cbd6c] rounded-full animate-pulse"></div> AI Ready
                     </div>
                 ) : (
                     <div className="text-orange-400 text-xs font-bold px-3 py-1 bg-orange-400/10 rounded border border-orange-400/20 flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-spin"></div> Loading Image Model...
                     </div>
                 )}
             </div>
        </div>

        {/* Upload Area */}
        <div 
            onClick={() => isModelLoaded && document.getElementById('batch-upload')?.click()}
            className={`border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/50 hover:bg-slate-800 rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group ${!isModelLoaded ? 'opacity-50 pointer-events-none' : ''}`}
        >
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform text-indigo-500">
                <UploadIcon />
            </div>
            <div className="text-center">
                <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">Drag & Drop or Click to Upload</h4>
                <p className="text-slate-400 text-sm mt-1">Supports PNG, JPG, WebP (Multiple files)</p>
            </div>
            <input id="batch-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>

        {/* Controls */}
        {images.length > 0 && (
            <div className="flex flex-wrap gap-4 mt-6 justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                 <div className="flex items-center gap-4">
                     {isProcessing ? (
                         <div className="flex items-center gap-3">
                             <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                             <span className="text-indigo-400 font-bold text-sm">Processing {progress.current}/{progress.total}</span>
                         </div>
                     ) : (
                         <span className="text-slate-300 font-medium text-sm">{images.length} images loaded</span>
                     )}
                 </div>

                 <div className="flex gap-3">
                     <button 
                        onClick={clearAll}
                        disabled={isProcessing}
                        className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                     >
                        Clear All
                     </button>
                     
                     {!isProcessing && images.some(i => i.status === 'pending') && (
                         <button 
                            onClick={() => processQueue(images)}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2"
                         >
                            <WandIcon /> Process Pending
                         </button>
                     )}

                     {images.some(i => i.status === 'completed') && (
                         <button 
                            onClick={handleDownloadAll}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                         >
                            <DownloadIcon /> Download All (ZIP)
                         </button>
                     )}
                 </div>
            </div>
        )}

        {/* Results Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-6">
            {images.map(img => (
                <div key={img.id} className="relative aspect-square bg-[#1c1917] bg-[url('https://upload.wikimedia.org/wikipedia/commons/2/23/Transparency_checkered_background.jpg')] bg-contain rounded-xl overflow-hidden border border-slate-700 group">
                    {/* Status Overlay */}
                    {img.status === 'processing' && (
                        <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                    {img.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500/80 z-10 flex items-center justify-center text-white font-bold text-xs">Error</div>
                    )}
                    
                    {/* Image Content */}
                    <img 
                        src={img.status === 'completed' && img.processedUrl ? img.processedUrl : img.originalUrl} 
                        alt="thumb" 
                        className="w-full h-full object-contain"
                    />
                    
                    {/* Type Badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded text-[10px] text-white font-mono backdrop-blur-sm">
                        {img.status === 'completed' ? 'PROCESSED' : 'ORIGINAL'}
                    </div>

                    {/* Actions on Hover */}
                    {img.status === 'completed' && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <a 
                                href={img.processedUrl!} 
                                download={`processed_${img.originalName}`}
                                className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                                title="Download"
                             >
                                <DownloadIcon />
                             </a>
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default BatchBackgroundRemover;
