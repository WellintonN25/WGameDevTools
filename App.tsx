import React, { useState } from 'react';
import VideoWorkspace from './components/VideoWorkspace';
import FrameGallery from './components/FrameGallery';
import VideoBackgroundRemover from './components/VideoBackgroundRemover';
import SmartWarpTool from './components/SmartWarpTool';
import PixelArtGenerator from './components/PixelArtGenerator';
import AnimatedSpriteGenerator from './components/AnimatedSpriteGenerator';
import ImageEnhancer from './components/ImageEnhancer';
import AnimationMaker from './components/AnimationMaker';
import BatchBackgroundRemover from './components/BatchBackgroundRemover';
import { CapturedFrame } from './types';
import { UploadIcon, CameraIcon, SparklesIcon, ChevronRightIcon, WandIcon, WindIcon, GridIcon, AnimationIcon, LayersIcon } from './components/Icons';
import { analyzeFrame } from './services/geminiService';

type ViewState = 'home' | 'framesnap' | 'bg-remover' | 'smart-warp' | 'pixel-art' | 'sprite-animator' | 'image-enhancer' | 'animation-maker' | 'batch-bg-remover';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
      } else {
        alert("Please upload a video file.");
      }
    }
  };

  const handleCapture = (frame: CapturedFrame) => {
    setFrames(prev => [frame, ...prev]);
  };

  const handleDeleteFrame = (id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id));
  };

  const handleAnalyzeFrame = async (id: string) => {
    const frameToAnalyze = frames.find(f => f.id === id);
    if (!frameToAnalyze) return;

    // Optimistic update
    setFrames(prev => prev.map(f => f.id === id ? { ...f, isAnalyzing: true } : f));

    try {
      const analysis = await analyzeFrame(frameToAnalyze.dataUrl);
      setFrames(prev => prev.map(f => f.id === id ? { ...f, isAnalyzing: false, analysis } : f));
    } catch (error) {
      console.error(error);
      setFrames(prev => prev.map(f => f.id === id ? { ...f, isAnalyzing: false, analysis: "Analysis failed. Ensure API Key is set." } : f));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setCurrentView('home')}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 group-hover:to-white transition-all truncate">
                Wellinton Game Dev Tools
              </h1>
            </div>
            <div className="hidden md:block text-sm text-slate-500 font-medium">
              Client-side • Secure • AI Powered
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        
        {/* Dashboard View */}
        {currentView === 'home' && (
          <div className="flex flex-col items-center justify-center py-10 sm:py-20 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-br from-white via-slate-200 to-slate-500 px-4">
              Welcome to Your Toolkit
            </h2>
            <p className="text-slate-400 text-base sm:text-lg text-center max-w-2xl mb-8 sm:mb-12 px-4">
              Powerful browser-based tools for developers and content creators. 
              Secure, fast, and enhanced with Google Gemini AI.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full max-w-7xl">
              {/* FrameSnap Tool Card */}
              <div 
                onClick={() => setCurrentView('framesnap')}
                className="group relative bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                    <CameraIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                    FrameSnap AI
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Extract high-quality frames from any video instantly. Analyze scenes automatically using Gemini AI.
                  </p>
                  <div className="flex items-center text-indigo-400 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Launch Tool</span>
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>

               {/* Video Background Remover Card */}
               <div 
                onClick={() => setCurrentView('bg-remover')}
                className="group relative bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
                    <WandIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                    BG Remover
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Real-time video background removal directly in your browser using computer vision.
                  </p>
                  <div className="flex items-center text-emerald-400 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Launch Tool</span>
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>

               {/* Smart Warp Engine Card */}
               <div 
                onClick={() => setCurrentView('smart-warp')}
                className="group relative bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-colors">
                    <WindIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                    Smart Warp 2.5D
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Advanced physics engine to animate still images. Use prompts to control wind, breath, and distortion.
                  </p>
                  <div className="flex items-center text-amber-400 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Launch Tool</span>
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>

              {/* Pixel Art Studio Card */}
              <div 
                onClick={() => setCurrentView('pixel-art')}
                className="group relative bg-slate-900 border border-slate-800 hover:border-pink-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-pink-500/10 hover:-translate-y-1 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-red-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 group-hover:bg-pink-500/20 group-hover:text-pink-400 transition-colors">
                    <GridIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-pink-300 transition-colors">
                    Pixel Art Studio
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Turn photos into retro game assets. Auto-isolates subjects and applies 16/32/64-bit styling.
                  </p>
                  <div className="flex items-center text-pink-400 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Launch Tool</span>
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>

              {/* Animated Sprite Generator Card */}
              <div 
                onClick={() => setCurrentView('sprite-animator')}
                className="group relative bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                    <AnimationIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                    Sprite Animator AI
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Transform static images into animated sprites. Generate 8/10/12 frames with AI-powered motion.
                  </p>
                  <div className="flex items-center text-purple-400 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Launch Tool</span>
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>

              {/* Image Enhancer HD Card */}
              <div 
                onClick={() => setCurrentView('image-enhancer')}
                className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 hover:-translate-y-1 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
                    <SparklesIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                    Image Enhancer HD
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Upscale and enhance images up to 8x. Apply sharpening, noise reduction, and advanced filters.
                  </p>
                  <div className="flex items-center text-cyan-400 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Launch Tool</span>
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>

              {/* Animation Maker Card */}
              <div 
                onClick={() => setCurrentView('animation-maker')}
                className="group relative bg-slate-900 border border-slate-800 hover:border-rose-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-rose-500/10 hover:-translate-y-1 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 group-hover:bg-rose-500/20 group-hover:text-rose-400 transition-colors">
                    <AnimationIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-rose-300 transition-colors">
                    Animation Maker
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Create animated GIFs and WebPs from multiple frames. Control FPS, ping-pong, and quality.
                  </p>
                  <div className="flex items-center text-rose-400 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Launch Tool</span>
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>

              {/* Batch BG Remover Card */}
              <div 
                onClick={() => setCurrentView('batch-bg-remover')}
                className="group relative bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                    <LayersIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                    Batch BG Remover
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Remove background from multiple images at once. Download as individual files or ZIP archive.
                  </p>
                  <div className="flex items-center text-indigo-400 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Launch Tool</span>
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}


        {/* FrameSnap Tool View */}
        {currentView === 'framesnap' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <span 
                onClick={() => setCurrentView('home')} 
                className="hover:text-indigo-400 cursor-pointer transition-colors"
              >
                Home
              </span>
              <span>/</span>
              <span className="text-indigo-400">FrameSnap AI</span>
            </div>

            {/* Video Section */}
            <section className="min-h-[300px] sm:min-h-[400px] md:min-h-[500px] flex flex-col">
              {!videoFile ? (
                <div 
                  className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer px-4
                    ${dragActive 
                      ? 'border-indigo-500 bg-indigo-500/10' 
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'
                    }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('video-upload')?.click()}
                >
                  <input 
                    id="video-upload"
                    type="file" 
                    accept="video/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-xl">
                    <UploadIcon />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 text-center">Upload a Video</h3>
                  <p className="text-slate-400 text-center max-w-sm text-sm sm:text-base">
                    Drag and drop your video here, or click to browse. 
                    <br />
                    <span className="text-xs mt-2 block text-slate-600">Supports MP4, WebM, MOV</span>
                  </p>
                </div>
              ) : (
                <VideoWorkspace 
                  videoFile={videoFile} 
                  onClose={() => setVideoFile(null)} 
                  onCapture={handleCapture}
                />
              )}
            </section>

            {/* Gallery Section */}
            {frames.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
                    Captured Frames
                    <span className="text-sm font-normal text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                      {frames.length}
                    </span>
                  </h2>
                </div>
                <FrameGallery 
                  frames={frames} 
                  onDelete={handleDeleteFrame}
                  onAnalyze={handleAnalyzeFrame}
                />
              </section>
            )}
          </div>
        )}

        {/* Video Background Remover Tool View */}
        {currentView === 'bg-remover' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
             <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <span 
                onClick={() => setCurrentView('home')} 
                className="hover:text-emerald-400 cursor-pointer transition-colors"
              >
                Home
              </span>
              <span>/</span>
              <span className="text-emerald-400">BG Remover</span>
            </div>
            
            <section className="min-h-[300px] flex flex-col">
              <h2 className="text-2xl font-bold text-white mb-4">Real-time Background Removal</h2>
              <VideoBackgroundRemover />
            </section>
          </div>
        )}

        {/* Smart Warp Tool View */}
        {currentView === 'smart-warp' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
             <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <span 
                onClick={() => setCurrentView('home')} 
                className="hover:text-amber-400 cursor-pointer transition-colors"
              >
                Home
              </span>
              <span>/</span>
              <span className="text-amber-400">Smart Warp Engine</span>
            </div>
            
            <section className="min-h-[300px] flex flex-col">
              <SmartWarpTool />
            </section>
          </div>
        )}

        {/* Pixel Art Studio Tool View */}
        {currentView === 'pixel-art' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
             <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <span 
                onClick={() => setCurrentView('home')} 
                className="hover:text-pink-400 cursor-pointer transition-colors"
              >
                Home
              </span>
              <span>/</span>
              <span className="text-pink-400">Pixel Art Studio</span>
            </div>
            
            <section className="min-h-[300px] flex flex-col">
              <PixelArtGenerator />
            </section>
          </div>
        )}

        {/* Animated Sprite Generator Tool View */}
        {currentView === 'sprite-animator' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
             <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <span 
                onClick={() => setCurrentView('home')} 
                className="hover:text-purple-400 cursor-pointer transition-colors"
              >
                Home
              </span>
              <span>/</span>
              <span className="text-purple-400">Sprite Animator AI</span>
            </div>
            
            <section className="min-h-[300px] flex flex-col">
              <AnimatedSpriteGenerator />
            </section>
          </div>
        )}

        {/* Image Enhancer HD Tool View */}
        {currentView === 'image-enhancer' && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
              <span 
                onClick={() => setCurrentView('home')} 
                className="hover:text-cyan-400 cursor-pointer transition-colors"
              >
                Home
              </span>
              <span>/</span>
              <span className="text-cyan-400">Image Enhancer HD</span>
            </div>
            
            <ImageEnhancer />
          </div>
        )}

        {/* Animation Maker Tool View */}
        {currentView === 'animation-maker' && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
              <span 
                onClick={() => setCurrentView('home')} 
                className="hover:text-rose-400 cursor-pointer transition-colors"
              >
                Home
              </span>
              <span>/</span>
              <span className="text-rose-400">Animation Maker</span>
            </div>
            
            <AnimationMaker />
          </div>
        )}

        {/* Batch BG Remover Tool View */}
        {currentView === 'batch-bg-remover' && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
              <span 
                onClick={() => setCurrentView('home')} 
                className="hover:text-indigo-400 cursor-pointer transition-colors"
              >
                Home
              </span>
              <span>/</span>
              <span className="text-indigo-400">Batch BG Remover</span>
            </div>
            
            <BatchBackgroundRemover />
          </div>
        )}

      </main>
    </div>
  );
};

export default App;