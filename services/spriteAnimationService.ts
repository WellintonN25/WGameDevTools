import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export interface AnimationFrame {
  id: string;
  dataUrl: string;
  frameNumber: number;
}

/**
 * Convert an image to sprite style using canvas processing
 */
export async function convertToSprite(imageFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw the image
        ctx.drawImage(img, 0, 0);

        // Apply sprite-like processing (optional enhancement)
        // You can add filters here if needed

        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Rotate a sprite image by specified degrees
 */
export function rotateSprite(
  imageDataUrl: string,
  degrees: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Calculate new canvas size to fit rotated image
      const radians = (degrees * Math.PI) / 180;
      const sin = Math.abs(Math.sin(radians));
      const cos = Math.abs(Math.cos(radians));
      const newWidth = img.width * cos + img.height * sin;
      const newHeight = img.width * sin + img.height * cos;

      canvas.width = newWidth;
      canvas.height = newHeight;

      // Translate to center, rotate, then translate back
      ctx.translate(newWidth / 2, newHeight / 2);
      ctx.rotate(radians);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image for rotation"));
    img.src = imageDataUrl;
  });
}

/**
 * Generate animation frames using AI (Gemini or Grok)
 */
export async function generateAnimationFrames(
  baseImageDataUrl: string,
  prompt: string,
  frameCount: number,
  aiProvider: 'gemini' | 'grok' = 'gemini',
): Promise<AnimationFrame[]> {
  const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY || '';
  
  if (aiProvider === 'gemini' && !API_KEY) {
    throw new Error(
      "Gemini API key not configured. Please set VITE_GEMINI_API_KEY in .env.local",
    );
  }
  
  if (aiProvider === 'grok' && !GROK_API_KEY) {
    throw new Error(
      "Grok API key not configured. Please set VITE_GROK_API_KEY in .env.local",
    );
  }

  try {
    let aiAnalysis = '';
    
    // Importar configuração do backend
    const { BACKEND_URL, USE_BACKEND_PROXY } = await import('./backendConfig');
    
    if (USE_BACKEND_PROXY) {
      // Usar backend proxy (seguro)
      const endpoint = aiProvider === 'gemini' ? '/api/gemini' : '/api/grok';
      const base64Data = baseImageDataUrl.split(",")[1];
      
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageData: base64Data,
          frameCount,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Backend error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      aiAnalysis = data.text || '';
    } else {
      // Usar chamadas diretas (desenvolvimento)
      if (aiProvider === 'gemini') {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Convert base64 to proper format for Gemini
        const base64Data = baseImageDataUrl.split(",")[1];

        const systemPrompt = `You are an expert sprite animator for game development. 
Your task is to analyze the provided sprite image and create ${frameCount} animation frames based on the user's animation request.

User's animation request: "${prompt}"

Please provide detailed descriptions for ${frameCount} sequential animation frames that would create smooth, natural movement.
Each frame description should specify:
1. The frame number (1-${frameCount})
2. Specific changes from the base image (position, rotation, deformation)
3. Which parts of the sprite should move and how

Format your response as a JSON array of frame descriptions.`;

        const result = await model.generateContent([
          systemPrompt,
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Data,
            },
          },
        ]);

        const response = await result.response;
        aiAnalysis = response.text();
      } else {
        // Use Grok API
        const { analyzeFrameWithGrok } = await import('./grokService');
        aiAnalysis = await analyzeFrameWithGrok(baseImageDataUrl, prompt);
      }
    }

    // For now, we'll create interpolated frames based on the AI's analysis
    // In a production environment, you might use image generation APIs
    const frames = await createInterpolatedFrames(
      baseImageDataUrl,
      frameCount,
      aiAnalysis,
    );

    return frames;
  } catch (error) {
    console.error(`Error generating animation frames with ${aiProvider}:`, error);
    const modelName = aiProvider === 'gemini' ? 'Gemini' : 'Grok';
    throw new Error(
      `Failed to generate animation frames using ${modelName}. Please check your ${aiProvider.toUpperCase()}_API_KEY and try again.`,
    );
  }
}

/**
 * Create interpolated frames based on AI analysis
 * This is a simplified version - in production, you'd use more sophisticated techniques
 */
async function createInterpolatedFrames(
  baseImageDataUrl: string,
  frameCount: number,
  aiAnalysis: string,
): Promise<AnimationFrame[]> {
  const frames: AnimationFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const progress = i / (frameCount - 1);
    const frameDataUrl = await applyFrameTransformation(
      baseImageDataUrl,
      progress,
      aiAnalysis,
    );

    frames.push({
      id: `frame-${i}`,
      dataUrl: frameDataUrl,
      frameNumber: i + 1,
    });
  }

  return frames;
}

/**
 * Analyze prompt to determine animation type and parameters
 */
