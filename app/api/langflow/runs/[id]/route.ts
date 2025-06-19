import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const url = new URL(req.url);
  const isStream = url.searchParams.get('stream') === 'true';

  if (isStream) {
    // SSE streaming endpoint
    const logFile = path.join(process.cwd(), 'logs', `${id}.log`);
    
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: {"type":"connected","message":"Connected to execution ${id}"}\n\n`)
        );

        // Watch for log file changes
        let lastSize = 0;
        const watchInterval = setInterval(() => {
          try {
            if (fs.existsSync(logFile)) {
              const stats = fs.statSync(logFile);
              if (stats.size > lastSize) {
                const content = fs.readFileSync(logFile, 'utf-8');
                const newContent = content.slice(lastSize);
                lastSize = stats.size;
                
                if (newContent.trim()) {
                  controller.enqueue(
                    encoder.encode(`data: {"type":"log","content":${JSON.stringify(newContent.trim())}}\n\n`)
                  );
                }
              }
            }
          } catch (error) {
            console.error('Error reading log file:', error);
          }
        }, 1000);

        // Check execution status
        const statusInterval = setInterval(() => {
          try {
            const executionsFile = path.join(process.cwd(), 'executions.json');
            if (fs.existsSync(executionsFile)) {
              const executions = JSON.parse(fs.readFileSync(executionsFile, 'utf-8'));
              const execution = executions.find((e: any) => e.id === id);
              
              if (execution && (execution.status === 'Success' || execution.status === 'Error')) {
                controller.enqueue(
                  encoder.encode(`data: {"type":"status","status":"${execution.status}","execution":${JSON.stringify(execution)}}\n\n`)
                );
                clearInterval(watchInterval);
                clearInterval(statusInterval);
                controller.close();
              }
            }
          } catch (error) {
            console.error('Error checking execution status:', error);
          }
        }, 2000);

        // Cleanup after 5 minutes
        setTimeout(() => {
          clearInterval(watchInterval);
          clearInterval(statusInterval);
          controller.close();
        }, 300000);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  } else {
    // Regular execution details endpoint
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
}