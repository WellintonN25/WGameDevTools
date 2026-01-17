import React, { useState, useRef, useEffect } from 'react';
import { 
  convertToSprite, 
  rotateSprite, 
  generateAnimationFrames,
  downloadFrame,
  downloadAllFrames,
  createSpriteSheet,
  AnimationFrame 
} from '../services/spriteAnimationService';
import { UploadIcon, SparklesIcon } from './Icons';

const AnimatedSpriteGenerator: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [spriteDataUrl, setSpriteDataUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [rotatedSpriteUrl, setRotatedSpriteUrl] = useState<string | null>(null);
  const [animationPrompt, setAnimationPrompt] = useState<string>('');
  const [frameCount, setFrameCount] = useState<8 | 10 | 12>(10);
  const [generatedFrames, setGeneratedFrames] = useState<AnimationFrame[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(100); // ms per frame
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationIntervalRef = useRef<number | null>(null);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processImageFile(e.target.files[0]);
    }
  };

  const processImageFile = async (file: File) => {
    setIsProcessing(true);
    try {
      setOriginalImage(file);
      const spriteUrl = await convertToSprite(file);
      setSpriteDataUrl(spriteUrl);
      setRotatedSpriteUrl(spriteUrl);
      setRotation(0);
      setGeneratedFrames([]);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        await processImageFile(file);
      } else {
        alert('Please upload an image file (PNG, JPG, WebP)');
      }
    }
  };

  // Handle rotation
  useEffect(() => {
    if (spriteDataUrl && rotation !== 0) {
      rotateSprite(spriteDataUrl, rotation).then(setRotatedSpriteUrl);
    } else if (spriteDataUrl) {
      setRotatedSpriteUrl(spriteDataUrl);
    }
  }, [rotation, spriteDataUrl]);

  // Handle animation generation
  const handleGenerateAnimation = async () => {
    if (!rotatedSpriteUrl || !animationPrompt.trim()) {
      alert('Please upload an image and enter an animation prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const frames = await generateAnimationFrames(rotatedSpriteUrl, animationPrompt, frameCount);
      setGeneratedFrames(frames);
      setCurrentFrameIndex(0);
    } catch (error: any) {
      console.error('Error generating animation:', error);
      alert(error.message || 'Failed to generate animation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Animation playback
  useEffect(() => {
    if (isPlaying && generatedFrames.length > 0) {
      animationIntervalRef.current = window.setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % generatedFrames.length);
      }, animationSpeed);
    } else {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    }

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [isPlaying, generatedFrames.length, animationSpeed]);

  // Download handlers
  const handleDownloadSpriteSheet = async () => {
    if (generatedFrames.length === 0) return;
    try {
      const spriteSheetUrl = await createSpriteSheet(generatedFrames);
      downloadFrame(spriteSheetUrl, 'sprite_sheet.png');
    } catch (error) {
      console.error('Error creating sprite sheet:', error);
      alert('Failed to create sprite sheet');
    }
  };

  const promptExamples = [
    'movimento suave nas mãos',
    'cabelo balançando com o vento',
    'respiração natural do peito',
    'piscada de olhos suave',
    'balanço leve do corpo',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <SparklesIcon />
          </div>
          Gerador de Sprites Animados
        </h2>
        <p className="text-slate-400">
          Transforme imagens estáticas em sprites animados usando IA. Perfeito para jogos 2D!
        </p>
      </div>

      {/* Upload Section */}
      {!spriteDataUrl ? (
        <div
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-all duration-200 cursor-pointer min-h-[400px]
            ${dragActive 
              ? 'border-purple-500 bg-purple-500/10' 
              : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'
            }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
            <UploadIcon />
          </div>
          <h3 className="text-2xl font-semibold text-white mb-2">Upload uma Imagem</h3>
          <p className="text-slate-400 text-center max-w-md">
            Arraste e solte sua imagem aqui, ou clique para selecionar
            <br />
            <span className="text-xs mt-2 block text-slate-600">Suporta PNG, JPG, WebP</span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Sprite Preview and Controls */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Preview do Sprite</h3>
              <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-center min-h-[300px] relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%,#1e293b),linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%,#1e293b)] bg-[length:20px_20px] bg-[position:0_0,10px_10px] opacity-20"></div>
                {rotatedSpriteUrl && (
                  <img
                    src={rotatedSpriteUrl}
                    alt="Sprite"
                    className="max-w-full max-h-[300px] object-contain relative z-10"
                  />
                )}
              </div>

              {/* Rotation Control */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-300">Rotação</label>
                  <span className="text-sm text-purple-400 font-mono">{rotation}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <button
                onClick={() => {
                  setOriginalImage(null);
                  setSpriteDataUrl(null);
                  setRotatedSpriteUrl(null);
                  setGeneratedFrames([]);
                  setRotation(0);
                }}
                className="mt-4 w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Carregar Nova Imagem
              </button>
            </div>
          </div>

          {/* Right Column: Animation Controls */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Geração de Animação</h3>

              {/* Prompt Input */}
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-slate-300">
                  Descreva a animação desejada
                </label>
                <textarea
                  value={animationPrompt}
                  onChange={(e) => setAnimationPrompt(e.target.value)}
                  placeholder="Ex: movimento suave nas mãos, cabelo balançando com o vento..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  {promptExamples.map((example) => (
                    <button
                      key={example}
                      onClick={() => setAnimationPrompt(example)}
                      className="text-xs px-3 py-1 bg-slate-800 hover:bg-purple-500/20 text-slate-400 hover:text-purple-400 rounded-full transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Count Selection */}
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-slate-300">Quantidade de Frames</label>
                <div className="flex gap-3">
                  {([8, 10, 12] as const).map((count) => (
                    <button
                      key={count}
                      onClick={() => setFrameCount(count)}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                        frameCount === count
                          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {count} frames
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateAnimation}
                disabled={isGenerating || !animationPrompt.trim()}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg shadow-purple-500/30 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Gerando Animação...
                  </>
                ) : (
                  <>
                    <SparklesIcon />
                    Gerar Animação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation Preview and Download */}
      {generatedFrames.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Preview da Animação</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Animation Player */}
            <div className="space-y-4">
              <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-center min-h-[300px] relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%,#1e293b),linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%,#1e293b)] bg-[length:20px_20px] bg-[position:0_0,10px_10px] opacity-20"></div>
                <img
                  src={generatedFrames[currentFrameIndex].dataUrl}
                  alt={`Frame ${currentFrameIndex + 1}`}
                  className="max-w-full max-h-[300px] object-contain relative z-10"
                />
              </div>

              {/* Playback Controls */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium"
                  >
                    {isPlaying ? 'Pausar' : 'Reproduzir'}
                  </button>
                  <button
                    onClick={() => setCurrentFrameIndex(0)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-300">Velocidade</label>
                    <span className="text-sm text-purple-400 font-mono">{animationSpeed}ms</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                <div className="text-sm text-slate-400 text-center">
                  Frame {currentFrameIndex + 1} de {generatedFrames.length}
                </div>
              </div>
            </div>

            {/* Download Options */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-white">Download</h4>
              
              <button
                onClick={() => downloadAllFrames(generatedFrames, 'sprite_animation')}
                className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
              >
                Baixar Todos os Frames
              </button>

              <button
                onClick={handleDownloadSpriteSheet}
                className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
              >
                Baixar Sprite Sheet
              </button>

              <button
                onClick={() => downloadFrame(generatedFrames[currentFrameIndex].dataUrl, `frame_${currentFrameIndex + 1}.png`)}
                className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
              >
                Baixar Frame Atual
              </button>

              {/* Frame Thumbnails */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Todos os Frames</h4>
                <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                  {generatedFrames.map((frame, index) => (
                    <button
                      key={frame.id}
                      onClick={() => setCurrentFrameIndex(index)}
                      className={`aspect-square bg-slate-950 rounded-lg p-1 border-2 transition-all ${
                        currentFrameIndex === index
                          ? 'border-purple-500'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <img
                        src={frame.dataUrl}
                        alt={`Frame ${index + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimatedSpriteGenerator;
