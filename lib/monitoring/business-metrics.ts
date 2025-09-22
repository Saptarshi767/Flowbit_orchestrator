import { MetricsService } from './metrics';
import { EventEmitter } from 'events';

export interface BusinessMetrics {
  // User Engagement Metrics
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  userRetention: {
    day1: number;
    day7: number;
    day30: number;
  };
  sessionMetrics: {
    averageSessionDuration: number;
    sessionsPerUser: number;
    bounceRate: number;
  };

  // Workflow Metrics
  workflowMetrics: {
    totalWorkflows: number;
    activeWorkflows: number;
    workflowsCreatedToday: number;
    averageWorkflowComplexity: number;
  };
  executionMetrics: {
    totalExecutions: number;
    executionsToday: number;
    successRate: number;
    averageExecutionTime: number;
    executionsPerWorkflow: number;
  };

  // Revenue Metrics
  revenueMetrics: {
    monthlyRecurringRevenue: number;
    averageRevenuePerUser: number;
    customerLifetimeValue: number;
    churnRate: number;
  };
  usageMetrics: {
    apiCallsPerUser: number;
    storageUsagePerUser: number;
    computeUsagePerUser: number;
  };

  // Platform Health Metrics
  platformMetrics: {
    systemUptime: number;
    averageResponseTime: number;
    errorRate: number;
    supportTickets: number;
  };
  performanceMetrics: {
    throughput: number;
    concurrentUsers: number;
    resourceUtilization: number;
  };
}

export interface KPITarget {
  name: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'on-track' | 'at-risk' | 'off-track';
}

export class BusinessMetricsService extends EventEmitter {
  private metricsService: MetricsService;
  private kpiTargets: Map<string, KPITarget> = new Map();

  constructor() {
    super();
    this.metricsService = MetricsService.getInstance();
    this.initializeKPITargets();
  }

  private initializeKPITargets(): void {
    // Define KPI targets
    const targets: KPITarget[] = [
      {
        name: 'monthly_active_users',
        currentValue: 0,
        targetValue: 10000,
        unit: 'users',
        trend: 'stable',
        status: 'on-track'
      },
      {
        name: 'workflow_success_rate',
        currentValue: 0,
        targetValue: 99.5,
        unit: '%',
        trend: 'stable',
        status: 'on-track'
      },
      {
        name: 'average_response_time',
        currentValue: 0,
        targetValue: 500,
        unit: 'ms',
        trend: 'stable',
        status: 'on-track'
      },
      {
        name: 'monthly_recurring_revenue',
        currentValue: 0,
        targetValue: 100000,
        unit: 'USD',
        trend: 'stable',
        status: 'on-track'
      },
      {
        name: 'customer_satisfaction',
        currentValue: 0,
        targetValue: 4.5,
        unit: 'score',
        trend: 'stable',
        status: 'on-track'
      }
    ];

    targets.forEach(target => {
      this.kpiTargets.set(target.name, target);
    });
  }

  public async collectBusinessMetrics(): Promise<BusinessMetrics> {
    const metrics: BusinessMetrics = {
      activeUsers: await this.calculateActiveUsers(),
      userRetention: await this.calculateUserRetention(),
      sessionMetrics: await this.calculateSessionMetrics(),
      workflowMetrics: await this.calculateWorkflowMetrics(),
      executionMetrics: await this.calculateExecutionMetrics(),
      revenueMetrics: await this.calculateRevenueMetrics(),
      usageMetrics: await this.calculateUsageMetrics(),
      platformMetrics: await this.calculatePlatformMetrics(),
      performanceMetrics: await this.calculatePerformanceMetrics()
    };

    // Update KPI targets with current values
    this.updateKPITargets(metrics);

    // Emit metrics collected event
    this.emit('metricsCollected', metrics);

    return metrics;
  }

  private async calculateActiveUsers(): Promise<BusinessMetrics['activeUsers']> {
    // This would typically query your database
    // For now, we'll simulate the calculation
    const daily = await this.queryMetric('SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE created_at >= NOW() - INTERVAL \'1 day\'');
    const weekly = await this.queryMetric('SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE created_at >= NOW() - INTERVAL \'7 days\'');
    const monthly = await this.queryMetric('SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE created_at >= NOW() - INTERVAL \'30 days\'');

    // Update Prometheus metrics
    this.metricsService.activeUsers.set({ time_window: 'daily' }, daily);
    this.metricsService.activeUsers.set({ time_window: 'weekly' }, weekly);
    this.metricsService.activeUsers.set({ time_window: 'monthly' }, monthly);

    return { daily, weekly, monthly };
  }

