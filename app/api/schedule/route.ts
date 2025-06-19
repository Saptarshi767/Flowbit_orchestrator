import { NextRequest } from 'next/server';
import { addCronJob } from '@/lib/cron';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workflow = body.workflow;
    const cronExpr = body.cron || body.schedule;
    const input = body.input;

    if (!workflow || !cronExpr || !input) {
      return new Response(
        JSON.stringify({ error: 'Missing workflow, cron schedule, or input' }),
        { status: 400 }
      );
    }

    const jobId = addCronJob(workflow, cronExpr, input);

    return new Response(
      JSON.stringify({ 
        message: 'Cron job scheduled successfully', 
        jobId,
        workflow,
        schedule: cronExpr 
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to schedule cron job', 
        details: error.message 
      }),
      { status: 500 }
    );
  }
}