import { NextRequest } from 'next/server';
import { addCronJob } from '@/lib/cron';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflow, cron, input } = body;

    if (!workflow || !cron || !input) {
      return new Response(
        JSON.stringify({ error: 'Missing workflow, cron schedule, or input' }),
        { status: 400 }
      );
    }

    const jobId = addCronJob(workflow, cron, input);

    return new Response(
      JSON.stringify({ 
        message: 'Cron job scheduled successfully', 
        jobId,
        workflow,
        schedule: cron 
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