  private async calculateUserRetention(): Promise<BusinessMetrics['userRetention']> {
    const day1 = await this.queryMetric(`
      SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '2 days' AND created_at < NOW() - INTERVAL '1 day')
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE u.created_at >= NOW() - INTERVAL '2 days' 
      AND u.created_at < NOW() - INTERVAL '1 day'
      AND us.created_at >= u.created_at + INTERVAL '1 day'
      AND us.created_at < u.created_at + INTERVAL '2 days'
    `);

    const day7 = await this.queryMetric(`
      SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '8 days' AND created_at < NOW() - INTERVAL '7 days')
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE u.created_at >= NOW() - INTERVAL '8 days' 
      AND u.created_at < NOW() - INTERVAL '7 days'
      AND us.created_at >= u.created_at + INTERVAL '7 days'
      AND us.created_at < u.created_at + INTERVAL '8 days'
    `);

    const day30 = await this.queryMetric(`
      SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '31 days' AND created_at < NOW() - INTERVAL '30 days')
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE u.created_at >= NOW() - INTERVAL '31 days' 
      AND u.created_at < NOW() - INTERVAL '30 days'
      AND us.created_at >= u.created_at + INTERVAL '30 days'
      AND us.created_at < u.created_at + INTERVAL '31 days'
    `);

    return { day1, day7, day30 };
  }

  private async calculateSessionMetrics(): Promise<BusinessMetrics['sessionMetrics']> {
    const averageSessionDuration = await this.queryMetric(`
      SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) 
      FROM user_sessions 
      WHERE ended_at IS NOT NULL 
      AND created_at >= NOW() - INTERVAL '24 hours'
    `);

    const sessionsPerUser = await this.queryMetric(`
      SELECT AVG(session_count) FROM (
        SELECT COUNT(*) as session_count 
        FROM user_sessions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY user_id
      ) subquery
    `);

    const bounceRate = await this.queryMetric(`
      SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_sessions WHERE created_at >= NOW() - INTERVAL '24 hours')
      FROM user_sessions 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND (ended_at - started_at) < INTERVAL '30 seconds'
    `);

    return { averageSessionDuration, sessionsPerUser, bounceRate };
  }

  private async calculateWorkflowMetrics(): Promise<BusinessMetrics['workflowMetrics']> {
    const totalWorkflows = await this.queryMetric('SELECT COUNT(*) FROM workflows');
    const activeWorkflows = await this.queryMetric('SELECT COUNT(*) FROM workflows WHERE status = \'active\'');
    const workflowsCreatedToday = await this.queryMetric('SELECT COUNT(*) FROM workflows WHERE created_at >= CURRENT_DATE');
    const averageWorkflowComplexity = await this.queryMetric('SELECT AVG(complexity_score) FROM workflows WHERE complexity_score IS NOT NULL');

    return { totalWorkflows, activeWorkflows, workflowsCreatedToday, averageWorkflowComplexity };
  }

  private async calculateExecutionMetrics(): Promise<BusinessMetrics['executionMetrics']> {
    const totalExecutions = await this.queryMetric('SELECT COUNT(*) FROM executions');
    const executionsToday = await this.queryMetric('SELECT COUNT(*) FROM executions WHERE created_at >= CURRENT_DATE');
    
    const successfulExecutions = await this.queryMetric('SELECT COUNT(*) FROM executions WHERE status = \'completed\' AND created_at >= NOW() - INTERVAL \'24 hours\'');
    const totalExecutionsLast24h = await this.queryMetric('SELECT COUNT(*) FROM executions WHERE created_at >= NOW() - INTERVAL \'24 hours\'');
    const successRate = totalExecutionsLast24h > 0 ? (successfulExecutions / totalExecutionsLast24h) * 100 : 0;

    const averageExecutionTime = await this.queryMetric(`
      SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) 
      FROM executions 
      WHERE ended_at IS NOT NULL 
      AND created_at >= NOW() - INTERVAL '24 hours'
    `);

    const executionsPerWorkflow = await this.queryMetric(`
      SELECT AVG(execution_count) FROM (
        SELECT COUNT(*) as execution_count 
        FROM executions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY workflow_id
      ) subquery
    `);

    return { totalExecutions, executionsToday, successRate, averageExecutionTime, executionsPerWorkflow };
  }

