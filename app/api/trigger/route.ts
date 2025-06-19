import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { promises as fs } from 'fs'

export async function POST(req: NextRequest) {
  console.log('Trigger API: Received a request.');
  console.log('Trigger API: Attempting to parse JSON body.');
  
  try {
    const body = await req.json()
    console.log('Trigger API: Successfully parsed body:', body);
    const { workflow, input } = body
    console.log('Trigger API: Extracted workflow and input.');

    if (!workflow || !input) {
      console.log('Trigger API: Missing workflow or input in body.');
      return new Response(JSON.stringify({ error: 'Missing workflow or input' }), { status: 400 })
    }

    const projectRoot = process.cwd()
    console.log('Trigger API: projectRoot is', projectRoot);
    const flowPath = path.join(projectRoot, 'flows', workflow)
    console.log('Trigger API: flowPath is', flowPath);

    try {
      await fs.access(flowPath)
      console.log('Trigger API: Workflow file found.');
    } catch {
      console.log('Trigger API: Workflow file not found.');
      return new Response(JSON.stringify({ error: 'Workflow not found' }), { status: 404 })
    }

    // Escape the workflow name for shell usage, but preserve spaces and parentheses
    const escapedWorkflow = workflow.replace(/'/g, "'\''")
    console.log('Trigger API: Escaped workflow name:', escapedWorkflow);

    // Escape the input JSON for shell usage
    const escapedInput = JSON.stringify(input).replace(/'/g, "'\''")
    console.log('Trigger API: Escaped input JSON:', escapedInput);

    // Execute the python script and capture stdout directly
    const command = 'docker';
    const args = [
      'exec',
      'flowbit_orchestrator-runner-1',
      '/bin/sh',
      '-c',
      `python /app/run_flow.py '/app/flows/${escapedWorkflow}' '${escapedInput}' 2>&1`,
    ];
    console.log('Trigger API: Executing docker command:', command, args);
    const docker = spawn(command, args, {
      cwd: projectRoot,
    })

    let result = ''
    let error = ''

    docker.stdout.on('data', (data) => {
      result += data.toString();
      console.log(`Trigger API (docker stdout):\n${data}`);
    });

    docker.stderr.on('data', (data) => {
      error += data.toString();
      console.error(`Trigger API (docker stderr):\n${data}`);
    });

    docker.on('error', (err) => {
      console.error('Trigger API (spawn error): Failed to start subprocess.', err);
      error += `\nSpawn Error: ${err.message}`;
    });

    const exitCode = await new Promise<number>((resolve) => {
      docker.on('close', resolve);
    });
    console.log(`Trigger API (spawn close): Child process exited with code ${exitCode}`);

    if (exitCode !== 0) {
      console.error('Trigger API: Docker exec command failed.', { exitCode, error });
      return new Response(JSON.stringify({ error: error || 'Execution failed' }), { status: 500 })
    }

    console.log('Trigger API: Docker exec command succeeded.');
    // The result is already captured by the stdout listener
    console.log('Trigger API: Returning captured stdout as result.', result);
    return new Response(result, { status: 200 })

  } catch (err) {
    console.error('Trigger error:', err)
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err }), {
      status: 500,
    })
  }
}