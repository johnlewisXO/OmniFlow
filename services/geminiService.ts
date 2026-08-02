import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { API_KEY_WARNING } from '../constants';
import { TaskPriority, Task, Project } from '../types';

// API key must be obtained from process.env.GEMINI_API_KEY or process.env.API_KEY
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ 
    apiKey: API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn(API_KEY_WARNING);
}

const MODEL_NAME = 'gemini-3.6-flash';

export interface GeneratedSubtask {
  title: string;
  priority: TaskPriority;
}

interface GeminiService {
  generateTaskTitles: (description: string) => Promise<string[]>;
  generateSubtaskBreakdown: (taskTitle: string, taskDescription?: string) => Promise<GeneratedSubtask[]>;
  generateProjectExecutiveSummary: (project: Project, tasks: Task[], teamCount?: number) => Promise<string>;
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
    `;

    try {
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
      
      let jsonStr = (response.text || '').trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      const parsedData = JSON.parse(jsonStr);
      if (Array.isArray(parsedData) && parsedData.every(item => typeof item === 'string')) {
        return parsedData as string[];
      } else {
        return [`Suggested: ${description.substring(0, 40)}...`];
      }
    } catch (error: any) {
      console.error("Error generating task titles with Gemini API:", error);
      throw new Error("Failed to generate task titles via AI.");
    }
  },

  generateSubtaskBreakdown: async (taskTitle: string, taskDescription?: string): Promise<GeneratedSubtask[]> => {
    if (!ai) {
      throw new Error("Gemini API key not configured. " + API_KEY_WARNING);
    }

    const prompt = `
      You are an expert Agile project manager. Breakdown the following parent task into 3 to 5 clear, concrete, actionable subtasks.
      Parent Task Title: "${taskTitle}"
      Parent Task Description: "${taskDescription || 'N/A'}"

      For each subtask, provide:
      - title (string): short, clear subtask title
      - priority (string): must be one of "Low", "Medium", "High", or "Critical"
    `;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Subtask title" },
                priority: { type: Type.STRING, description: "Low, Medium, High, or Critical" }
              },
              required: ["title", "priority"]
            }
          },
          temperature: 0.7,
        }
      });

      let jsonStr = (response.text || '').trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          title: String(item.title || 'Subtask'),
          priority: (Object.values(TaskPriority).includes(item.priority as TaskPriority) ? item.priority : TaskPriority.MEDIUM) as TaskPriority
        }));
      }
      return [
        { title: `Initial setup for ${taskTitle}`, priority: TaskPriority.MEDIUM },
        { title: `Implementation & testing for ${taskTitle}`, priority: TaskPriority.HIGH },
        { title: `Final review & documentation`, priority: TaskPriority.LOW }
      ];
    } catch (error: any) {
      console.error("Error generating subtask breakdown with Gemini API:", error);
      throw new Error(error.message || "Failed to generate AI subtask breakdown.");
    }
  },

  generateProjectExecutiveSummary: async (project: Project, tasks: Task[], teamCount: number = 1): Promise<string> => {
    if (!ai) {
      throw new Error("Gemini API key not configured. " + API_KEY_WARNING);
    }

    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const critical = tasks.filter(t => t.priority === TaskPriority.CRITICAL || t.priority === TaskPriority.HIGH).length;

    const taskSummaries = tasks.slice(0, 15).map(t => `- [${t.status.toUpperCase()}] (${t.priority}) ${t.title}`).join('\n');

    const prompt = `
      You are an executive project consultant writing an official Executive Status Summary Report for C-suite stakeholders.
      
      Project Name: "${project.name}"
      Description: "${project.description || 'No description'}"
      Status: ${project.status}
      Team Members: ${teamCount}
      Total Tasks: ${tasks.length}
      - Completed: ${completed}
      - In Progress: ${inProgress}
      - In Review: ${review}
      - To Do: ${todo}
      - High/Critical Priority: ${critical}

      Recent Sample Tasks:
      ${taskSummaries || 'No tasks created yet.'}

      Please compose a professional, executive-level markdown report with these exact sections:
      1. 📌 **Executive Overview** (Project health, overall completion trajectory)
      2. 🚀 **Key Milestones & Delivered Progress** (Highlighting completed work)
      3. ⚠️ **Risk Factors & Bottlenecks** (High priority items or uncompleted work)
      4. 🎯 **Strategic Next Steps** (3-4 actionable recommendations for stakeholders)

      Keep the tone polished, objective, authoritative, and concise (300-450 words max).
    `;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });

      return response.text || "No summary generated.";
    } catch (error: any) {
      console.error("Error generating executive summary with Gemini API:", error);
      throw new Error(error.message || "Failed to generate AI Executive Summary.");
    }
  }
};

export default geminiService;
