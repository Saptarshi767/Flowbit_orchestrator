"use strict";
// Core types for the robust AI orchestrator platform
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportFormat = exports.LogLevel = exports.InstanceStatus = exports.HealthStatus = exports.WidgetType = exports.NotificationChannelType = exports.AlertStatus = exports.AlertSeverity = exports.AlertOperator = exports.ExecutionStatus = exports.EngineType = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["USER"] = "user";
    UserRole["VIEWER"] = "viewer";
})(UserRole || (exports.UserRole = UserRole = {}));
// Engine and Workflow Types
var EngineType;
(function (EngineType) {
    EngineType["LANGFLOW"] = "langflow";
    EngineType["N8N"] = "n8n";
    EngineType["LANGSMITH"] = "langsmith";
})(EngineType || (exports.EngineType = EngineType = {}));
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["PENDING"] = "pending";
    ExecutionStatus["RUNNING"] = "running";
    ExecutionStatus["COMPLETED"] = "completed";
    ExecutionStatus["FAILED"] = "failed";
    ExecutionStatus["CANCELLED"] = "cancelled";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
var AlertOperator;
(function (AlertOperator) {
    AlertOperator["GREATER_THAN"] = "gt";
    AlertOperator["LESS_THAN"] = "lt";
    AlertOperator["EQUALS"] = "eq";
    AlertOperator["NOT_EQUALS"] = "ne";
    AlertOperator["GREATER_THAN_OR_EQUAL"] = "gte";
    AlertOperator["LESS_THAN_OR_EQUAL"] = "lte";
})(AlertOperator || (exports.AlertOperator = AlertOperator = {}));
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["LOW"] = "low";
    AlertSeverity["MEDIUM"] = "medium";
    AlertSeverity["HIGH"] = "high";
    AlertSeverity["CRITICAL"] = "critical";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["TRIGGERED"] = "triggered";
    AlertStatus["RESOLVED"] = "resolved";
    AlertStatus["ACKNOWLEDGED"] = "acknowledged";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
var NotificationChannelType;
(function (NotificationChannelType) {
    NotificationChannelType["EMAIL"] = "email";
    NotificationChannelType["SLACK"] = "slack";
    NotificationChannelType["WEBHOOK"] = "webhook";
    NotificationChannelType["SMS"] = "sms";
})(NotificationChannelType || (exports.NotificationChannelType = NotificationChannelType = {}));
var WidgetType;
(function (WidgetType) {
    WidgetType["LINE_CHART"] = "line_chart";
    WidgetType["BAR_CHART"] = "bar_chart";
    WidgetType["GAUGE"] = "gauge";
    WidgetType["COUNTER"] = "counter";
    WidgetType["TABLE"] = "table";
    WidgetType["HEATMAP"] = "heatmap";
})(WidgetType || (exports.WidgetType = WidgetType = {}));
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["HEALTHY"] = "healthy";
    HealthStatus["DEGRADED"] = "degraded";
    HealthStatus["UNHEALTHY"] = "unhealthy";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
var InstanceStatus;
(function (InstanceStatus) {
    InstanceStatus["ACTIVE"] = "active";
    InstanceStatus["INACTIVE"] = "inactive";
    InstanceStatus["DRAINING"] = "draining";
})(InstanceStatus || (exports.InstanceStatus = InstanceStatus = {}));
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var ReportFormat;
(function (ReportFormat) {
    ReportFormat["JSON"] = "json";
    ReportFormat["CSV"] = "csv";
    ReportFormat["PDF"] = "pdf";
    ReportFormat["HTML"] = "html";
})(ReportFormat || (exports.ReportFormat = ReportFormat = {}));
//# sourceMappingURL=index.js.map