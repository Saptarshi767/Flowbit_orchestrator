import { NextRequest } from 'next/server';
import { addCronJob } from '@/lib/cron';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !('id' in session.user) || !session.user.id) {
    return new Response(
      JSON.stringify({ error: 'Not authenticated' }),
      { status: 401 }
    );
  }
  const userId = session.user.id;
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

    const jobId = addCronJob(workflow, cronExpr, input, userId);

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