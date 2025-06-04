// GET /api/hooks/:workflowId - Public webhook trigger
export async function GET() { return Response.json({ message: 'Triggered' }); }