function analyzePrompt(prompt: string): {
  type: 'rotate' | 'jump' | 'swing' | 'fly' | 'bounce' | 'wave' | 'default';
  intensity: number;
} {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('gir') || lowerPrompt.includes('rotat') || lowerPrompt.includes('spin')) {
    return { type: 'rotate', intensity: 1.0 };
  }
  if (lowerPrompt.includes('pul') || lowerPrompt.includes('jump') || lowerPrompt.includes('salt')) {
    return { type: 'jump', intensity: 0.8 };
  }
  if (lowerPrompt.includes('balan') || lowerPrompt.includes('swing') || lowerPrompt.includes('sway')) {
    return { type: 'swing', intensity: 0.6 };
  }
  if (lowerPrompt.includes('vo') || lowerPrompt.includes('fly') || lowerPrompt.includes('float')) {
    return { type: 'fly', intensity: 0.7 };
  }
  if (lowerPrompt.includes('quic') || lowerPrompt.includes('bounce')) {
    return { type: 'bounce', intensity: 0.9 };
  }
  if (lowerPrompt.includes('ond') || lowerPrompt.includes('wave')) {
    return { type: 'wave', intensity: 0.5 };
  }
  
  return { type: 'default', intensity: 0.4 };
}

/**
 * Render 3D rotation using vertical slicing technique
 * This creates a realistic 3D effect by rendering the image in vertical slices with perspective
 */
function render3DRotation(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rotateY: number,
  centerX: number,
  centerY: number,
): void {
  const sliceCount = 40; // Number of vertical slices
  const sliceWidth = img.width / sliceCount;
  
  // Draw each slice with perspective
  for (let i = 0; i < sliceCount; i++) {
    const sliceX = i * sliceWidth;
    
    // Calculate 3D position for this slice
    // Map slice position to -1 to 1 range
    const normalizedX = (i / sliceCount) * 2 - 1;
    
    // Calculate Z position based on rotation
    const angle = rotateY;
    const z = Math.sin(angle) * normalizedX;
    const x = Math.cos(angle) * normalizedX;
    
    // Apply perspective
    const perspective = 600; // Distance to viewer
    const scale = perspective / (perspective + z * 100);
    
    // Calculate slice dimensions with perspective
    const sliceDrawWidth = sliceWidth * scale;
    const sliceDrawHeight = img.height * scale;
    
    // Calculate position
    const drawX = centerX + x * (img.width / 2) * Math.cos(angle) - sliceDrawWidth / 2;
    const drawY = centerY - sliceDrawHeight / 2;
    
    // Apply lighting based on angle to surface
    const lighting = (Math.cos(angle + normalizedX * Math.PI) + 1) / 2;
    const brightness = 0.5 + lighting * 0.5; // Range from 0.5 to 1.0
    
    ctx.save();
    
    // Apply brightness
    ctx.globalAlpha = brightness;
    
    // Draw the slice
    ctx.drawImage(
      img,
      sliceX, 0, sliceWidth, img.height, // Source
      drawX, drawY, sliceDrawWidth, sliceDrawHeight // Destination
    );
    
    ctx.restore();
  }
}

/**
 * Apply 3D transformation to create immersive animation frame
 */
