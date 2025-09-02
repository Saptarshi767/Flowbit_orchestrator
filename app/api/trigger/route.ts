import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LANGFLOW_URL = process.env.LANGFLOW_URL || 'http://localhost:7860';

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const user = session.user as SessionUser;
  try {
    const { workflow, input } = await req.json();
    if (!workflow || !input) {
      return NextResponse.json({ error: 'Missing workflow or input' }, { status: 400 });
    }
    let data, status = 'Success', error = null;
    if (workflow === 'ollama') {
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
      data = await ollamaRes.json();
      if (!ollamaRes.ok) {
        status = 'Error';
        error = data.error || 'Ollama error';
      }
    } else if (workflow === 'langflow') {
      const langflowRes = await fetch(`${LANGFLOW_URL}/api/v1/predict`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
      data = await langflowRes.json();
      if (!langflowRes.ok) {
        status = 'Error';
        error = data.error || 'Langflow error';
      }
    } else {
      return NextResponse.json({ error: 'Unknown workflow' }, { status: 400 });
    }
    // Record execution
    const execution = {
      id: uuidv4(),
      userId: user.id,
      flow: workflow,
      status,
      input,
      output: data.output || data.result || JSON.stringify(data),
      error,
      startTime: new Date().toISOString(),
      duration: 0 // You can add timing if needed
    };
    let allExecutions = [];
    try {
      const file = await fs.readFile('executions.json', 'utf-8');
      allExecutions = JSON.parse(file);
    } catch {}
    allExecutions.push(execution);
    await fs.writeFile('executions.json', JSON.stringify(allExecutions, null, 2));
    return NextResponse.json(execution);
  } catch (err) {
    return NextResponse.json({ error: err?.toString() }, { status: 500 });
  }
}