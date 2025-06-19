import fs from 'fs';
import path from 'path';

export default function SampleDataPage() {
  // Get real workflow names from the flows directory
  let workflowNames: string[] = [];
  try {
    workflowNames = fs.readdirSync(path.join(process.cwd(), 'flows'))
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (e) {
    workflowNames = ['Could not load workflows'];
  }

  // Get a real execution sample from executions.json
  let executionSample: any = null;
  try {
    const executions = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'executions.json'), 'utf-8'));
    executionSample = executions.length > 0 ? executions[executions.length - 1] : null;
  } catch (e) {
    executionSample = { error: 'Could not load execution sample' };
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">FlowBit Real Workflows & Sample Data</h1>
      <h2 className="text-xl font-semibold mb-2">Available Workflows</h2>
      <ul className="mb-8 list-disc pl-6">
        {workflowNames.map(name => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <h2 className="text-xl font-semibold mb-2">Sample Execution Record</h2>
      <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
        {JSON.stringify(executionSample, null, 2)}
      </pre>
    </div>
  );
}
