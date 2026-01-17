import React, { useRef, useState, useEffect } from 'react';
import { UploadIcon, PlayIcon, PauseIcon, DownloadIcon, SparklesIcon, LayersIcon, PlusIcon, TrashIcon, EyeIcon } from './Icons';

declare global {
  interface Window {
    GIF: any;
  }
}

/* -------------------------------------------------------------------------- */
/*                               PHYSICS ENGINE CONSTANTS                      */
/* -------------------------------------------------------------------------- */

type AnimationType = 'idle' | 'wind' | 'water' | 'fire' | 'pulse' | 'wobble' | 'spiral';
type ExportFormat = 'gif' | 'webm';

interface PhysicsConfig {
  type: AnimationType;
  amplitude: number;
  frequency: number;
  speed: number;
  directionX: number;
  directionY: number;
  turbulence: number;
}

interface AnimationLayer {
  id: string;
  name: string;
  isVisible: boolean;
  color: string; // Color for mask overlay
  config: PhysicsConfig;
}

const LAYER_COLORS = [
  'rgba(255, 50, 50, 0.4)',    // Red
  'rgba(50, 255, 50, 0.4)',    // Green
  'rgba(50, 100, 255, 0.4)',   // Blue
  'rgba(255, 255, 50, 0.4)',   // Yellow
  'rgba(255, 50, 255, 0.4)',   // Magenta
  'rgba(50, 255, 255, 0.4)'    // Cyan
];

const DEFAULT_CONFIGS: Record<AnimationType, PhysicsConfig> = {
  idle: { type: 'idle', amplitude: 3, frequency: 1, speed: 0.05, directionX: 0, directionY: 0, turbulence: 0 },
  wind: { type: 'wind', amplitude: 12, frequency: 2, speed: 0.15, directionX: 1, directionY: 0.2, turbulence: 0.5 },
  water: { type: 'water', amplitude: 8, frequency: 1.5, speed: 0.08, directionX: 0, directionY: 1, turbulence: 0.2 },
  fire: { type: 'fire', amplitude: 10, frequency: 3, speed: 0.2, directionX: 0, directionY: -1, turbulence: 0.8 },
  pulse: { type: 'pulse', amplitude: 6, frequency: 4, speed: 0.1, directionX: 0, directionY: 0, turbulence: 0 },
  wobble: { type: 'wobble', amplitude: 10, frequency: 2, speed: 0.1, directionX: 0, directionY: 0, turbulence: 0 },
  spiral: { type: 'spiral', amplitude: 8, frequency: 1, speed: 0.05, directionX: 0, directionY: 0, turbulence: 0 }
};

/* -------------------------------------------------------------------------- */
/*                               GRID MESH SYSTEM                              */
/* -------------------------------------------------------------------------- */

interface Point {
  x: number; // Current X
  y: number; // Current Y
  ox: number; // Original X
  oy: number; // Original Y
  weights: Record<string, number>; // Weights per layer ID
}

class GridMesh {
  cols: number;
  rows: number;
  width: number;
  height: number;
  points: Point[];

  constructor(width: number, height: number, density: number = 20) {
    this.width = width;
    this.height = height;
    const aspect = width / height;
    this.cols = Math.floor(density * aspect);
    this.rows = density;
    this.points = [];
    
    for (let y = 0; y <= this.rows; y++) {
      for (let x = 0; x <= this.cols; x++) {
        const u = x / this.cols;
        const v = y / this.rows;
        const px = u * width;
        const py = v * height;
        this.points.push({
          x: px, y: py,
          ox: px, oy: py,
          weights: {} // Initialize empty weights
        });
      }
    }
  }