  private async calculateRevenueMetrics(): Promise<BusinessMetrics['revenueMetrics']> {
    const monthlyRecurringRevenue = await this.queryMetric(`
      SELECT SUM(amount) 
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.status = 'active'
      AND sp.billing_cycle = 'monthly'
    `);

    const totalActiveUsers = await this.queryMetric('SELECT COUNT(*) FROM users WHERE status = \'active\'');
    const averageRevenuePerUser = totalActiveUsers > 0 ? monthlyRecurringRevenue / totalActiveUsers : 0;

    const customerLifetimeValue = await this.queryMetric(`
      SELECT AVG(lifetime_value) 
      FROM user_analytics 
      WHERE calculated_at >= NOW() - INTERVAL '30 days'
    `);

    const churnRate = await this.queryMetric(`
      SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM subscriptions WHERE created_at < NOW() - INTERVAL '30 days')
      FROM subscriptions 
      WHERE status = 'cancelled' 
      AND cancelled_at >= NOW() - INTERVAL '30 days'
    `);

    return { monthlyRecurringRevenue, averageRevenuePerUser, customerLifetimeValue, churnRate };
  }

  private async calculateUsageMetrics(): Promise<BusinessMetrics['usageMetrics']> {
    const totalUsers = await this.queryMetric('SELECT COUNT(*) FROM users WHERE status = \'active\'');
    
    const totalApiCalls = await this.queryMetric('SELECT COUNT(*) FROM api_requests WHERE created_at >= NOW() - INTERVAL \'24 hours\'');
    const apiCallsPerUser = totalUsers > 0 ? totalApiCalls / totalUsers : 0;

    const totalStorageUsage = await this.queryMetric('SELECT SUM(storage_bytes) FROM user_storage');
    const storageUsagePerUser = totalUsers > 0 ? totalStorageUsage / totalUsers : 0;

    const totalComputeUsage = await this.queryMetric('SELECT SUM(compute_seconds) FROM execution_metrics WHERE created_at >= NOW() - INTERVAL \'24 hours\'');
    const computeUsagePerUser = totalUsers > 0 ? totalComputeUsage / totalUsers : 0;

    return { apiCallsPerUser, storageUsagePerUser, computeUsagePerUser };
  }

  private async calculatePlatformMetrics(): Promise<BusinessMetrics['platformMetrics']> {
    const systemUptime = await this.queryMetric('SELECT AVG(uptime_percentage) FROM system_health WHERE recorded_at >= NOW() - INTERVAL \'24 hours\'');
    const averageResponseTime = await this.queryMetric('SELECT AVG(response_time_ms) FROM api_metrics WHERE created_at >= NOW() - INTERVAL \'1 hour\'');
    const errorRate = await this.queryMetric('SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM api_requests WHERE created_at >= NOW() - INTERVAL \'1 hour\') FROM api_requests WHERE status_code >= 500 AND created_at >= NOW() - INTERVAL \'1 hour\'');
    const supportTickets = await this.queryMetric('SELECT COUNT(*) FROM support_tickets WHERE status = \'open\'');

    return { systemUptime, averageResponseTime, errorRate, supportTickets };
  }

  private async calculatePerformanceMetrics(): Promise<BusinessMetrics['performanceMetrics']> {
    const throughput = await this.queryMetric('SELECT COUNT(*) FROM api_requests WHERE created_at >= NOW() - INTERVAL \'1 minute\'');
    const concurrentUsers = await this.queryMetric('SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE ended_at IS NULL OR ended_at > NOW() - INTERVAL \'5 minutes\'');
    const resourceUtilization = await this.queryMetric('SELECT AVG(cpu_usage_percent) FROM system_metrics WHERE recorded_at >= NOW() - INTERVAL \'5 minutes\'');

    return { throughput, concurrentUsers, resourceUtilization };
  }

  private async queryMetric(query: string): Promise<number> {
    // This is a placeholder - in a real implementation, you would execute the SQL query
    // against your database and return the result
    console.log(`Executing query: ${query}`);
    return Math.random() * 100; // Simulated value
  }

