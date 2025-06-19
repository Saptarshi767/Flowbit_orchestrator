import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const { id } = context.params
  const logPath = path.join(process.cwd(), 'logs', `${id}.log`)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const fileStream = fs.createReadStream(logPath, { encoding: 'utf-8' })
        fileStream.on('data', (chunk) => {
          const lines = chunk.toString().split('\n')
          for (const line of lines) {
            if (line.trim()) {
              controller.enqueue(`data: ${line}\n\n`)
            }
          }
        })
        fileStream.on('end', () => {
          controller.close()
        })
        fileStream.on('error', (err) => {
          controller.enqueue(`event: error\ndata: ${err.message}\n\n`)
          controller.close()
        })
      } catch (err) {
        controller.enqueue(`event: error\ndata: ${err}\n\n`)
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    }
  })
}