import * as cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const JOBS_FILE = path.join(process.cwd(), 'cron-config.json');

type CronJob = {
  workflowId: string;
  schedule: string;
  input: any;
  id: string;
};

let jobs: CronJob[] = [];
let scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

function runWorkflow(workflowId: string, input: any) {
  const flowPath = path.join(process.cwd(), 'flows', workflowId + '.json');
  const python = spawn(process.platform === 'win32' ? 'python' : 'python3', ['run_flow.py', flowPath, JSON.stringify(input)], {
    cwd: process.cwd(),
    shell: true,
  });

  python.stdout.on('data', (data) => {
    console.log(`[CRON-${workflowId}]`, data.toString());
  });

  python.stderr.on('data', (data) => {
    console.error(`[CRON-${workflowId}-ERROR]`, data.toString());
  });
}

export function setupCronJobs() {
  if (!fs.existsSync(JOBS_FILE)) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify([]));
    return;
  }

  const data = fs.readFileSync(JOBS_FILE, 'utf-8');
  jobs = JSON.parse(data);

  for (const job of jobs) {
    if (cron.validate(job.schedule)) {
      const task = cron.schedule(job.schedule, () => runWorkflow(job.workflowId, job.input), {
        scheduled: false
      });
      task.start();
      scheduledTasks.set(job.id, task);
      console.log(`Scheduled cron job: ${job.workflowId} with schedule: ${job.schedule}`);
    }
  }
}

export function addCronJob(workflowId: string, schedule: string, input: any): string {
  const jobId = `${workflowId}-${Date.now()}`;
  const job: CronJob = {
    id: jobId,
    workflowId,
    schedule,
    input
  };

  if (!cron.validate(schedule)) {
    throw new Error('Invalid cron schedule');
  }

  jobs.push(job);
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));

  const task = cron.schedule(schedule, () => runWorkflow(workflowId, input), {
    scheduled: false
  });
  task.start();
  scheduledTasks.set(jobId, task);

  return jobId;
}

export function removeCronJob(jobId: string): boolean {
  const task = scheduledTasks.get(jobId);
  if (task) {
    task.stop();
    scheduledTasks.delete(jobId);
  }

  jobs = jobs.filter(job => job.id !== jobId);
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));

  return true;
}

export function getCronJobs(): CronJob[] {
  return jobs;
}
