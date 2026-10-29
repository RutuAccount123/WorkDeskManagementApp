package com.decentdecor.workdesk.dto.report;

/** This month's score on a team card. */
public record MonthSummary(Integer score, String rating, long total, long completed, Double onTimeRate) {
}
