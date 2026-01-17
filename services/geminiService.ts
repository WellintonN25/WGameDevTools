import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the client
// Note: In a real production app for public use, you'd likely proxy this or ask user for key
// For this demo structure, we use import.meta.env as per Vite conventions
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export const analyzeFrame = async (base64Image: string): Promise<string> => {
  try {
    // Remove the data URL prefix (e.g., "data:image/png;base64,")
    const base64Data = base64Image.split(',')[1];
    
    // Using gemini-2.5-flash for image analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/png', // Assuming PNG from canvas
        },
      },
      'Describe this video frame in detail. Describe the lighting, composition, and main subjects.',
    ]);

    const response = await result.response;
    return response.text() || "No analysis available.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw new Error("Failed to analyze image. Please check your API key.");
  }
};