async function applyFrameTransformation(
  imageDataUrl: string,
  progress: number,
  aiAnalysis: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Increase canvas size to accommodate 3D transformations and shadows
      const padding = 150;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;

      // Analyze AI response to determine animation type
      const animation = analyzePrompt(aiAnalysis);
      
      // Calculate animation parameters based on progress and type
      const t = progress * Math.PI * 2; // Full cycle
      let rotateX = 0, rotateY = 0, rotateZ = 0;
      let translateX = 0, translateY = 0;
      let scale = 1;
      let shadowOffsetX = 0, shadowOffsetY = 0, shadowBlur = 0;
      let use3DRotation = false;

      switch (animation.type) {
        case 'rotate':
          // Full 3D rotation using slicing technique
          rotateY = t * animation.intensity;
          use3DRotation = true;
          translateY = Math.sin(t) * 10; // Slight vertical movement
          shadowOffsetX = Math.sin(rotateY) * 30;
          shadowOffsetY = 15;
          shadowBlur = 20 + Math.abs(Math.sin(t)) * 10;
          break;

        case 'jump':
          // Jumping motion with arc
          const jumpProgress = Math.sin(t);
          translateY = -Math.abs(jumpProgress) * 100 * animation.intensity;
          rotateX = jumpProgress * 0.15;
          scale = 1 - Math.abs(jumpProgress) * 0.08; // Squash and stretch
          shadowOffsetY = 25 + Math.abs(jumpProgress) * 40;
          shadowBlur = 15 + Math.abs(jumpProgress) * 25;
          break;

        case 'swing':
          // Pendulum swing with subtle 3D rotation
          const swingAngle = Math.sin(t) * 0.5 * animation.intensity;
          rotateY = swingAngle;
          use3DRotation = swingAngle > 0.2 || swingAngle < -0.2;
          rotateZ = swingAngle * 0.3;
          translateX = Math.sin(t) * 20;
          shadowOffsetX = Math.sin(t) * 20;
          shadowOffsetY = 12;
          shadowBlur = 15;
          break;

        case 'fly':
          // Flying/floating motion
          translateY = Math.sin(t) * 40 * animation.intensity;
          translateX = Math.cos(t * 0.5) * 25;
          rotateZ = Math.sin(t) * 0.08;
          scale = 1 + Math.sin(t) * 0.06;
          shadowOffsetY = 20 + Math.abs(Math.sin(t)) * 15;
          shadowBlur = 25;
          break;

        case 'bounce':
          // Bouncing motion
          const bounceProgress = Math.abs(Math.sin(t * 2));
          translateY = -bounceProgress * 80 * animation.intensity;
          scale = 1 + (1 - bounceProgress) * 0.2; // Squash on impact
          shadowOffsetY = 20 + bounceProgress * 35;
          shadowBlur = 10 + bounceProgress * 20;
          break;

        case 'wave':
          // Wave/breathing effect
          const wave = Math.sin(t);
          scale = 1 + wave * 0.1 * animation.intensity;
          rotateZ = wave * 0.06;
          translateY = wave * 8;
          shadowOffsetY = 15;
          shadowBlur = 12;
          break;

        default:
          // Subtle breathing animation
          const breathe = Math.sin(t);
          scale = 1 + breathe * 0.04;
          translateY = breathe * 5;
          shadowOffsetY = 12;
          shadowBlur = 10;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate center position
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Draw shadow first
      if (shadowBlur > 0) {
        ctx.save();
        ctx.translate(centerX + translateX, centerY + translateY);
        
        // Draw elliptical shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.filter = `blur(${shadowBlur}px)`;
        ctx.beginPath();
        ctx.ellipse(
          shadowOffsetX,
          shadowOffsetY + img.height / 2,
          img.width / 3,
          img.height / 8,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
      }

      ctx.save();
      ctx.translate(centerX + translateX, centerY + translateY);

      // Apply transformations based on animation type
      if (use3DRotation) {
        // Use realistic 3D rotation with slicing
        render3DRotation(ctx, img, rotateY, 0, 0);
      } else {
        // Use standard 2D transformations for other animations
        
        // Apply rotateX effect (tilt forward/backward)
        if (Math.abs(rotateX) > 0.01) {
          const tiltScale = Math.cos(rotateX);
          ctx.scale(1, tiltScale);
        }

        // Apply rotateZ (standard 2D rotation)
        if (Math.abs(rotateZ) > 0.01) {
          ctx.rotate(rotateZ);
        }

        // Apply scale
        ctx.scale(scale, scale);

        // Draw image centered
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
      }

      ctx.restore();

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () =>
      reject(new Error("Failed to load image for transformation"));
    img.src = imageDataUrl;
  });
}

/**
 * Download a single frame
 */
export function downloadFrame(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download all frames as individual files
 */
export function downloadAllFrames(
  frames: AnimationFrame[],
  baseName: string = "sprite",
): void {
  frames.forEach((frame, index) => {
    const paddedNumber = String(index + 1).padStart(3, "0");
    downloadFrame(frame.dataUrl, `${baseName}_frame_${paddedNumber}.png`);
  });
}

/**
 * Create a sprite sheet from frames
 */
export async function createSpriteSheet(
  frames: AnimationFrame[],
): Promise<string> {
  if (frames.length === 0) {
    throw new Error("No frames to create sprite sheet");
  }

  return new Promise((resolve, reject) => {
    const firstImg = new Image();
    firstImg.onload = () => {
      const frameWidth = firstImg.width;
      const frameHeight = firstImg.height;
      const cols = Math.ceil(Math.sqrt(frames.length));
      const rows = Math.ceil(frames.length / cols);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      canvas.width = frameWidth * cols;
      canvas.height = frameHeight * rows;

      let loadedCount = 0;
      const images: HTMLImageElement[] = [];

      frames.forEach((frame, index) => {
        const img = new Image();
        img.onload = () => {
          images[index] = img;
          loadedCount++;

          if (loadedCount === frames.length) {
            // Draw all frames in grid
            images.forEach((image, idx) => {
              const col = idx % cols;
              const row = Math.floor(idx / cols);
              ctx.drawImage(image, col * frameWidth, row * frameHeight);
            });

            resolve(canvas.toDataURL("image/png"));
          }
        };
        img.onerror = () => reject(new Error(`Failed to load frame ${index}`));
        img.src = frame.dataUrl;
      });
    };
    firstImg.onerror = () => reject(new Error("Failed to load first frame"));
    firstImg.src = frames[0].dataUrl;
  });
}
