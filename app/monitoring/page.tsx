import { MonitoringDashboard } from "@/components/monitoring/monitoring-dashboard"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export default function MonitoringPage() {
  return (
    <DashboardLayout>
      <MonitoringDashboard />
    </DashboardLayout>
  )
}