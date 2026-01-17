// Grok API Service for xAI integration

const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY || '';
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const analyzeFrameWithGrok = async (base64Image: string, prompt: string): Promise<string> => {
  if (!GROK_API_KEY) {
    throw new Error('Grok API key not configured. Please set VITE_GROK_API_KEY in .env.local');
  }

  try {
    // Remove the data URL prefix
    const base64Data = base64Image.split(',')[1];

    const messages: GrokMessage[] = [
      {
        role: 'system',
        content: 'You are an expert sprite animator for game development. Analyze images and provide detailed animation descriptions.',
      },
      {
        role: 'user',
        content: `Analyze this sprite image and provide detailed animation frame descriptions for: "${prompt}". 
        
Focus on:
1. Natural movement patterns
2. 3D rotation effects (rotateX, rotateY, rotateZ)
3. Perspective changes
4. Shadow and lighting variations
5. Smooth transitions between frames

Provide specific transformation values and timing for each frame.`,
      },
    ];

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-2-vision-1212',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Grok API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No analysis available.';
  } catch (error) {
    console.error('Grok analysis error:', error);
    throw new Error('Failed to analyze image with Grok. Please check your API key and try again.');
  }
};
