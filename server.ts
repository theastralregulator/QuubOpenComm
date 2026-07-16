import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Expose Supabase configuration securely (only public keys)
app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  });
});

const PORT = 3000;

// Lazy initialization of Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("GEMINI_API_KEY environment variable is missing. Falling back to high-fidelity simulated response modes.");
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. Live AI Search and Matcher Endpoint
app.post("/api/search", async (req, res) => {
  const { query, type = "all" } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  const ai = getAi();
  if (!ai) {
    // Elegant simulation fallback
    const matchedCategory = query.toLowerCase().includes("design") ? "Designer" :
                            query.toLowerCase().includes("code") || query.toLowerCase().includes("dev") ? "Developer" :
                            query.toLowerCase().includes("electric") ? "Electrician" :
                            query.toLowerCase().includes("carpenter") ? "Carpenter" : "Developer";
    return res.json({
      matchedCategory,
      filterTerms: [query],
      locationPreference: "",
      aiAnalysis: `Simulation Mode: Analyzed request for "${query}". Premium career opportunities in local markets are showing a 12% boost this quarter.`,
      alternativeSuggestions: ["Creative Architect", "Interactive Dev"],
    });
  }

  try {
    const prompt = `Analyze this user query for our local career marketplace: "${query}".
    Classify the query into a category, extract key skills or filter terms, determine any location parsed, and generate an inspiring 1-sentence career advice/insight matching this interest.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedCategory: {
              type: Type.STRING,
              description: "The most relevant category: 'Developer', 'Designer', 'Electrician', 'Carpenter', 'Driver', 'Chef', 'Teacher', 'Photographer', 'Mechanic', 'Cleaner'",
            },
            filterTerms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Extracted skills or keyword filters like 'React', 'solar', 'hardwood', 'Figma'",
            },
            locationPreference: {
              type: Type.STRING,
              description: "Parsed city/state or remote preference, empty if none.",
            },
            aiAnalysis: {
              type: Type.STRING,
              description: "A premium, inspiring, 1-sentence career advice or market trend matching this query.",
            },
            alternativeSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2 related alternative skills or titles they might be interested in.",
            },
          },
          required: ["matchedCategory", "filterTerms", "locationPreference", "aiAnalysis", "alternativeSuggestions"],
        },
      },
    });

    const dataText = response.text?.trim() || "{}";
    const result = JSON.parse(dataText);
    res.json(result);
  } catch (error: any) {
    console.error("AI Search Error:", error);
    res.status(500).json({ error: "Failed to perform AI analysis", details: error.message });
  }
});

// 2. OpenComm AI Career Co-Pilot Chat Endpoint
app.post("/api/ai-chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  const ai = getAi();
  if (!ai) {
    // Beautiful default fallback message from OpenComm Co-Pilot
    return res.json({
      text: `### Welcome to OpenComm Career Co-Pilot (Offline Mode)

It looks like the \`GEMINI_API_KEY\` is not set, but I can still share some **premium advice** based on our product specifications:

1. **Optimize Your Profile**: Active workers with verified badges receive **4.2x more contract inquiries**.
2. **Local Marketplace Pulse**: High-end carpentry and custom solar installations are up **25%** in regional hubs.
3. **Drafting Proposals**: Always state your availability and include a link to your Figma or GitHub portfolio.

*Feel free to explore our pre-loaded jobs and workers!*`,
    });
  }

  try {
    const formattedContents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: `You are the OpenComm Career Co-Pilot. You are a premium, highly sophisticated, ultra-polished career advisor and business scout.
        You speak with professional composure, clarity, and precision (like the design teams at Apple, Stripe, and Linear).
        Assist the user with professional networking, resume/profile tips, drafting job posts, or explaining how they can succeed on OpenComm.
        Always format your responses with elegant markdown, headers, bullet points, and neat typography. Keep answers concise, highly structured, and inspiring.`,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ error: "Failed to connect to Career Co-Pilot", details: error.message });
  }
});

// Serve frontend through Vite in dev, or statically in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OpenComm Server running on http://localhost:${PORT}`);
  });
}

startServer();
