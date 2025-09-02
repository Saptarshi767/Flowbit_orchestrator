import * as cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const JOBS_FILE = path.join(process.cwd(), 'cron-config.json');
const EXECUTIONS_FILE = path.join(process.cwd(), 'executions.json');

type CronJob = {
  workflowId: string;
  schedule: string;
  input: any;
  id: string;
  userId?: string;
};

let jobs: CronJob[] = [];
let scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

function updateExecutionStatus(executionId: string, status: string, output?: string, error?: string) {
  try {
    if (!fs.existsSync(EXECUTIONS_FILE)) return;
    const file = fs.readFileSync(EXECUTIONS_FILE, 'utf-8');
    const executions = JSON.parse(file);
    const idx = executions.findIndex((e: any) => e.id === executionId);
    if (idx !== -1) {
      executions[idx].status = status;
      if (output) executions[idx].output = output;
      if (error) executions[idx].error = error;
      executions[idx].endTime = new Date().toISOString();
    }
    fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify(executions, null, 2));
  } catch {}
}

function runWorkflow(workflowId: string, input: any, userId?: string) {
  const flowPath = path.join(process.cwd(), 'flows', workflowId + '.json');
  const executionId = uuidv4();
  // Add execution with status Running
  let allExecutions = [];
  try {
    if (fs.existsSync(EXECUTIONS_FILE)) {
      const file = fs.readFileSync(EXECUTIONS_FILE, 'utf-8');
      allExecutions = JSON.parse(file);
    }
  } catch {}
  const execution = {
    id: executionId,
    userId: userId || null,
    flow: workflowId,
    status: 'Running',
    input,
    output: '',
    error: null,
    startTime: new Date().toISOString(),
    duration: 0
  };
  allExecutions.push(execution);
  fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify(allExecutions, null, 2));

  const python = spawn(process.platform === 'win32' ? 'python' : 'python3', ['run_flow.py', flowPath, JSON.stringify(input)], {
    cwd: process.cwd(),
    shell: true,
  });

  let output = '';
  let error = '';

  python.stdout.on('data', (data) => {
    output += data.toString();
    console.log(`[CRON-${workflowId}]`, data.toString());
  });

  python.stderr.on('data', (data) => {
    error += data.toString();
    console.error(`[CRON-${workflowId}-ERROR]`, data.toString());
  });

  python.on('close', (code) => {
    if (code === 0) {
      updateExecutionStatus(executionId, 'Success', output, undefined);
    } else {
      updateExecutionStatus(executionId, 'Failed', output, error || 'Unknown error');
    }
  });
}

function migrateCronConfigIfNeeded() {
  if (!fs.existsSync(JOBS_FILE)) return;
  const data = fs.readFileSync(JOBS_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Already correct format
      return;
    }
    // If it's an object, convert to array
    if (typeof parsed === 'object' && parsed !== null) {
      const arr = Object.entries(parsed).map(([workflowId, schedule]) => ({
        workflowId,
        schedule,
        input: {},
        id: `${workflowId}-${Date.now()}`
      }));
      fs.writeFileSync(JOBS_FILE, JSON.stringify(arr, null, 2));
    }
  } catch (e) {
    // If parsing fails, reset to empty array
    fs.writeFileSync(JOBS_FILE, JSON.stringify([], null, 2));
  }
}

// Call migration at the top of the file
migrateCronConfigIfNeeded();

export function setupCronJobs() {
  if (!fs.existsSync(JOBS_FILE)) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify([]));
    return;
  }

  const data = fs.readFileSync(JOBS_FILE, 'utf-8');
  jobs = JSON.parse(data);

  for (const job of jobs) {
    if (cron.validate(job.schedule)) {
      const task = cron.schedule(job.schedule, () => runWorkflow(job.workflowId, job.input, job.userId), {
        scheduled: false
      });
      task.start();
      scheduledTasks.set(job.id, task);
      console.log(`Scheduled cron job: ${job.workflowId} with schedule: ${job.schedule}`);
    }
  }
}

export function addCronJob(workflowId: string, schedule: string, input: any, userId?: string): string {
  const jobId = `${workflowId}-${Date.now()}`;
  const job: CronJob = {
    id: jobId,
    workflowId,
    schedule,
    input,
    userId
  };

  if (!cron.validate(schedule)) {
    throw new Error('Invalid cron schedule');
  }

  jobs.push(job);
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));

  const task = cron.schedule(schedule, () => runWorkflow(workflowId, input, userId), {
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
