package com.decentdecor.workdesk.dto.report;

/** GET /api/reports/employees (and the CSV download): one row per person for a date range. */
public record EmployeeSummaryRow(
        Long employeeId,
        String employeeName,
        String department,
        long assigned,
        long completed,
        long completedOnTime,
        long completedLate,
        long openNow,
        long overdueNow,
        Double onTimeRate,
        Double avgCompletionHours) {
}
