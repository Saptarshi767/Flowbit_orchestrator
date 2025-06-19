import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

export async function runWorkflow(workflowName: string, input: Record<string, any>) {
  const workflowPath = path.join(process.cwd(), 'flows', `${workflowName}.json`)
  const inputStr = JSON.stringify(input).replace(/'/g, "\\'")
  return new Promise((resolve, reject) => {
    exec(`python3 run_flow.py '${workflowPath}' '${inputStr}'`, (err, stdout, stderr) => {
      if (err) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}