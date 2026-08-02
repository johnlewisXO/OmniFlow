import { GoogleGenAI } from "@google/genai";
import { Task } from "../types";

export const generateTaskSummary = async (tasks: Task[]): Promise<string> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return "Gemini API key is not configured in environment.";
    }

    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    
    const taskData = tasks.map(t => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate
    }));

    const prompt = `Here are my current tasks: ${JSON.stringify(taskData)}. Please provide a brief, encouraging summary of my workload, highlighting any critical or overdue tasks. Keep it under 3 sentences.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return response.text || "No summary generated.";
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return "Failed to generate summary. Please check your API key or try again later.";
  }
};
