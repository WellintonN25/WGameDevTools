import { GoogleGenAI } from "@google/genai";

// Initialize the client
// Note: In a real production app for public use, you'd likely proxy this or ask user for key
// For this demo structure, we use process.env.API_KEY as per instructions
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeFrame = async (base64Image: string): Promise<string> => {
  try {
    // Remove the data URL prefix (e.g., "data:image/png;base64,")
    const base64Data = base64Image.split(',')[1];
    
    // Using gemini-2.5-flash-image (nano banana) as per instructions for image tasks
    const modelId = 'gemini-2.5-flash-image';

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/png', // Assuming PNG from canvas
            },
          },
          {
            text: 'Describe this video frame in detail. Describe the lighting, composition, and main subjects.',
          },
        ],
      },
    });

    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw new Error("Failed to analyze image. Please check your API key.");
  }
};
