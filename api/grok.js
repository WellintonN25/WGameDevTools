// API Proxy para Grok - Protege a chave API
export default async function handler(req, res) {
  // CORS - Permite apenas seu domínio do GitHub Pages
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "https://seu-usuario.github.io", // Substitua pelo seu usuário
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, imageData } = req.body;

  if (!prompt || !imageData) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-2-vision-1212",
        messages: [
          {
            role: "system",
            content:
              "You are an expert sprite animator for game development. Analyze images and provide detailed animation descriptions.",
          },
          {
            role: "user",
            content: `Analyze this sprite image and provide detailed animation frame descriptions for: "${prompt}". 
        
Focus on:
1. Natural movement patterns
2. 3D rotation effects (rotateX, rotateY, rotateZ)
3. Perspective changes
4. Shadow and lighting variations
5. Smooth transitions between frames

Provide specific transformation values and timing for each frame.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Grok API error: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
    const text =
      data.choices?.[0]?.message?.content || "No analysis available.";

    res.status(200).json({ text });
  } catch (error) {
    console.error("Error calling Grok API:", error);
    res.status(500).json({
      error: "Failed to analyze image with Grok",
      details: error.message,
    });
  }
}
