import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VideoMetadata, CapturedFrame } from '../types';
import { CameraIcon, PlayIcon, PauseIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from './Icons';

interface VideoWorkspaceProps {
  videoFile: File;
  onClose: () => void;
  onCapture: (frame: CapturedFrame) => void;
}

const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({ videoFile, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  // Initialize video
  useEffect(() => {
    const videoUrl = URL.createObjectURL(videoFile);
    if (videoRef.current) {
      videoRef.current.src = videoUrl;
      videoRef.current.load();
    }

    return () => {
      URL.revokeObjectURL(videoUrl);
    };
  }, [videoFile]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setMetadata({
        name: videoFile.name,
        duration: videoRef.current.duration,
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
        url: videoRef.current.src
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const stepFrame = (frames: number) => {
    if (videoRef.current) {
      // Assuming 30fps for simplicity, or we could just jump 0.04s
      const frameDuration = 1 / 30;
      videoRef.current.currentTime = Math.min(Math.max(videoRef.current.currentTime + (frames * frameDuration), 0), duration);
    }
  };

  const captureFrame = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/png');
        
        const newFrame: CapturedFrame = {
          id: crypto.randomUUID(),
          dataUrl,
          timestamp: video.currentTime,
          isAnalyzing: false
        };
        
        onCapture(newFrame);
      }
    }
  }, [onCapture]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      {/* Header */}
      <div className="flex justify-between items-center p-3 sm:p-4 bg-slate-800 border-b border-slate-700">
        <h2 className="text-base sm:text-lg font-semibold text-slate-200 truncate max-w-[180px] sm:max-w-md">
          {metadata ? metadata.name : 'Loading Video...'}
        </h2>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
        >
          <XIcon />
        </button>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
        <video
          ref={videoRef}
          className="max-h-full max-w-full w-full h-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />
        {/* Hidden Canvas for Processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-3 sm:p-4 bg-slate-800 border-t border-slate-700 space-y-3 sm:space-y-4">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-[10px] sm:text-xs font-mono text-slate-400 w-12 sm:w-16 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.01"
            value={currentTime}
            onChange={seek}
            className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
          />
          <span className="text-[10px] sm:text-xs font-mono text-slate-400 w-12 sm:w-16">{formatTime(duration)}</span>
        </div>

        {/* Buttons */}
        <div className="flex justify-center items-center gap-3 sm:gap-6">
          <div className="flex gap-1 sm:gap-2">
            <button 
              onClick={() => stepFrame(-1)}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all active:scale-95"
              title="Previous Frame"
            >
              <ChevronLeftIcon />
            </button>
            <button 
              onClick={togglePlay}
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button 
              onClick={() => stepFrame(1)}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all active:scale-95"
              title="Next Frame"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="w-px h-8 bg-slate-700 mx-1 sm:mx-2"></div>

          <button 
            onClick={captureFrame}
            className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <CameraIcon />
            <span className="text-sm sm:text-base">Snap Frame</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoWorkspace;