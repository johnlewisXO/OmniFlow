
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { API_KEY_WARNING } from '../constants';

// Fix: API key must be obtained from process.env.API_KEY
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.warn(API_KEY_WARNING);
}

const MODEL_NAME = 'gemini-2.5-flash';

interface GeminiService {
  generateTaskTitles: (description: string) => Promise<string[]>;
}

const geminiService: GeminiService = {
  generateTaskTitles: async (description: string): Promise<string[]> => {
    if (!ai) {
      throw new Error("Gemini API key not configured. " + API_KEY_WARNING);
    }

    const prompt = `
      Based on the following task description, generate 3 concise and actionable task titles.
      Each title should be suitable for a project management tool.
      Return the titles as a JSON array of strings. For example: ["Title 1", "Title 2", "Title 3"].

      Description: "${description}"

      JSON Array of Titles:
    `;

    try {
      // Fix: Added responseSchema to ensure JSON output and simplified response handling.
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
          temperature: 0.7,
        }
      });
      
      let jsonStr = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      const parsedData = JSON.parse(jsonStr);
      if (Array.isArray(parsedData) && parsedData.every(item => typeof item === 'string')) {
        return parsedData as string[];
      } else {
        console.error("Gemini API returned unexpected data format for task titles:", parsedData);
        return [`Suggested: ${parsedData.toString().substring(0,50)}...`]; // Fallback
      }
    } catch (error: any) {
      console.error("Error generating task titles with Gemini API:", error);
      let extractedMessage = "Failed to generate task titles due to an unknown AI error.";
      
      if (error instanceof Error && error.message) {
        let messageToParse = error.message;
        try {
          // Attempt to parse error.message if it's a JSON string itself
          const parsedJson = JSON.parse(messageToParse);
          if (parsedJson.message && typeof parsedJson.message === 'string' && parsedJson.message.trim()) {
            extractedMessage = `AI Error: ${parsedJson.message.trim()}`;
          } else if (typeof parsedJson === 'string' && parsedJson.trim()) { // Handles cases like error.message being '"Some error string"'
            extractedMessage = `AI Error: ${parsedJson.trim()}`;
          } else if (messageToParse.trim()) { // Not JSON or no inner message, use as is if not empty
             extractedMessage = `AI Error: ${messageToParse.trim()}`;
          }
        } catch (e) {
          // error.message was not a JSON string, use it directly if not empty
          if (messageToParse.trim()) {
            extractedMessage = `AI Error: ${messageToParse.trim()}`;
          }
        }
      } else if (typeof error === 'string' && error.trim()) {
        extractedMessage = `AI Error: ${error.trim()}`;
      }
      throw new Error(extractedMessage);
    }
  },
};

export default geminiService;