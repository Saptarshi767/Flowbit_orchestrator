import { ExecutionDetailsSample } from "@/components/execution-details-sample"

export default function SampleDataPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">FlowBit Integration Sample Data</h1>
      <p className="text-gray-600 mb-8">
        This page demonstrates how execution data from n8n and Langflow is displayed in the FlowBit dashboard.
        Developers can use this as a reference for integrating with real instances.
      </p>

      <ExecutionDetailsSample />
    </div>
  )
}
