import { useState, ChangeEvent } from 'react';
import { processImage, downloadImage, EnhancementOptions, ProcessedImage } from '../services/imageEnhancementService';

export default function ImageEnhancer() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [options, setOptions] = useState<EnhancementOptions>({
    scale: 2,
    algorithm: 'bicubic',
    sharpen: 30,
    noiseReduction: 20,
    contrast: 15,
    edgeEnhancement: 10,
    colorVibrance: 20,
  });

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setOriginalImage(event.target?.result as string);
      setProcessedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    if (!originalImage) return;

    setIsProcessing(true);
    try {
      // Convert data URL back to file
      const response = await fetch(originalImage);
      const blob = await response.blob();
      const file = new File([blob], 'image.png', { type: 'image/png' });

      const result = await processImage(file, options);
      setProcessedImage(result);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Erro ao processar imagem. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    downloadImage(processedImage.dataUrl, `enhanced_${Date.now()}.png`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          🎨 Image Enhancer HD
        </h1>
        <p className="text-blue-200 text-center mb-8">
          Melhore a qualidade das suas imagens com upscaling e filtros avançados
        </p>

        {/* Upload Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
          <label className="block mb-4">
            <span className="text-white font-semibold mb-2 block">📁 Upload de Imagem</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="block w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 file:cursor-pointer"
            />
          </label>
        </div>

        {/* Controls */}
        {originalImage && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">⚙️ Configurações</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upscaling */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  📏 Escala de Upscaling
                </label>
                <select
                  value={options.scale}
                  onChange={(e) => setOptions({ ...options, scale: Number(e.target.value) })}
                  className="w-full bg-white/20 text-white rounded-lg px-4 py-2 border border-white/30"
                >
                  <option value={1}>1x (Original)</option>
                  <option value={2}>2x (Dobro)</option>
                  <option value={4}>4x (Quádruplo)</option>
                  <option value={8}>8x (8 vezes)</option>
                </select>
              </div>

              {/* Algorithm */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  🔬 Algoritmo
                </label>
                <select
                  value={options.algorithm}
                  onChange={(e) => setOptions({ ...options, algorithm: e.target.value as any })}
                  className="w-full bg-white/20 text-white rounded-lg px-4 py-2 border border-white/30"
                >
                  <option value="bicubic">Bicubic (Suave)</option>
                  <option value="nearest">Nearest (Pixel Art)</option>
                </select>
              </div>

              {/* Sharpen */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  ✨ Nitidez: {options.sharpen}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={options.sharpen}
                  onChange={(e) => setOptions({ ...options, sharpen: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Noise Reduction */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  🔇 Redução de Ruído: {options.noiseReduction}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={options.noiseReduction}
                  onChange={(e) => setOptions({ ...options, noiseReduction: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Contrast */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  🌓 Contraste: {options.contrast}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={options.contrast}
                  onChange={(e) => setOptions({ ...options, contrast: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Edge Enhancement */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  📐 Realce de Bordas: {options.edgeEnhancement}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={options.edgeEnhancement}
                  onChange={(e) => setOptions({ ...options, edgeEnhancement: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Color Vibrance */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  🎨 Saturação de Cores: {options.colorVibrance}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={options.colorVibrance}
                  onChange={(e) => setOptions({ ...options, colorVibrance: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Process Button */}
            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className="w-full mt-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-8 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isProcessing ? '⏳ Processando...' : '🚀 Processar Imagem'}
            </button>
          </div>
        )}

        {/* Preview */}
        {originalImage && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Original */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">📷 Original</h3>
              <div className="bg-white/5 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                <img
                  src={originalImage}
                  alt="Original"
                  className="max-w-full max-h-[500px] object-contain rounded-lg"
                />
              </div>
            </div>

            {/* Processed */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">✨ Melhorada</h3>
              <div className="bg-white/5 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                {processedImage ? (
                  <div className="w-full">
                    <img
                      src={processedImage.dataUrl}
                      alt="Processed"
                      className="max-w-full max-h-[500px] object-contain rounded-lg mx-auto"
                    />
                    <div className="mt-4 text-center">
                      <p className="text-blue-200 text-sm mb-2">
                        {processedImage.width} x {processedImage.height} px
                      </p>
                      <p className="text-blue-200 text-sm mb-4">
                        Processado em {processedImage.processingTime.toFixed(0)}ms
                      </p>
                      <button
                        onClick={handleDownload}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-all"
                      >
                        💾 Download
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-blue-200 text-center">
                    Clique em "Processar Imagem" para ver o resultado
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        {!originalImage && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
            <p className="text-blue-200 text-lg mb-4">
              📸 Faça upload de uma imagem para começar
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 text-left">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">📏</div>
                <h4 className="text-white font-semibold mb-1">Upscaling</h4>
                <p className="text-blue-200 text-sm">Amplie até 8x sem perder qualidade</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">✨</div>
                <h4 className="text-white font-semibold mb-1">Nitidez</h4>
                <p className="text-blue-200 text-sm">Realce detalhes e bordas</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">🔇</div>
                <h4 className="text-white font-semibold mb-1">Ruído</h4>
                <p className="text-blue-200 text-sm">Reduza granulação e artefatos</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">🌓</div>
                <h4 className="text-white font-semibold mb-1">Contraste</h4>
                <p className="text-blue-200 text-sm">Melhore luminosidade</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">📐</div>
                <h4 className="text-white font-semibold mb-1">Bordas</h4>
                <p className="text-blue-200 text-sm">Realce contornos</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl mb-2">🎨</div>
                <h4 className="text-white font-semibold mb-1">Cores</h4>
                <p className="text-blue-200 text-sm">Aumente saturação</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
