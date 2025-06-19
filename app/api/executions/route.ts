import { promises as fs } from 'fs'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const file = await fs.readFile('executions.json', 'utf-8')
    const executions = JSON.parse(file)
    return NextResponse.json({ executions })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load executions.json', details: err }, { status: 500 })
  }
}