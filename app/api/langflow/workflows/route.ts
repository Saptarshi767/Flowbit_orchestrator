import fs from 'fs';
import path from 'path';

export async function GET() {
  const flowDir = path.join(process.cwd(), 'flows');
  const files = fs.existsSync(flowDir)
    ? fs.readdirSync(flowDir).filter(file => file.endsWith('.json'))
    : [];
  const flows = files.map(file => {
    const filePath = path.join(flowDir, file);
    let engine = 'flowbit';
    let name = file.replace('.json', '');
    let description = '';
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      if (json.data && json.data.nodes && json.data.edges) {
        engine = 'langflow';
        name = json.data.name || name;
        description = json.data.description || '';
      } else if (json.nodes && json.edges) {
        engine = 'flowbit';
        name = json.name || name;
        description = json.description || '';
      }
    } catch (e) {
      // ignore parse errors, fallback to defaults
    }
    return {
      name,
      filename: file,
      engine,
      description
    };
  });
  return Response.json(flows);
}