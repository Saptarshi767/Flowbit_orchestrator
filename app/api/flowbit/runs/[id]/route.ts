import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { params } = context;
  const id = params.id;
  // Only support regular details endpoint for now (no SSE stream)
  try {
    const executionsFile = path.join(process.cwd(), 'executions.json');
    if (!fs.existsSync(executionsFile)) {
      return new Response(
        JSON.stringify({ error: 'Executions file not found' }),
        { status: 404 }
      );
    }

    const executions = JSON.parse(fs.readFileSync(executionsFile, 'utf-8'));
    const execution = executions.find((e: any) => e.id === id);

    if (!execution) {
      return new Response(
        JSON.stringify({ error: 'Execution not found' }),
        { status: 404 }
      );
    }

    // Add logs if available
    const logFile = path.join(process.cwd(), 'logs', `${id}.log`);
    let logs = '';
    if (fs.existsSync(logFile)) {
      logs = fs.readFileSync(logFile, 'utf-8');
    }

    return new Response(
      JSON.stringify({ ...execution, logs }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch execution details' }),
      { status: 500 }
    );
  }
} 