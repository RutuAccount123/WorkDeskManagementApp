package com.decentdecor.workdesk.dto.report;

/**
 * Performance over a period. score = 60% completion rate + 40% on-time rate (out of 100).
 * Rates are percentages with one decimal; null when there is nothing to count.
 */
public record Performance(
        long total,
        long completed,
        long completedOnTime,
        long completedLate,
        long open,
        long overdue,
        long selfAdded,
        Double completionRate,
        Double onTimeRate,
        Integer score,
        String rating,
        Double avgCompletionHours) {
}
