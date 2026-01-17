import React, { useEffect, useRef, useState } from 'react';
import { CameraIcon, UploadIcon, XIcon, PlayIcon, PauseIcon, SparklesIcon, WandIcon, DownloadIcon } from './Icons';

// Declare types for global MediaPipe objects added via script tags
declare global {
  interface Window {
    SelfieSegmentation: any;
    Camera: any;
  }
}

type BgMode = 'blur' | 'green' | 'transparent';
type SourceType = 'camera' | 'file' | null;
type AppState = 'idle' | 'trimming' | 'processing';
type QualityMode = 0 | 1;
type SegmentationMethod = 'ai' | 'color';

const VideoBackgroundRemover: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Refs for managing instances and loops
  const selfieSegmentationRef = useRef<any>(null);
  const cameraInstanceRef = useRef<any>(null);
  const requestRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  
  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // App State
  const [appState, setAppState] = useState<AppState>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<BgMode>('transparent');
  const [sourceType, setSourceType] = useState<SourceType>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  
  // Segmentation Settings
  const [segMethod, setSegMethod] = useState<SegmentationMethod>('ai');
  const [qualityMode, setQualityMode] = useState<QualityMode>(0); // 0 = High, 1 = Fast
  const [edgeBlur, setEdgeBlur] = useState<number>(2); // Smoothing amount for AI mask

  // Chroma Key Settings (For Objects/Animals)
  const [keyColor, setKeyColor] = useState<string>('#00ff00');
  const [similarity, setSimilarity] = useState<number>(0.4);
  const [smoothness, setSmoothness] = useState<number>(0.15); 

  // Trimming State
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // 1. Initialize MediaPipe Model
  useEffect(() => {
    let isMounted = true;
    setIsModelLoaded(false);
    setIsLoading(true);

    const initModel = async () => {
      try {
        const selfieSegmentation = new window.SelfieSegmentation({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
          }
        });

        selfieSegmentation.setOptions({
          modelSelection: qualityMode,
        });

        selfieSegmentation.onResults((results: any) => {
          if (isMounted) onResultsAI(results);
        });

        await selfieSegmentation.initialize();
        
        if (isMounted) {
          selfieSegmentationRef.current = selfieSegmentation;
          setIsModelLoaded(true);
          setIsLoading(false);
          console.log(`MediaPipe Model Loaded (Mode: ${qualityMode})`);
        }
      } catch (error) {
        console.error("Failed to load MediaPipe model:", error);
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
        initModel();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityMode]);

  // 2. Cleanup Function
  const cleanup = () => {
    isRunningRef.current = false; 
    
    if (cameraInstanceRef.current) {
      cameraInstanceRef.current.stop();
      cameraInstanceRef.current = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = 0;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
    }
  };

  // 3. Canvas Logic - AI Mode
  const onResultsAI = (results: any) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Default smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const width = results.image.width;
    const height = results.image.height;

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    ctx.save();
    
    // --- STAGE 1 & 2: SEGMENTATION & ISOLATION ---
    ctx.clearRect(0, 0, width, height);

    // Draw Segmentation Mask with Blur for Anti-aliasing
    if (edgeBlur > 0) {
        ctx.filter = `blur(${edgeBlur}px)`;
    }
    ctx.drawImage(results.segmentationMask, 0, 0, width, height);
    ctx.filter = 'none'; // Reset filter

    // Composite: Keep only person (source-in)
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(results.image, 0, 0, width, height);

    // --- STAGE 3: BACKGROUND COMPOSITION ---
    ctx.globalCompositeOperation = 'destination-over';
    drawBackground(ctx, width, height, results.image);
    
    ctx.restore();
  };

  // 3.1 Canvas Logic - Color Key Mode
  const processColorKey = (video: HTMLVideoElement) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    if (!ctx) return;

    // Enable smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    // --- STAGE 1: RAW DRAW ---
    ctx.drawImage(video, 0, 0, width, height);

    // --- STAGE 2: COLOR KEY ISOLATION ---
    const frameData = ctx.getImageData(0, 0, width, height);
    const data = frameData.data;
    const pixelCount = data.length / 4;

    const rTarget = parseInt(keyColor.slice(1, 3), 16);
    const gTarget = parseInt(keyColor.slice(3, 5), 16);
    const bTarget = parseInt(keyColor.slice(5, 7), 16);

    const maxDist = 441; 
    const threshold = similarity * maxDist;
    const ramp = smoothness * maxDist;

    for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];

        const dist = Math.sqrt(
            (r - rTarget) * (r - rTarget) +
            (g - gTarget) * (g - gTarget) +
            (b - bTarget) * (b - bTarget)
        );

        if (dist < threshold) {
            data[offset + 3] = 0; // Transparent
        } else if (dist < threshold + ramp) {
            // Anti-aliasing / Soft edges
            const alpha = (dist - threshold) / ramp;
            data[offset + 3] = alpha * 255;
        }
    }

    ctx.putImageData(frameData, 0, 0);

    // --- STAGE 3: BACKGROUND ---
    ctx.globalCompositeOperation = 'destination-over';
    drawBackground(ctx, width, height, video);
    ctx.globalCompositeOperation = 'source-over';
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, w: number, h: number, source: any) => {
    if (mode === 'green') {
       ctx.fillStyle = '#00FF00';
       ctx.fillRect(0, 0, w, h);
    } else if (mode === 'blur') {
       ctx.filter = 'blur(15px)';
       ctx.drawImage(source, 0, 0, w, h);
       ctx.filter = 'none';
    } 
  };

  // 4. Recording Logic
  const startRecording = () => {
    if (!canvasRef.current) return;
    
    // Reset previous recording
    recordedChunksRef.current = [];
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }

    // 1. Get Video Stream from Canvas
    const stream = canvasRef.current.captureStream(30); // 30 FPS

    // 2. Get Audio Stream (if playing from file)
    if (videoRef.current && sourceType === 'file') {
        // @ts-ignore
        const videoStream = videoRef.current.captureStream ? videoRef.current.captureStream() : (videoRef.current as any).mozCaptureStream ? (videoRef.current as any).mozCaptureStream() : null;
        
        if (videoStream) {
            const audioTracks = videoStream.getAudioTracks();
            if (audioTracks.length > 0) {
                stream.addTrack(audioTracks[0]);
            }
        }
    }

    // 3. Initialize Recorder
    try {
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedVideoUrl(url);
            setIsRecording(false);
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        console.log("Recording started");
    } catch (e) {
        console.error("Recording failed to start", e);
        alert("Recording not supported in this browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
  };

  const downloadRecording = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    // WebM is the best format for alpha channel support in browsers
    a.download = `edited-video-${Date.now()}.webm`; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 5. Start Webcam
  const startCamera = async () => {
    if (!videoRef.current) return;
    cleanup();
    setIsLoading(true);

    try {
      if (segMethod === 'ai') {
          if (!selfieSegmentationRef.current) return;
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (selfieSegmentationRef.current) {
                await selfieSegmentationRef.current.send({ image: videoRef.current });
              }
            },
            width: 1280,
            height: 720
          });
          cameraInstanceRef.current = camera;
          await camera.start();
      } else {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          
          const loop = () => {
              if (isRunningRef.current && videoRef.current) {
                  processColorKey(videoRef.current);
                  requestRef.current = requestAnimationFrame(loop);
              }
          };
          requestRef.current = requestAnimationFrame(loop);
      }
      setSourceType('camera');
      setAppState('processing');
      isRunningRef.current = true;
      setIsLoading(false);
    } catch (error) {
      console.error("Camera start error:", error);
      alert("Could not access camera.");
      setIsLoading(false);
    }
  };

  // 6. File Processing Loop
  const processFileFrame = async () => {
    if (!isRunningRef.current) return;

    let inputElement: HTMLVideoElement | null = null;
    if (sourceType === 'file' && videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        inputElement = videoRef.current;
    }

    if (inputElement) {
       if (segMethod === 'ai' && selfieSegmentationRef.current) {
           await selfieSegmentationRef.current.send({ image: inputElement });
       } else if (segMethod === 'color') {
           processColorKey(inputElement);
       }
    }

    if (isRunningRef.current) {
      requestRef.current = requestAnimationFrame(processFileFrame);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
        alert("Please upload a video file.");
        return;
    }

    cleanup();
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setIsLoading(true);
    setSourceType('file');

    if (videoRef.current) {
      const vid = videoRef.current;
      vid.src = url;
      vid.load();
      
      vid.onloadedmetadata = () => {
        setDuration(vid.duration);
        setTrimStart(0);
        setTrimEnd(vid.duration);
        setAppState('trimming'); 
        setIsLoading(false);
        setIsVideoPlaying(false);
      };
    }
    e.target.value = '';
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
        if (!videoRef.current.paused) {
           videoRef.current.play();
        }
        // Auto stop recording if loop restarts
        if (isRecording) {
            stopRecording();
            setIsVideoPlaying(false);
            videoRef.current.pause();
        }
      }
    }
  };

  const startProcessing = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = trimStart;
    
    videoRef.current.play().then(() => {
        setAppState('processing');
        setIsVideoPlaying(true);
        isRunningRef.current = true;
        requestRef.current = requestAnimationFrame(processFileFrame);
    }).catch(console.error);
  };

  const handleStop = () => {
    setAppState('idle');
    setSourceType(null);
    setIsVideoPlaying(false);
    cleanup();
    setRecordedVideoUrl(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const toggleVideoPlay = () => {
    if (videoRef.current && sourceType === 'file') {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsVideoPlaying(true);
      } else {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl relative min-h-[400px] flex items-center justify-center">
        {/* Hidden Inputs */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="video/*" 
          className="hidden" 
          onChange={handleFileUpload}
        />
        
        {/* VIDEO ELEMENT */}
        <video 
          ref={videoRef} 
          className={`absolute w-full h-full object-contain bg-black ${appState === 'processing' ? 'opacity-0 pointer-events-none -z-10' : 'z-0'}`}
          playsInline
          muted={false} /* Allow sound for captureStream */
          loop={false}
          onTimeUpdate={handleTimeUpdate}
          crossOrigin="anonymous"
        ></video>

        <img ref={imgRef} className="hidden" alt="source" crossOrigin="anonymous" />

        {/* Output Canvas */}
        <canvas 
          ref={canvasRef} 
          className={`max-w-full max-h-[70vh] w-auto h-auto bg-[url('https://upload.wikimedia.org/wikipedia/commons/2/23/Transparency_checkered_background.jpg')] bg-contain ${appState === 'processing' ? 'block' : 'hidden'}`}
        ></canvas>

        {/* Start / Mode Selection Overlay */}
        {appState === 'idle' && !isLoading && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-6 overflow-y-auto">
            <h3 className="text-2xl font-bold text-white mb-2">Setup Your Environment</h3>
            <p className="text-slate-400 text-sm mb-6 text-center max-w-md">
                Select the detection method based on your subject.
            </p>

            {/* Segmentation Method Switcher */}
            <div className="flex bg-slate-800 p-1 rounded-lg mb-8 border border-slate-700">
                <button
                    onClick={() => setSegMethod('ai')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${segMethod === 'ai' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    AI Human Detection
                </button>
                <button
                    onClick={() => setSegMethod('color')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${segMethod === 'color' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    Object/Animal (Color Key)
                </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              <button 
                onClick={startCamera}
                className="group flex flex-col items-center gap-4 p-6 sm:p-8 bg-slate-800 rounded-2xl border border-slate-700 hover:border-indigo-500 hover:bg-slate-800/80 transition-all w-48"
              >
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <CameraIcon />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-bold text-white">Webcam</h4>
                  <p className="text-slate-400 text-xs mt-1">Real-time stream</p>
                </div>
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="group flex flex-col items-center gap-4 p-6 sm:p-8 bg-slate-800 rounded-2xl border border-slate-700 hover:border-emerald-500 hover:bg-slate-800/80 transition-all w-48"
              >
                <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <UploadIcon />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-bold text-white">Upload Video</h4>
                  <p className="text-slate-400 text-xs mt-1">MP4, WebM, MOV</p>
                </div>
              </button>
            </div>

            {/* Sub-settings based on Method */}
            {segMethod === 'ai' ? (
                <div className="flex flex-col gap-3 w-full max-w-sm">
                    {/* Model Precision */}
                    <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700 justify-between">
                        <span className="text-xs text-slate-400 font-medium">Model Precision:</span>
                        <select
                            value={qualityMode}
                            onChange={(e) => setQualityMode(Number(e.target.value) as QualityMode)}
                            className="bg-slate-900 text-white text-xs rounded border border-slate-600 px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                        >
                            <option value={0}>High Accuracy</option>
                            <option value={1}>Fast Performance</option>
                        </select>
                    </div>

                    {/* Edge Smoothness Slider */}
                    <div className="flex flex-col gap-1 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                        <div className="flex justify-between text-xs text-slate-400 font-medium">
                            <span>Edge Softness</span>
                            <span>{edgeBlur}px</span>
                        </div>
                        <input 
                            type="range" min="0" max="10" step="1" 
                            value={edgeBlur} onChange={(e) => setEdgeBlur(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3 bg-slate-800/50 p-4 rounded-lg border border-slate-700 w-full max-w-sm">
                     <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">Remove Color:</span>
                        <div className="flex items-center gap-2">
                            <input 
                                type="color" 
                                value={keyColor} 
                                onChange={(e) => setKeyColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                            />
                            <span className="text-xs font-mono text-slate-300">{keyColor}</span>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Similarity</span>
                            <span>{Math.round(similarity * 100)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01" 
                            value={similarity} onChange={(e) => setSimilarity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                     </div>
                     <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Smoothness</span>
                            <span>{Math.round(smoothness * 100)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="0.5" step="0.01" 
                            value={smoothness} onChange={(e) => setSmoothness(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                     </div>
                </div>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {(isLoading) && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-indigo-300 font-medium mt-4">Initializing...</p>
          </div>
        )}
      </div>

      {/* Trimming Controls */}
      {appState === 'trimming' && sourceType === 'file' && (
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                    <SparklesIcon /> Trim Video & Start
                </h3>
                <span className="text-slate-400 text-xs">Select segment</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                    <label className="text-xs text-slate-400">Start: {formatTime(trimStart)}</label>
                    <input 
                        type="range" min={0} max={duration} step={0.1} value={trimStart}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val < trimEnd) { setTrimStart(val); if(videoRef.current) videoRef.current.currentTime = val; }
                        }}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-slate-400">End: {formatTime(trimEnd)}</label>
                    <input 
                        type="range" min={0} max={duration} step={0.1} value={trimEnd}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val > trimStart) setTrimEnd(val);
                        }}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                </div>
            </div>

            {/* Mode-specific settings in Trim view for convenience */}
            {segMethod === 'color' && (
                <div className="flex flex-wrap gap-4 justify-center items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 mb-4">
                     <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300">Remove Color:</span>
                        <input type="color" value={keyColor} onChange={(e) => setKeyColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0"/>
                     </div>
                     <div className="flex flex-col w-32">
                        <span className="text-[10px] text-slate-400">Similarity</span>
                        <input type="range" min="0" max="1" step="0.01" value={similarity} onChange={(e) => setSimilarity(parseFloat(e.target.value))} className="h-1 accent-emerald-500"/>
                     </div>
                </div>
            )}

             {/* AI Settings in Trim View */}
             {segMethod === 'ai' && (
                <div className="flex flex-wrap gap-4 justify-center items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 mb-4">
                     <div className="flex flex-col w-40">
                        <span className="text-[10px] text-slate-400">Edge Softness: {edgeBlur}px</span>
                        <input type="range" min="0" max="10" step="1" value={edgeBlur} onChange={(e) => setEdgeBlur(parseInt(e.target.value))} className="h-1 accent-indigo-500"/>
                     </div>
                </div>
            )}
            
            <div className="flex justify-center flex-col items-center gap-2">
                <button 
                    onClick={startProcessing}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
                >
                    <WandIcon />
                    Start Processing ({segMethod === 'ai' ? 'AI' : 'Color Key'})
                </button>
            </div>
        </div>
      )}

      {/* Live Controls */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-wrap gap-4 items-center justify-between">
        
        {/* Background Toggles */}
        <div className={`flex items-center gap-2 sm:gap-4 flex-wrap ${appState !== 'processing' ? 'opacity-50 pointer-events-none' : ''}`}>
           <span className="text-slate-400 font-medium text-sm uppercase tracking-wider hidden md:inline">Background:</span>
           <div className="flex bg-slate-900 rounded-lg p-1">
              <button onClick={() => setMode('transparent')} className={`px-2 sm:px-3 py-2 rounded text-xs font-medium ${mode === 'transparent' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Transparent</button>
              <button onClick={() => setMode('green')} className={`px-2 sm:px-3 py-2 rounded text-xs font-medium ${mode === 'green' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}>Green</button>
              <button onClick={() => setMode('blur')} className={`px-2 sm:px-3 py-2 rounded text-xs font-medium ${mode === 'blur' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>Blur</button>
           </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-3">
            
            {/* AI Live Softness Control */}
            {appState === 'processing' && segMethod === 'ai' && (
                 <div className="flex flex-col w-24 hidden sm:flex">
                     <span className="text-[10px] text-slate-400 text-center">Softness</span>
                     <input type="range" min="0" max="10" step="1" value={edgeBlur} onChange={(e) => setEdgeBlur(parseInt(e.target.value))} className="h-1 accent-indigo-500"/>
                 </div>
            )}

          {(appState === 'trimming' || appState === 'processing') && sourceType === 'file' && (
             <div className="flex gap-2">
                 {/* Play/Pause */}
                 <button onClick={toggleVideoPlay} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-full text-white transition-colors" title={isVideoPlaying ? "Pause" : "Play"}>
                    {isVideoPlaying ? <PauseIcon /> : <PlayIcon />}
                 </button>

                 {/* Recording Button */}
                 {appState === 'processing' && (
                     <>
                        {!isRecording && !recordedVideoUrl && (
                             <button 
                                onClick={startRecording}
                                className="flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-white text-xs font-bold shadow-lg shadow-rose-900/20 transition-all"
                             >
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                                Record
                             </button>
                        )}
                        {isRecording && (
                             <button 
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-lg text-white text-xs font-bold transition-all"
                             >
                                <div className="w-2 h-2 rounded-sm bg-rose-500"></div>
                                Stop
                             </button>
                        )}
                        {recordedVideoUrl && !isRecording && (
                             <button 
                                onClick={downloadRecording}
                                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-xs font-bold shadow-lg shadow-emerald-900/20 transition-all"
                             >
                                <DownloadIcon />
                                Download (WebM)
                             </button>
                        )}
                     </>
                 )}
             </div>
          )}

          {appState !== 'idle' && (
            <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg transition-colors font-medium text-sm">
              <XIcon /> <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoBackgroundRemover;