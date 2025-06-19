import { spawn } from "child_process"

export async function execMCP(flowName: string, input: Record<string, any>): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "mcp-proxy",
      "http://localhost:7860/api/v1/mcp/project/2e64b69c-ce58-442d-afd5-8c5f5aa48fb7/sse"
    ]

    const subprocess = spawn("uvx", args)

    let output = ""
    let errorOutput = ""

    subprocess.stdout.on("data", (data) => {
      output += data.toString()
    })

    subprocess.stderr.on("data", (data) => {
      errorOutput += data.toString()
    })

    subprocess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || "uvx exited with code " + code))
      } else {
        resolve(output.trim())
      }
    })

    subprocess.stdin.write(JSON.stringify({
      action: flowName,
      input: input
    }))
    subprocess.stdin.end()
  })
}