package com.decentdecor.workdesk.dto.report;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.List;

/** GET /api/reports/performance. The Performance fields appear at the top level of the JSON. */
public record PerformanceResponse(Long employeeId, String month, @JsonUnwrapped Performance performance, List<TrendPoint> trend) {
}
