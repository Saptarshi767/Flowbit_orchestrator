import { promises as fs } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const user = session.user as SessionUser;
  try {
    const file = await fs.readFile('executions.json', 'utf-8')
    const allExecutions = JSON.parse(file)
    const executions = allExecutions.filter((e: any) => e.userId === user.id)
    return NextResponse.json({ executions })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load executions.json', details: err }, { status: 500 })
  }
}