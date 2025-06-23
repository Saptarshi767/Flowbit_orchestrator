import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LANGFLOW_URL = process.env.LANGFLOW_URL || 'http://localhost:7860';

export async function POST(req: NextRequest) {
  try {
    const { workflow, input } = await req.json();

    if (!workflow || !input) {
      return NextResponse.json({ error: 'Missing workflow or input' }, { status: 400 });
    }

    if (workflow === 'ollama') {
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await ollamaRes.json();
      return NextResponse.json(data);
    }

    if (workflow === 'langflow') {
      // Replace '/api/your-endpoint' with the actual Langflow endpoint you want to call
      const langflowRes = await fetch(`${LANGFLOW_URL}/api/your-endpoint`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await langflowRes.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Unknown workflow' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err?.toString() }, { status: 500 });
  }
}