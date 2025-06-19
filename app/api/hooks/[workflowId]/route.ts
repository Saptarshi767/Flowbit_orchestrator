import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

export async function POST(req: NextRequest, context: { params: { workflowId: string } }) {
  const { params } = context;
  const workflowId = params.workflowId;
  const body = await req.text();
  const input = body ? JSON.parse(body) : {};

  const projectRoot = process.cwd();
  const flowPath = path.join(projectRoot, 'flows', workflowId + '.json');

  try {
    await fs.access(flowPath);
  } catch {
    return new Response(JSON.stringify({ error: 'Workflow not found' }), { status: 404 });
  }

  const python = spawn(process.platform === 'win32' ? 'python' : 'python3', ['run_flow.py', flowPath, JSON.stringify(input)], {
    cwd: projectRoot,
  });

  let output = '';
  for await (const chunk of python.stdout) {
    output += chunk.toString();
  }

  return new Response(JSON.stringify({ message: 'Triggered via webhook', output }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
