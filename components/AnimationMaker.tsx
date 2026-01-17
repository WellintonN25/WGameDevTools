import { useState, useRef, ChangeEvent } from 'react';
import { createGIF, createWebP, downloadAnimation, optimizeFrames, AnimationFrame, AnimationOptions } from '../services/animationService';
import { UploadIcon, DownloadIcon, SparklesIcon } from './Icons';

export default function AnimationMaker() {
  const [frames, setFrames] = useState<AnimationFrame[]>([]);
  const [fps, setFps] = useState(12);
  const [loop, setLoop] = useState(0); // 0 = infinite
  const [reverse, setReverse] = useState(false);
  const [quality, setQuality] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFrames: AnimationFrame[] = [];
    let loadedCount = 0;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newFrames.push({
          id: `${Date.now()}-${index}`,
          dataUrl: event.target?.result as string
        });
        loadedCount++;

        if (loadedCount === files.length) {
          setFrames(prev => [...prev, ...newFrames.sort((a, b) => a.id.localeCompare(b.id))]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFrame = (id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id));
  };

  const moveFrame = (index: number, direction: 'up' | 'down') => {
    const newFrames = [...frames];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= frames.length) return;
    
    [newFrames[index], newFrames[targetIndex]] = [newFrames[targetIndex], newFrames[index]];
    setFrames(newFrames);
  };

  const startPreview = () => {
    if (frames.length === 0) return;
    
    setIsPlaying(true);
    const delay = 1000 / fps;
    let frameIndex = 0;
    const framesToShow = reverse ? [...frames, ...frames.slice().reverse()] : frames;

    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        frameIndex = (frameIndex + 1) % framesToShow.length;
        setCurrentFrameIndex(frameIndex);
        
        animationRef.current = window.setTimeout(animate, delay);
      };
      img.src = framesToShow[frameIndex].dataUrl;
    };

    animate();
  };

  const stopPreview = () => {
    setIsPlaying(false);
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
  };

  const handleExportGIF = async () => {
    if (frames.length === 0) {
      alert('Adicione pelo menos um frame!');
      return;
    }

    setIsProcessing(true);
    try {
      const optimized = await optimizeFrames(frames, 800);
      const options: AnimationOptions = { fps, loop, reverse, quality };
      const blob = await createGIF(optimized, options);
      downloadAnimation(blob, `animation_${Date.now()}.gif`);
    } catch (error) {
      console.error('Error creating GIF:', error);
      alert('Erro ao criar GIF. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportWebP = async () => {
    if (frames.length === 0) {
      alert('Adicione pelo menos um frame!');
      return;
    }

    setIsProcessing(true);
    try {
      const optimized = await optimizeFrames(frames, 800);
      const options: AnimationOptions = { fps, loop, reverse, quality };
      const blob = await createWebP(optimized, options);
      downloadAnimation(blob, `animation_${Date.now()}.webp`);
    } catch (error) {
      console.error('Error creating WebP:', error);
      alert('Erro ao criar WebP. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          🎬 Animation Maker
        </h1>
        <p className="text-purple-200 text-center mb-8">
          Crie GIFs e WebPs animados a partir de múltiplos frames
        </p>

        {/* Upload Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
          <label className="block mb-4">
            <span className="text-white font-semibold mb-2 block">📁 Upload de Frames</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="block w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600 file:cursor-pointer"
            />
          </label>
          <p className="text-purple-200 text-sm">
            Selecione múltiplas imagens (PNG, JPG, WebP). A ordem pode ser ajustada depois.
          </p>
        </div>

        {/* Frames List */}
        {frames.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              🎞️ Frames ({frames.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {frames.map((frame, index) => (
                <div key={frame.id} className="relative bg-white/5 rounded-lg p-2">
                  <img
                    src={frame.dataUrl}
                    alt={`Frame ${index + 1}`}
                    className="w-full h-32 object-contain rounded"
                  />
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    #{index + 1}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => moveFrame(index, 'up')}
                      disabled={index === 0}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white text-xs py-1 rounded"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveFrame(index, 'down')}
                      disabled={index === frames.length - 1}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white text-xs py-1 rounded"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeFrame(frame.id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-1 rounded"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {frames.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">⚙️ Configurações</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* FPS */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  🎥 FPS (Frames por segundo): {fps}
                </label>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-purple-200 text-sm mt-1">
                  Recomendado: 12 fps (animação), 24 fps (suave)
                </p>
              </div>

              {/* Quality */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  ✨ Qualidade: {quality}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-purple-200 text-sm mt-1">
                  Maior qualidade = arquivo maior
                </p>
              </div>

              {/* Loop */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  🔁 Loop
                </label>
                <select
                  value={loop}
                  onChange={(e) => setLoop(Number(e.target.value))}
                  className="w-full bg-white/20 text-white rounded-lg px-4 py-2 border border-white/30"
                >
                  <option value={0}>Infinito</option>
                  <option value={1}>1 vez</option>
                  <option value={3}>3 vezes</option>
                  <option value={5}>5 vezes</option>
                </select>
              </div>

              {/* Reverse */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reverse}
                    onChange={(e) => setReverse(e.target.checked)}
                    className="mr-2 w-5 h-5"
                  />
                  <span className="text-white font-semibold">
                    🔄 Ping-Pong (ida e volta)
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        {frames.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">👁️ Preview</h2>
            <div className="bg-white/5 rounded-lg p-4 flex flex-col items-center justify-center min-h-[400px]">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[500px] object-contain rounded-lg mb-4"
              />
              <div className="flex gap-4">
                {!isPlaying ? (
                  <button
                    onClick={startPreview}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-all"
                  >
                    ▶️ Play
                  </button>
                ) : (
                  <button
                    onClick={stopPreview}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-all"
                  >
                    ⏸️ Pause
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Export */}
        {frames.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">💾 Exportar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleExportGIF}
                disabled={isProcessing}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isProcessing ? '⏳ Processando...' : '📦 Download GIF'}
              </button>
              <button
                onClick={handleExportWebP}
                disabled={isProcessing}
                className="bg-gradient-to-r from-pink-500 to-red-600 hover:from-pink-600 hover:to-red-700 text-white font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isProcessing ? '⏳ Processando...' : '🖼️ Download WebP'}
              </button>
            </div>
            <p className="text-purple-200 text-sm mt-4 text-center">
              GIF: Melhor compatibilidade | WebP: Menor tamanho (Chrome/Edge)
            </p>
          </div>
        )}

        {/* Info */}
        {frames.length === 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
            <p className="text-purple-200 text-lg mb-4">
              📸 Faça upload de 2 ou mais frames para começar
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-left">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">📁</div>
                <h4 className="text-white font-semibold mb-1">Upload Múltiplo</h4>
                <p className="text-purple-200 text-sm">Selecione vários frames de uma vez</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">🎥</div>
                <h4 className="text-white font-semibold mb-1">Controle Total</h4>
                <p className="text-purple-200 text-sm">Ajuste FPS, loop e qualidade</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">💾</div>
                <h4 className="text-white font-semibold mb-1">Export Fácil</h4>
                <p className="text-purple-200 text-sm">GIF ou WebP com um clique</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
