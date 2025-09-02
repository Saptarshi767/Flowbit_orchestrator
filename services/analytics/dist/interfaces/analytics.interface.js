"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportStatus = exports.AnalyticsDataType = void 0;
var AnalyticsDataType;
(function (AnalyticsDataType) {
    AnalyticsDataType["EXECUTION"] = "execution";
    AnalyticsDataType["WORKFLOW"] = "workflow";
    AnalyticsDataType["USER_ACTION"] = "user_action";
    AnalyticsDataType["SYSTEM_METRIC"] = "system_metric";
    AnalyticsDataType["PERFORMANCE"] = "performance";
    AnalyticsDataType["BILLING"] = "billing";
})(AnalyticsDataType || (exports.AnalyticsDataType = AnalyticsDataType = {}));
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["PENDING"] = "pending";
    ReportStatus["GENERATING"] = "generating";
    ReportStatus["COMPLETED"] = "completed";
    ReportStatus["FAILED"] = "failed";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
//# sourceMappingURL=analytics.interface.js.map