  private updateKPITargets(metrics: BusinessMetrics): void {
    // Update KPI targets with current values
    const monthlyActiveUsers = this.kpiTargets.get('monthly_active_users');
    if (monthlyActiveUsers) {
      monthlyActiveUsers.currentValue = metrics.activeUsers.monthly;
      monthlyActiveUsers.trend = this.calculateTrend(monthlyActiveUsers.currentValue, monthlyActiveUsers.targetValue);
      monthlyActiveUsers.status = this.calculateStatus(monthlyActiveUsers.currentValue, monthlyActiveUsers.targetValue);
    }

    const workflowSuccessRate = this.kpiTargets.get('workflow_success_rate');
    if (workflowSuccessRate) {
      workflowSuccessRate.currentValue = metrics.executionMetrics.successRate;
      workflowSuccessRate.trend = this.calculateTrend(workflowSuccessRate.currentValue, workflowSuccessRate.targetValue);
      workflowSuccessRate.status = this.calculateStatus(workflowSuccessRate.currentValue, workflowSuccessRate.targetValue);
    }

    const averageResponseTime = this.kpiTargets.get('average_response_time');
    if (averageResponseTime) {
      averageResponseTime.currentValue = metrics.platformMetrics.averageResponseTime;
      averageResponseTime.trend = this.calculateTrend(averageResponseTime.currentValue, averageResponseTime.targetValue, true);
      averageResponseTime.status = this.calculateStatus(averageResponseTime.currentValue, averageResponseTime.targetValue, true);
    }

    const monthlyRecurringRevenue = this.kpiTargets.get('monthly_recurring_revenue');
    if (monthlyRecurringRevenue) {
      monthlyRecurringRevenue.currentValue = metrics.revenueMetrics.monthlyRecurringRevenue;
      monthlyRecurringRevenue.trend = this.calculateTrend(monthlyRecurringRevenue.currentValue, monthlyRecurringRevenue.targetValue);
      monthlyRecurringRevenue.status = this.calculateStatus(monthlyRecurringRevenue.currentValue, monthlyRecurringRevenue.targetValue);
    }
  }

  private calculateTrend(current: number, target: number, lowerIsBetter: boolean = false): 'up' | 'down' | 'stable' {
    const threshold = target * 0.05; // 5% threshold
    
    if (lowerIsBetter) {
      if (current < target - threshold) return 'up'; // Good trend (lower is better)
      if (current > target + threshold) return 'down'; // Bad trend (higher is worse)
    } else {
      if (current > target + threshold) return 'up'; // Good trend (higher is better)
      if (current < target - threshold) return 'down'; // Bad trend (lower is worse)
    }
    
    return 'stable';
  }

  private calculateStatus(current: number, target: number, lowerIsBetter: boolean = false): 'on-track' | 'at-risk' | 'off-track' {
    const atRiskThreshold = target * 0.1; // 10% threshold for at-risk
    const offTrackThreshold = target * 0.2; // 20% threshold for off-track

    if (lowerIsBetter) {
      if (current <= target) return 'on-track';
      if (current <= target + atRiskThreshold) return 'at-risk';
      return 'off-track';
    } else {
      if (current >= target) return 'on-track';
      if (current >= target - atRiskThreshold) return 'at-risk';
      return 'off-track';
    }
  }

  public getKPITargets(): KPITarget[] {
    return Array.from(this.kpiTargets.values());
  }

  public getKPITarget(name: string): KPITarget | undefined {
    return this.kpiTargets.get(name);
  }

  public updateKPITarget(name: string, target: Partial<KPITarget>): void {
    const existing = this.kpiTargets.get(name);
    if (existing) {
      Object.assign(existing, target);
      this.emit('kpiTargetUpdated', { name, target: existing });
    }
  }

  public generateBusinessReport(): string {
    const kpis = this.getKPITargets();
    let report = '# Business Metrics Report\n\n';
    
    report += '## Key Performance Indicators\n\n';
    kpis.forEach(kpi => {
      const statusEmoji = kpi.status === 'on-track' ? '✅' : kpi.status === 'at-risk' ? '⚠️' : '❌';
      const trendEmoji = kpi.trend === 'up' ? '📈' : kpi.trend === 'down' ? '📉' : '➡️';
      
      report += `### ${kpi.name.replace(/_/g, ' ').toUpperCase()}\n`;
      report += `- **Current**: ${kpi.currentValue} ${kpi.unit}\n`;
      report += `- **Target**: ${kpi.targetValue} ${kpi.unit}\n`;
      report += `- **Status**: ${statusEmoji} ${kpi.status}\n`;
      report += `- **Trend**: ${trendEmoji} ${kpi.trend}\n\n`;
    });

    return report;
  }
}