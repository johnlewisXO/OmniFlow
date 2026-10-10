// Supabase Edge Function: ai-copilot-synthesis
// Deploy with: supabase functions deploy ai-copilot-synthesis
// Handles server-side Gemini AI synthesis for Project Blueprints, Sprint Risk Radar, and Executive Reports

import { GoogleGenAI, Type } from 'npm:@google/genai@^1.46.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = performance.now();

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Edge Function secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const body = await req.json();
    const { operation = 'executive_brief', payload = {} } = body;

    let resultData: unknown = null;

    if (operation === 'sprint_risk_radar') {
      const { projectName, tasks = [], sprintName } = payload;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze sprint delivery risk for project "${projectName || 'Workspace'}" (${sprintName || 'Current Sprint'}). Tasks: ${JSON.stringify(tasks.slice(0, 25))}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              riskScore: { type: Type.INTEGER },
              deliveryConfidence: { type: Type.INTEGER },
              summary: { type: Type.STRING },
              bottlenecks: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['riskScore', 'deliveryConfidence', 'summary', 'bottlenecks', 'recommendedActions'],
          },
          temperature: 0.4,
        },
      });
      resultData = JSON.parse(response.text || '{}');
    } else {
      const { prompt = 'Generate executive workspace synthesis', context = {} } = payload;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are Omni Flow's Principal AI Executive Co-Pilot.\nRequest: ${prompt}\nContext: ${JSON.stringify(context)}`,
        config: { temperature: 0.5 },
      });
      resultData = { text: response.text || '' };
    }

    const durationMs = Math.round(performance.now() - startedAt);

    return new Response(
      JSON.stringify({
        ok: true,
        function: 'ai-copilot-synthesis',
        operation,
        durationMs,
        data: resultData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || 'Edge synthesis error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
