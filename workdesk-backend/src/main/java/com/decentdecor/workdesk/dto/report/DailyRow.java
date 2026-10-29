package com.decentdecor.workdesk.dto.report;

import java.time.LocalDate;

/** GET /api/reports/daily: one row per day. */
public record DailyRow(LocalDate date, long created, long due, long completed, long completedOnTime) {
}