  // Brush tool to paint influence for a specific layer
  brush(cx: number, cy: number, radius: number, strength: number, isEraser: boolean, layerId: string) {
    for (let p of this.points) {
      const dx = p.ox - cx;
      const dy = p.oy - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < radius) {
        // Smooth falloff
        const falloff = 1 - (dist / radius);
        const change = falloff * strength;
        
        const currentWeight = p.weights[layerId] || 0;
        let newWeight = currentWeight;

        if (isEraser) {
          newWeight = Math.max(0, currentWeight - change);
        } else {
          newWeight = Math.min(1, currentWeight + change);
        }
        
        p.weights[layerId] = newWeight;
      }
    }
  }

  fillWeights(layerId: string) {
    this.points.forEach(p => p.weights[layerId] = 1);
  }

  clearWeights(layerId: string) {
    this.points.forEach(p => p.weights[layerId] = 0);
  }

  // Calculate displacement for a point based on a specific layer config
  calculateDisplacement(p: Point, t: number, config: PhysicsConfig): { dx: number, dy: number } {
    let dx = 0, dy = 0;

    if (config.type === 'idle') {
      // Natural Breathing: Radial expansion from center
      const cx = this.width / 2;
      const cy = this.height / 2;
      const dist = Math.sqrt((p.ox - cx)**2 + (p.oy - cy)**2);
      const normDist = dist / (this.width * 0.5);
      // Slow sine wave
      const breath = Math.sin(t * config.frequency) * config.amplitude * Math.max(0, 1 - normDist); 
      // Push slightly up and out
      dx = ((p.ox - cx) / dist || 0) * breath * 0.5;
      dy = (((p.oy - cy) / dist || 0) * breath) - (breath * 0.5); // Slight lift

    } else if (config.type === 'wind') {
      const noise = Math.sin(p.ox * 0.02 + p.oy * 0.02 + t) + 
                    Math.cos(p.oy * 0.05 + t * 1.5) * config.turbulence;
      dx = (Math.cos(t) + noise) * config.amplitude * config.directionX;
      dy = (Math.sin(t * 0.7) + noise) * config.amplitude * config.directionY;

    } else if (config.type === 'water') {
      // Ripple effect
      const wave1 = Math.sin(p.ox * 0.05 + t * 2);
      const wave2 = Math.cos(p.oy * 0.05 + t * 1.5);
      dx = wave2 * config.amplitude * 0.3;
      dy = wave1 * config.amplitude;

    } else if (config.type === 'fire') {
      // Heat Shimmer
      const noiseX = Math.sin(p.ox * 0.1 + t * 5) * Math.cos(p.oy * 0.05 + t * 2);
      const noiseY = Math.sin(p.oy * 0.1 + t * 3);
      dx = noiseX * (config.amplitude * 0.5);
      dy = noiseY * config.amplitude - (Math.abs(Math.sin(t)) * 2);

    } else if (config.type === 'pulse') {
      // Heartbeat / Dramatic Beat
      const beat = Math.pow(Math.sin(t * config.frequency), 6); // Sharp peak
      const cx = this.width / 2;
      const cy = this.height / 2;
      const dist = Math.sqrt((p.ox - cx)**2 + (p.oy - cy)**2);
      const dirX = (p.ox - cx) / (dist || 1);
      const dirY = (p.oy - cy) / (dist || 1);
      dx = dirX * beat * config.amplitude;
      dy = dirY * beat * config.amplitude;

    } else if (config.type === 'wobble') {
       // Jelly effect
       dx = Math.sin(t * config.frequency + p.oy * 0.05) * config.amplitude;
       dy = Math.cos(t * config.frequency + p.ox * 0.05) * config.amplitude;

    } else if (config.type === 'spiral') {
      // Vortex twist
      const cx = this.width / 2;
      const cy = this.height / 2;
      const dxRaw = p.ox - cx;
      const dyRaw = p.oy - cy;
      const angle = Math.atan2(dyRaw, dxRaw);
      const dist = Math.sqrt(dxRaw*dxRaw + dyRaw*dyRaw);
      const twist = Math.sin(t * config.frequency) * (config.amplitude * 0.01) * (dist / 100);
      
      const newAngle = angle + twist;
      const newX = cx + Math.cos(newAngle) * dist;
      const newY = cy + Math.sin(newAngle) * dist;
      
      dx = newX - p.ox;
      dy = newY - p.oy;
    }

    return { dx, dy };
  }

  update(time: number, layers: AnimationLayer[]) {
    
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      
      let totalDx = 0;
      let totalDy = 0;
      let activeInfluence = false;

      // Iterate through all active layers and sum up displacements
      for (const layer of layers) {
        if (!layer.isVisible) continue;

        const weight = p.weights[layer.id];
        if (weight && weight > 0.01) {
            activeInfluence = true;
            // Calculate physics for this layer relative to this point
            const t = time * layer.config.speed;
            const { dx, dy } = this.calculateDisplacement(p, t, layer.config);
            
            totalDx += dx * weight;
            totalDy += dy * weight;
        }
      }

      if (!activeInfluence) {
        p.x = p.ox;
        p.y = p.oy;
      } else {
        p.x = p.ox + totalDx;
        p.y = p.oy + totalDy;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                               REACT COMPONENT                               */
/* -------------------------------------------------------------------------- */

const SmartWarpTool: React.FC = () => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [workerBlobUrl, setWorkerBlobUrl] = useState<string | null>(null);

  // Brush State
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [brushMode, setBrushMode] = useState<'paint' | 'erase'>('paint');
  const [showMask, setShowMask] = useState(true);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);

  // Layer State
  const [layers, setLayers] = useState<AnimationLayer[]>([
    { 
      id: 'layer-1', 
      name: 'Breathing (Idle)', 
      isVisible: true, 
      color: LAYER_COLORS[0], 
      config: { ...DEFAULT_CONFIGS.idle } 
    }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-1');

  // Export Settings
  const [gifFps, setGifFps] = useState(20);
  const [gifDuration, setGifDuration] = useState(2);
  const [transparentBg, setTransparentBg] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('gif');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const meshRef = useRef<GridMesh | null>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Helper to get active layer
  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  useEffect(() => {
    fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js')
      .then(resp => resp.text())
      .then(text => {
        const blob = new Blob([text], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        setWorkerBlobUrl(url);
      })
      .catch(err => console.error("Failed to load GIF worker script:", err));
  }, []);

  // Update export format recommendation based on transparency
  useEffect(() => {
    if (transparentBg) {
        setExportFormat('webm'); // Recommend WebM for transparency
    }
  }, [transparentBg]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImgSrc(url);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        sourceImageRef.current = img;
        initMesh(img.width, img.height);
      };
    }
  };

  const initMesh = (w: number, h: number) => {
    const maxDim = 800;
    let rw = w, rh = h;
    if (w > maxDim || h > maxDim) {
      const ratio = w / h;
      if (w > h) { rw = maxDim; rh = maxDim / ratio; }
      else { rh = maxDim; rw = maxDim * ratio; }
    }

    meshRef.current = new GridMesh(rw, rh, 25);
    
    if (canvasRef.current) { canvasRef.current.width = rw; canvasRef.current.height = rh; }
    if (overlayRef.current) { overlayRef.current.width = rw; overlayRef.current.height = rh; }
    
    drawFrame();
    drawOverlay();
  };

  // --- LAYER MANAGEMENT ---

  const addLayer = () => {
    const newId = `layer-${Date.now()}`;
    const colorIndex = layers.length % LAYER_COLORS.length;
    const newLayer: AnimationLayer = {
      id: newId,
      name: `New Layer ${layers.length + 1}`,
      isVisible: true,
      color: LAYER_COLORS[colorIndex],
      config: { ...DEFAULT_CONFIGS.wind }
    };
    setLayers([...layers, newLayer]);
    setActiveLayerId(newId);
  };

  const removeLayer = (id: string) => {
    if (layers.length <= 1) return; // Keep at least one
    const newLayers = layers.filter(l => l.id !== id);
    setLayers(newLayers);
    if (activeLayerId === id) {
      setActiveLayerId(newLayers[0].id);
    }
    meshRef.current?.clearWeights(id);
    drawOverlay();
  };

  const updateLayerConfig = (id: string, updates: Partial<PhysicsConfig>) => {
    setLayers(layers.map(l => l.id === id ? { ...l, config: { ...l.config, ...updates } } : l));
  };

  const toggleLayerVisibility = (id: string) => {
    setLayers(layers.map(l => l.id === id ? { ...l, isVisible: !l.isVisible } : l));
    setTimeout(drawOverlay, 0); 
  };

  const changeLayerType = (id: string, type: AnimationType) => {
    setLayers(layers.map(l => l.id === id ? { 
        ...l, 
        config: { ...DEFAULT_CONFIGS[type] },
        name: type.charAt(0).toUpperCase() + type.slice(1) // Auto-rename for convenience
    } : l));
  };

  // --- MOUSE / PAINT EVENTS ---

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = overlayRef.current.width / rect.width;
    const scaleY = overlayRef.current.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isAnimating) return;
    setIsDrawing(true);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!meshRef.current) return;
    const pos = getMousePos(e);
    setCursorPos(pos);

    if (isDrawing) {
        meshRef.current.brush(pos.x, pos.y, brushSize, 0.2, brushMode === 'erase', activeLayerId);
    }
    // Always redraw overlay to show cursor
    drawOverlay(pos);
  };

  const handlePointerUp = () => { setIsDrawing(false); };
  
  const handlePointerLeave = () => {
    setIsDrawing(false);
    setCursorPos(null);
    drawOverlay(null);
  };

  // --- RENDERERS ---

  const drawOverlay = (cursor: {x: number, y: number} | null = cursorPos) => {
    const ctx = overlayRef.current?.getContext('2d');
    const mesh = meshRef.current;
    if (!ctx || !mesh) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw Cursor Ring (High Visibility)
    if (cursor && !isAnimating) {
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, brushSize, 0, Math.PI * 2);
        // Outer White
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Inner Black (for contrast on light images)
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, brushSize - 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    if (!showMask || isAnimating) return;

    // Draw weights
    for (let p of mesh.points) {
      const sortedLayers = [...layers].sort((a, b) => (a.id === activeLayerId ? 1 : -1));

      for (let layer of sortedLayers) {
        if (!layer.isVisible) continue;
        const w = p.weights[layer.id];
        if (w && w > 0.05) {
          ctx.fillStyle = layer.color;
          ctx.beginPath();
          ctx.arc(p.ox, p.oy, 2 + (w * 2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };

  const textureMap = (ctx: CanvasRenderingContext2D, texture: HTMLImageElement, pts: Point[], indices: number[]) => {
    const p0 = pts[indices[0]], p1 = pts[indices[1]], p2 = pts[indices[2]];
    const x0 = p0.ox, y0 = p0.oy, x1 = p1.ox, y1 = p1.oy, x2 = p2.ox, y2 = p2.oy;
    const u0 = p0.x, v0 = p0.y, u1 = p1.x, v1 = p1.y, u2 = p2.x, v2 = p2.y;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(u0, v0); ctx.lineTo(u1, v1); ctx.lineTo(u2, v2);
    ctx.closePath(); ctx.clip();

    const t_a = x1 - x0, t_b = y1 - y0, t_c = x2 - x0, t_d = y2 - y0;
    const det = t_a * t_d - t_b * t_c;
    const r = 1 / det;
    const da = u1 - u0, db = v1 - v0, dc = u2 - u0, dd = v2 - v0;
    const a = (da * t_d - dc * t_b) * r, b = (db * t_d - dd * t_b) * r;
    const c = (dc * t_a - da * t_c) * r, d = (dd * t_a - db * t_c) * r;
    const e = u0 - a * x0 - c * y0, f = v0 - b * x0 - d * y0;

    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(texture, 0, 0, meshRef.current!.width, meshRef.current!.height);
    ctx.restore();
  };

  const drawFrame = (fillBackground = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const mesh = meshRef.current;
    const img = sourceImageRef.current;
    if (!canvas || !ctx || !mesh || !img) return;

    if (fillBackground && transparentBg) {
        // Green screen for GIF keying
        ctx.fillStyle = '#00FF00'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    for (let y = 0; y < mesh.rows; y++) {
      for (let x = 0; x < mesh.cols; x++) {
        const idxTL = y * (mesh.cols + 1) + x;
        const idxTR = idxTL + 1;
        const idxBL = (y + 1) * (mesh.cols + 1) + x;
        const idxBR = idxBL + 1;
        textureMap(ctx, img, mesh.points, [idxTL, idxTR, idxBL]);
        textureMap(ctx, img, mesh.points, [idxBL, idxTR, idxBR]);
      }
    }
  };

  const animate = () => {
    if (!meshRef.current) return;
    timeRef.current += 1;
    meshRef.current.update(timeRef.current, layers);
    drawFrame();
    animationRef.current = requestAnimationFrame(animate);
  };

  const toggleAnimation = () => {
    if (isAnimating) {
      cancelAnimationFrame(animationRef.current);
      timeRef.current = 0;
      meshRef.current?.points.forEach(p => { p.x = p.ox; p.y = p.oy; });
      drawFrame();
      drawOverlay();
    } else {
      setShowMask(false);
      drawOverlay(null);
      animate();
    }
    setIsAnimating(!isAnimating);
  };

  // --- EXPORT HANDLING ---

  const handleExport = () => {
    if (exportFormat === 'webm') {
        handleExportWebM();
    } else {
        handleExportGIF();
    }
  };

  const handleExportWebM = () => {
     if (!canvasRef.current) return;
     setIsExporting(true);
     setExportProgress(0);
     if (isAnimating) toggleAnimation();

     const stream = canvasRef.current.captureStream(gifFps);
     // Using VP9 for better transparency support in WebM
     const mimeType = 'video/webm; codecs=vp9';
     
     if (!MediaRecorder.isTypeSupported(mimeType)) {
         alert("WebM transparency is not supported by your browser. Falling back to default.");
     }

     const recorder = new MediaRecorder(stream, { 
         mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm' 
     });
     
     const chunks: Blob[] = [];
     recorder.ondataavailable = (e) => { if(e.data.size > 0) chunks.push(e.data); };
     
     recorder.onstop = () => {
         const blob = new Blob(chunks, { type: 'video/webm' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `smart-warp-${Date.now()}.webm`;
         a.click();
         
         setIsExporting(false);
         timeRef.current = 0;
         meshRef.current?.points.forEach(p => { p.x = p.ox; p.y = p.oy; });
         drawFrame();
         setShowMask(true);
         drawOverlay();
     };

     recorder.start();

     // Drive the animation for the recorder
     const totalFrames = gifDuration * gifFps;
     const delay = 1000 / gifFps;
     let currentFrame = 0;

     const recordLoop = () => {
        if (currentFrame < totalFrames) {
            timeRef.current += 1;
            meshRef.current?.update(timeRef.current, layers);
            drawFrame();
            
            currentFrame++;
            setExportProgress(Math.round((currentFrame / totalFrames) * 100));
            // We use setTimeout to match approximate FPS, captureStream picks up the changes
            setTimeout(recordLoop, delay);
        } else {
            recorder.stop();
        }
     };

     recordLoop();
  };

  const handleExportGIF = () => {
    if (!window.GIF || !workerBlobUrl) {
      alert("GIF Engine is loading...");
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    if (isAnimating) toggleAnimation();

    const gifOptions: any = { workers: 2, quality: 10, width: canvasRef.current?.width, height: canvasRef.current?.height, workerScript: workerBlobUrl };
    if (transparentBg) gifOptions.transparent = 0x00FF00; // Use Green as key

    const gif = new window.GIF(gifOptions);
    const totalFrames = gifDuration * gifFps;
    const delay = 1000 / gifFps;
    let currentFrame = 0;

    const captureLoop = () => {
       if (currentFrame < totalFrames) {
           timeRef.current += 1;
           meshRef.current?.update(timeRef.current, layers);
           
           // If transparency enabled, we draw green background first to serve as chroma key
           drawFrame(transparentBg);
           
           if (canvasRef.current) gif.addFrame(canvasRef.current, {copy: true, delay: delay});
           currentFrame++;
           setExportProgress(Math.round((currentFrame / totalFrames) * 100));
           requestAnimationFrame(captureLoop);
       } else {
           gif.on('finished', (blob: Blob) => {
               const url = URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = `smart-warp-${Date.now()}.gif`;
               a.click();
               setIsExporting(false);
               timeRef.current = 0;
               meshRef.current?.points.forEach(p => { p.x = p.ox; p.y = p.oy; });
               drawFrame();
               setShowMask(true);
               drawOverlay();
           });
           gif.render();
       }
    };
    captureLoop();
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Layers & Global Tools (4 Cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col h-full">
          
          {/* Main Card */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl flex flex-col gap-4">
             <h3 className="text-xl font-bold text-white flex items-center gap-2">
               <SparklesIcon /> Smart Warp Studio
             </h3>

             {/* File Upload */}
             <div 
                onClick={() => document.getElementById('warp-upload')?.click()}
                className="border-2 border-dashed border-slate-600 rounded-xl p-3 flex items-center justify-center gap-4 cursor-pointer hover:border-indigo-500 hover:bg-slate-700/50 transition-all"
             >
                {imgSrc ? (
                  <img src={imgSrc} alt="thumb" className="w-12 h-12 object-cover rounded" />
                ) : <UploadIcon />}
                <span className="text-sm text-slate-400">{imgSrc ? "Change Image" : "Upload Image"}</span>
                <input id="warp-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
             </div>

             {/* GLOBAL DRAWING TOOLS */}
             <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-bold text-slate-300 uppercase">Brush Tools</span>
                   <div className="flex gap-1">
                      <button onClick={() => {meshRef.current?.fillWeights(activeLayerId); drawOverlay();}} className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 hover:text-white">Fill Layer</button>
                      <button onClick={() => {meshRef.current?.clearWeights(activeLayerId); drawOverlay();}} className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 hover:text-red-400">Clear Layer</button>
                   </div>
                </div>
                <div className="flex gap-2 mb-2">
                    <button onClick={() => setBrushMode('paint')} className={`flex-1 py-1.5 rounded text-xs font-bold ${brushMode === 'paint' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Paint</button>
                    <button onClick={() => setBrushMode('erase')} className={`flex-1 py-1.5 rounded text-xs font-bold ${brushMode === 'erase' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Erase</button>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Size: {brushSize}px</span>
                    </div>
                    <input type="range" min="5" max="150" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={showMask} onChange={(e) => { setShowMask(e.target.checked); setTimeout(() => drawOverlay(null), 50); }} id="showMask" className="rounded bg-slate-700 border-slate-600 text-indigo-600"/>
                    <label htmlFor="showMask" className="text-xs text-slate-400">Show Masks</label>
                </div>
             </div>

             {/* LAYERS LIST */}
             <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 flex-1 min-h-[150px] flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1"><LayersIcon /> Layers</span>
                    <button onClick={addLayer} className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"><PlusIcon /></button>
                </div>
                
                <div className="space-y-2 overflow-y-auto max-h-[200px] pr-1 custom-scrollbar">
                    {layers.map(layer => (
                        <div 
                           key={layer.id}
                           onClick={() => setActiveLayerId(layer.id)}
                           className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${activeLayerId === layer.id ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500/50' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
                        >
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: layer.color.replace('0.4', '1')}}></div>
                            <span className="text-xs text-white font-medium flex-1 truncate">{layer.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }} className={`p-1 rounded ${layer.isVisible ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}>
                                <EyeIcon />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }} className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-30" disabled={layers.length === 1}>
                                <TrashIcon />
                            </button>
                        </div>
                    ))}
                </div>
             </div>
          </div>

          {/* ACTIVE LAYER CONFIG */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
             <h4 className="text-sm font-bold text-white mb-3 border-b border-slate-700 pb-2">
               Active Layer Settings: <span className="text-indigo-400">{activeLayer.name}</span>
             </h4>

             <div className="space-y-4">
                {/* Animation Type Selector */}
                <div>
                   <label className="text-xs text-slate-400 mb-1 block">Animation Effect</label>
                   <select 
                      value={activeLayer.config.type} 
                      onChange={(e) => changeLayerType(activeLayer.id, e.target.value as AnimationType)}
                      className="w-full bg-slate-900 text-white text-xs rounded border border-slate-600 px-2 py-2"
                   >
                      <option value="idle">Idle (Natural Breathing)</option>
                      <option value="wind">Wind / Flow</option>
                      <option value="water">Water / Ripple</option>
                      <option value="fire">Fire / Heat</option>
                      <option value="pulse">Pulse / Heartbeat</option>
                      <option value="wobble">Wobble / Jelly</option>
                      <option value="spiral">Spiral / Vortex</option>
                   </select>
                </div>

                {/* Physics Sliders */}
                <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className="text-[10px] text-slate-400">Power (Amp)</label>
                      <input 
                         type="range" min="1" max="30" 
                         value={activeLayer.config.amplitude}
                         onChange={(e) => updateLayerConfig(activeLayer.id, { amplitude: parseFloat(e.target.value) })}
                         className="w-full h-1 bg-slate-600 rounded accent-indigo-500"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] text-slate-400">Speed</label>
                      <input 
                         type="range" min="0.01" max="0.5" step="0.01"
                         value={activeLayer.config.speed}
                         onChange={(e) => updateLayerConfig(activeLayer.id, { speed: parseFloat(e.target.value) })}
                         className="w-full h-1 bg-slate-600 rounded accent-indigo-500"
                      />
                   </div>
                   
                   {/* Direction Controls (Only for directional types) */}
                   {(activeLayer.config.type === 'wind' || activeLayer.config.type === 'water') && (
                     <>
                        <div>
                          <label className="text-[10px] text-slate-400">Dir X</label>
                          <input 
                             type="range" min="-1" max="1" step="0.1"
                             value={activeLayer.config.directionX}
                             onChange={(e) => updateLayerConfig(activeLayer.id, { directionX: parseFloat(e.target.value) })}
                             className="w-full h-1 bg-slate-600 rounded accent-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Dir Y</label>
                          <input 
                             type="range" min="-1" max="1" step="0.1"
                             value={activeLayer.config.directionY}
                             onChange={(e) => updateLayerConfig(activeLayer.id, { directionY: parseFloat(e.target.value) })}
                             className="w-full h-1 bg-slate-600 rounded accent-indigo-500"
                          />
                        </div>
                     </>
                   )}
                </div>
             </div>
          </div>

          {/* EXPORT BUTTONS (Moved here for better layout) */}
          <div className="grid grid-cols-2 gap-2">
               <button 
                 onClick={toggleAnimation}
                 disabled={!imgSrc || isExporting}
                 className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isAnimating ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white shadow-lg`}
               >
                 {isAnimating ? <><PauseIcon /> Stop</> : <><PlayIcon /> Play</>}
               </button>
               
               <button 
                 onClick={handleExport}
                 disabled={!imgSrc || isExporting}
                 className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 <DownloadIcon /> Export
               </button>
          </div>
          
          {/* Export Settings Row */}
          <div className="bg-slate-900 p-3 rounded-lg flex flex-col gap-2 border border-slate-700">
             <div className="flex justify-between items-center text-[10px] text-slate-400">
                 <label>Dur: <select value={gifDuration} onChange={(e) => setGifDuration(Number(e.target.value))} className="bg-slate-800 rounded ml-1"><option value={1}>1s</option><option value={2}>2s</option><option value={3}>3s</option><option value={4}>4s</option><option value={5}>5s</option></select></label>
                 <label>FPS: <select value={gifFps} onChange={(e) => setGifFps(Number(e.target.value))} className="bg-slate-800 rounded ml-1"><option value={15}>15</option><option value={20}>20</option><option value={30}>30</option></select></label>
                 <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={transparentBg} onChange={(e) => setTransparentBg(e.target.checked)}/> No BG</label>
             </div>
             
             {/* Format Selector */}
             <div className="flex bg-slate-800 rounded p-1">
                 <button 
                    onClick={() => setExportFormat('gif')}
                    className={`flex-1 text-[10px] py-1 rounded transition-colors ${exportFormat === 'gif' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                 >
                    GIF (Compact)
                 </button>
                 <button 
                    onClick={() => setExportFormat('webm')}
                    className={`flex-1 text-[10px] py-1 rounded transition-colors ${exportFormat === 'webm' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                 >
                    WebM (Best Transp.)
                 </button>
             </div>
          </div>
          
          {isExporting && (
             <div className="w-full bg-slate-900 rounded-full h-2 mt-2">
               <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{width: `${exportProgress}%`}}></div>
             </div>
          )}

        </div>

        {/* RIGHT COLUMN: Canvas (8 Cols) */}
        <div className="lg:col-span-8 bg-black rounded-2xl border border-slate-700 overflow-hidden relative flex items-center justify-center min-h-[600px] touch-none select-none">
          {!imgSrc && (
            <div className="text-slate-500 flex flex-col items-center">
              <SparklesIcon />
              <span className="mt-2">Upload an image to start</span>
            </div>
          )}
          <div className="relative cursor-none">
             <canvas 
                ref={canvasRef} 
                className={`max-w-full max-h-[75vh] shadow-2xl block ${transparentBg ? "bg-[url('https://upload.wikimedia.org/wikipedia/commons/2/23/Transparency_checkered_background.jpg')] bg-contain" : ""}`}
             />
             <canvas 
                ref={overlayRef}
                className="absolute inset-0 w-full h-full pointer-events-auto opacity-100 transition-opacity duration-200"
                style={{ opacity: isAnimating || !showMask ? 1 : 1 }} // Keep opacity 1 to show cursor even when mask hidden
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerLeave}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
             />
          </div>
          
          {imgSrc && (
            <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none">
               <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg text-xs font-mono text-white border border-slate-500/30">
                  Total Layers: {layers.length}
               </div>
               <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg text-xs font-mono text-emerald-400 border border-emerald-500/30">
                  Editing: {activeLayer.name}
               </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SmartWarpTool;