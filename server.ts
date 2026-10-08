import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MODEL_NAME = 'gemini-3.8-flash';

function stripJsonFences(raw: string): string {
  let cleaned = (raw || '').trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = cleaned.match(fenceRegex);
  if (match && match[2]) {
    cleaned = match[2].trim();
  }
  return cleaned;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. Task Titles Suggestion
  app.post('/api/ai/task-titles', async (req, res) => {
    try {
      const { description } = req.body;
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const prompt = `
        Based on the following task description, generate 3 concise and actionable task titles.
        Each title should be suitable for a modern engineering & product management workspace.
        Return the titles as a JSON array of strings.

        Description: "${description}"
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          temperature: 0.7,
        },
      });

      const parsed = JSON.parse(stripJsonFences(response.text || '[]'));
      return res.json({ titles: Array.isArray(parsed) ? parsed : [] });
    } catch (error: any) {
      console.error('[/api/ai/task-titles] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate task titles.' });
    }
  });

  // 2. Subtask Breakdown
  app.post('/api/ai/subtask-breakdown', async (req, res) => {
    try {
      const { taskTitle, taskDescription } = req.body;
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const prompt = `
        You are a Staff Engineering Project Manager. Break down the following parent task into 4 clear, concrete, actionable subtasks.
        Parent Task Title: "${taskTitle}"
        Parent Task Description: "${taskDescription || 'N/A'}"

        For each subtask, provide:
        - title (string): short, clear subtask title
        - priority (string): must be one of "Low", "Medium", "High", or "Critical"
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                priority: { type: Type.STRING },
              },
              required: ['title', 'priority'],
            },
          },
          temperature: 0.6,
        },
      });

      const parsed = JSON.parse(stripJsonFences(response.text || '[]'));
      return res.json({ subtasks: Array.isArray(parsed) ? parsed : [] });
    } catch (error: any) {
      console.error('[/api/ai/subtask-breakdown] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate subtask breakdown.' });
    }
  });

  // 3. Executive Summary Report
  app.post('/api/ai/executive-summary', async (req, res) => {
    try {
      const { project, tasks, teamCount } = req.body;
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const taskList = Array.isArray(tasks) ? tasks : [];
      const completed = taskList.filter((t: any) => t.status === 'done').length;
      const inProgress = taskList.filter((t: any) => t.status === 'in_progress').length;
      const todo = taskList.filter((t: any) => t.status === 'todo').length;
      const review = taskList.filter((t: any) => t.status === 'review').length;
      const critical = taskList.filter((t: any) => t.priority === 'Critical' || t.priority === 'High').length;

      const taskSummaries = taskList
        .slice(0, 15)
        .map((t: any) => `- [${String(t.status || 'todo').toUpperCase()}] (${t.priority || 'Medium'}) ${t.title}`)
        .join('\n');

      const prompt = `
        You are an executive project consultant writing an official Executive Status Summary Report for leadership and stakeholders.
        
        Project Name: "${project?.name || 'Organization Portfolio'}"
        Description: "${project?.description || 'Cross-functional initiative'}"
        Status: ${project?.status || 'active'}
        Team Members: ${teamCount || 1}
        Total Tasks: ${taskList.length}
        - Completed: ${completed}
        - In Progress: ${inProgress}
        - In Review: ${review}
        - To Do: ${todo}
        - High/Critical Priority: ${critical}

        Recent Sample Tasks:
        ${taskSummaries || 'No tasks created yet.'}

        Please compose a clear, structured executive report with these sections:
        1. Executive Overview (Project health, delivery trajectory, confidence score)
        2. Key Milestones & Delivered Progress (Highlighting completed work)
        3. Risk Factors & Bottlenecks (High priority items or uncompleted work)
        4. Strategic Next Steps (3-4 actionable recommendations for stakeholders)

        Keep the tone objective, authoritative, and concise (300-450 words max).
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          temperature: 0.65,
        },
      });

      return res.json({ summary: response.text || 'No summary generated.' });
    } catch (error: any) {
      console.error('[/api/ai/executive-summary] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate executive summary.' });
    }
  });

  // 4. Task Context Co-Pilot Analysis (Effort estimation, Risk detection, Spec enhancement, Acceptance criteria)
  app.post('/api/ai/task-copilot', async (req, res) => {
    try {
      const { task, projectTasks, teamMembers } = req.body;
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const candidateTasks = (projectTasks || [])
        .filter((t: any) => t.id !== task?.id)
        .slice(0, 15)
        .map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }));

      const membersSummary = (teamMembers || []).map((m: any) => ({
        id: m.id,
        name: m.full_name || m.email,
        role: m.role || 'MEMBER',
        activeTaskCount: m.activeTaskCount || 0,
      }));

      const prompt = `
        You are an embedded AI Engineering Co-Pilot analyzing a specific task inside a project management workspace.
        
        Target Task:
        - Title: "${task?.title || ''}"
        - Description: "${task?.description || 'No description provided'}"
        - Current Status: "${task?.status || 'todo'}"
        - Current Priority: "${task?.priority || 'Medium'}"
        - Current Story Points: ${task?.story_points || 'Unestimated'}
        
        Other Tasks in Project (potential dependencies/blockers):
        ${JSON.stringify(candidateTasks)}

        Available Team Members & Active Load:
        ${JSON.stringify(membersSummary)}

        Return a structured JSON analysis with:
        - estimatedStoryPoints: Fibonacci integer (1, 2, 3, 5, 8, or 13)
        - estimationRationale: 1 concise sentence explaining the complexity
        - recommendedPriority: "Low", "Medium", "High", or "Critical"
        - recommendedAssigneeId: ID of the best suited team member (prefer lower activeTaskCount) or ""
        - recommendedAssigneeReason: 1 concise sentence explaining why
        - riskLevel: "Low", "Medium", or "High"
        - riskAnalysis: array of 2-3 specific technical or delivery risks / edge cases
        - enhancedDescription: a well-structured specification (Objective, Technical Scope, Deliverable) improving the task description
        - acceptanceCriteria: array of 4 concrete, testable checklist strings
        - suggestedSubtasks: array of 3 objects with { title, priority }
        - potentialBlockerTaskIds: array of task IDs from "Other Tasks in Project" that logically precede or block this task
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              estimatedStoryPoints: { type: Type.INTEGER },
              estimationRationale: { type: Type.STRING },
              recommendedPriority: { type: Type.STRING },
              recommendedAssigneeId: { type: Type.STRING },
              recommendedAssigneeReason: { type: Type.STRING },
              riskLevel: { type: Type.STRING },
              riskAnalysis: { type: Type.ARRAY, items: { type: Type.STRING } },
              enhancedDescription: { type: Type.STRING },
              acceptanceCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedSubtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    priority: { type: Type.STRING },
                  },
                  required: ['title', 'priority'],
                },
              },
              potentialBlockerTaskIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'estimatedStoryPoints',
              'estimationRationale',
              'recommendedPriority',
              'riskLevel',
              'riskAnalysis',
              'enhancedDescription',
              'acceptanceCriteria',
              'suggestedSubtasks',
            ],
          },
          temperature: 0.5,
        },
      });

      const parsed = JSON.parse(stripJsonFences(response.text || '{}'));
      return res.json(parsed);
    } catch (error: any) {
      console.error('[/api/ai/task-copilot] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to analyze task.' });
    }
  });

  // 5. AI Project Manager Blueprint Generator ("Launch mobile app by December" -> Project, Milestones, Sprints, Tasks)
  app.post('/api/ai/project-blueprint', async (req, res) => {
    try {
      const { goalPrompt, teamMembersCount } = req.body;
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const prompt = `
        You are an Principal AI Project Manager & Solutions Architect.
        The user wants to plan and execute the following initiative:
        "${goalPrompt}"
        Team size: ${teamMembersCount || 4} contributors.
        Current date: ${new Date().toISOString().split('T')[0]}

        Generate a comprehensive, production-grade Project Execution Blueprint in JSON with:
        - projectName: concise, professional project title
        - projectDescription: 2-3 sentence executive charter
        - targetLaunchDate: YYYY-MM-DD date
        - riskScore: integer 10 to 85 representing overall complexity/risk
        - confidenceScore: integer 70 to 98 representing delivery confidence
        - executiveBrief: 2-3 sentences on strategy and critical path
        - milestones: array of 3 key milestones { title, targetDate, deliverable }
        - sprints: array of 2-3 sequential sprints { name, goal, durationDays, tasks: array of 3-4 tasks { title, description, priority ("Low"|"Medium"|"High"|"Critical"), storyPoints (1|2|3|5|8|13), checklist: array of 2-3 strings } }
        - keyRisks: array of 3 objects { risk, impact ("High"|"Medium"), mitigation }
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              projectName: { type: Type.STRING },
              projectDescription: { type: Type.STRING },
              targetLaunchDate: { type: Type.STRING },
              riskScore: { type: Type.INTEGER },
              confidenceScore: { type: Type.INTEGER },
              executiveBrief: { type: Type.STRING },
              milestones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    targetDate: { type: Type.STRING },
                    deliverable: { type: Type.STRING },
                  },
                  required: ['title', 'targetDate', 'deliverable'],
                },
              },
              sprints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    goal: { type: Type.STRING },
                    durationDays: { type: Type.INTEGER },
                    tasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          priority: { type: Type.STRING },
                          storyPoints: { type: Type.INTEGER },
                          checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
                        },
                        required: ['title', 'description', 'priority', 'storyPoints', 'checklist'],
                      },
                    },
                  },
                  required: ['name', 'goal', 'durationDays', 'tasks'],
                },
              },
              keyRisks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    risk: { type: Type.STRING },
                    impact: { type: Type.STRING },
                    mitigation: { type: Type.STRING },
                  },
                  required: ['risk', 'impact', 'mitigation'],
                },
              },
            },
            required: [
              'projectName',
              'projectDescription',
              'targetLaunchDate',
              'riskScore',
              'confidenceScore',
              'executiveBrief',
              'milestones',
              'sprints',
              'keyRisks',
            ],
          },
          temperature: 0.65,
        },
      });

      const parsed = JSON.parse(stripJsonFences(response.text || '{}'));
      return res.json(parsed);
    } catch (error: any) {
      console.error('[/api/ai/project-blueprint] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate project blueprint.' });
    }
  });

  // 6. Natural Language AI Command Centre Interpreter
  app.post('/api/ai/command', async (req, res) => {
    try {
      const { query, context } = req.body;
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const prompt = `
        You are the AI Command Centre brain for Omni Flow, an AI-native project management platform.
        User Natural Language Command: "${query}"
        
        Workspace Context:
        ${JSON.stringify(context || {})}

        Interpret the user's intent and provide both an immediate intelligent response AND a structured executable action if applicable.
        Supported intentType values:
        - "create_task": User wants to create a task
        - "create_sprint": User wants to create/schedule a sprint
        - "create_project_blueprint": User wants to plan/launch a new project or roadmap
        - "filter_tasks": User wants to see overdue, high-priority, blocked, or specific tasks
        - "summarize_project": User wants a project status summary or stakeholder update
        - "rebalance_workload": User wants to balance team capacity or see bottlenecks
        - "general_advice": General PM question or analysis

        Return JSON matching the schema.
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intentType: { type: Type.STRING },
              headline: { type: Type.STRING },
              answerMarkdown: { type: Type.STRING },
              suggestedActionLabel: { type: Type.STRING },
              actionPayload: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  storyPoints: { type: Type.INTEGER },
                  sprintName: { type: Type.STRING },
                  sprintGoal: { type: Type.STRING },
                  filterCriteria: { type: Type.STRING },
                },
              },
              followUpPrompts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['intentType', 'headline', 'answerMarkdown', 'followUpPrompts'],
          },
          temperature: 0.5,
        },
      });

      const parsed = JSON.parse(stripJsonFences(response.text || '{}'));
      return res.json(parsed);
    } catch (error: any) {
      console.error('[/api/ai/command] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to process AI command.' });
    }
  });

  // 7. Meeting / Standup Notes Summariser & Action Extractor
  app.post('/api/ai/meeting-extract', async (req, res) => {
    try {
      const { transcript, projectName } = req.body;
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const prompt = `
        You are an AI Project Co-Pilot. Analyze the following meeting transcript, standup notes, or team chat log for project "${projectName || 'Active Project'}":
        
        """
        ${transcript}
        """

        Extract:
        - executiveSummary: 2-3 sentence summary of alignment and outcomes
        - keyDecisions: array of 2-4 key decisions made
        - detectedBlockers: array of any blockers or risks mentioned
        - actionItems: array of concrete tasks to create { title, description, priority ("Low"|"Medium"|"High"|"Critical"), storyPoints (1|2|3|5|8), assigneeHint }
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              keyDecisions: { type: Type.ARRAY, items: { type: Type.STRING } },
              detectedBlockers: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    storyPoints: { type: Type.INTEGER },
                    assigneeHint: { type: Type.STRING },
                  },
                  required: ['title', 'description', 'priority', 'storyPoints'],
                },
              },
            },
            required: ['executiveSummary', 'keyDecisions', 'detectedBlockers', 'actionItems'],
          },
          temperature: 0.5,
        },
      });

      const parsed = JSON.parse(stripJsonFences(response.text || '{}'));
      return res.json(parsed);
    } catch (error: any) {
      console.error('[/api/ai/meeting-extract] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to extract meeting actions.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Omni Flow Server listening on http://localhost:${PORT}`);
  });
}

startServer();
