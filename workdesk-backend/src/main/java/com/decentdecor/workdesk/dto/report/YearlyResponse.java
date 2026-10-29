package com.decentdecor.workdesk.dto.report;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.List;

/** GET /api/reports/yearly: the whole year plus each month. */
public record YearlyResponse(Long employeeId, int year, @JsonUnwrapped Performance performance, List<MonthPerformance> months) {
}
