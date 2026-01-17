import React from 'react';
import { CapturedFrame } from '../types';
import { DownloadIcon, TrashIcon, SparklesIcon } from './Icons';

interface FrameGalleryProps {
  frames: CapturedFrame[];
  onDelete: (id: string) => void;
  onAnalyze: (id: string) => void;
}

const FrameGallery: React.FC<FrameGalleryProps> = ({ frames, onDelete, onAnalyze }) => {
  if (frames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 border-2 border-dashed border-slate-700 rounded-xl p-6 sm:p-8 bg-slate-800/30">
        <div className="mb-4 p-4 bg-slate-800 rounded-full opacity-50">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <p className="text-lg text-center">No frames captured yet.</p>
        <p className="text-sm text-center mt-1">Use the "Snap Frame" button to extract images.</p>
      </div>
    );
  }

  const handleDownload = (frame: CapturedFrame) => {
    const link = document.createElement('a');
    link.href = frame.dataUrl;
    link.download = `frame-${frame.timestamp.toFixed(2)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 auto-rows-min pb-20">
      {frames.map((frame) => (
        <div key={frame.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-lg group flex flex-col">
          <div className="relative aspect-video bg-black overflow-hidden">
            <img 
              src={frame.dataUrl} 
              alt={`Frame at ${frame.timestamp}`} 
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button 
                onClick={() => handleDownload(frame)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
                title="Download"
              >
                <DownloadIcon />
              </button>
              <button 
                onClick={() => onDelete(frame.id)}
                className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-lg backdrop-blur-sm transition-colors"
                title="Delete"
              >
                <TrashIcon />
              </button>
            </div>
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs font-mono rounded backdrop-blur-md">
              {frame.timestamp.toFixed(2)}s
            </div>
          </div>
          
          <div className="p-3 sm:p-4 flex-1 flex flex-col">
            {frame.analysis ? (
              <div className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 mb-3 flex-1">
                <p className="leading-relaxed">{frame.analysis}</p>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            
            <div className="pt-2">
               {!frame.analysis && (
                <button
                  onClick={() => onAnalyze(frame.id)}
                  disabled={frame.isAnalyzing}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {frame.isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      <span>Analyze Frame</span>
                    </>
                  )}
                </button>
               )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FrameGallery;