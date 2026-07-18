
import { GoogleGenAI, Type } from "@google/genai";
import { AIRecommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateRankingScript = async (topic: string): Promise<AIRecommendation> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Genera un ranking viral para el tema: "${topic}".`,
    config: {
      systemInstruction: `Eres el motor de una aplicación de creación de videos de ranking. Tu tarea es recibir un tema y devolver SIEMPRE un formato JSON estricto.
      
Usa un tono divertido, punchy y diseñado para volverse viral en TikTok/Reels. 

Estructura requerida:
{
  "rankingItems": [
    {
      "rank": number,
      "title": "Título corto y llamativo",
      "description": "Descripción graciosa o impactante"
    }
  ],
  "styleSuggestion": "Nombre de un estilo visual (ej: Neon, Minimalist, Aggressive, Retro)"
}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rankingItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rank: { type: Type.NUMBER },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["rank", "title", "description"],
            },
          },
          styleSuggestion: { type: Type.STRING },
        },
        required: ["rankingItems", "styleSuggestion"],
      },
    },
  });

  try {
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Invalid AI response format");
  }
};
