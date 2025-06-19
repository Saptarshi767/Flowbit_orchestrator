import fs from "fs"
import path from "path"

export async function GET() {
  const filePath = path.join(process.cwd(), "executions.json")
  const runs = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : []

  return Response.json({ runs })
}