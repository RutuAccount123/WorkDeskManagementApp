package com.decentdecor.workdesk.dto.report;

import java.util.Map;

/**
 * Headline numbers. Admin: everyone's work. Employee: their own.
 * pending: open work with an open ticket; it is counted only there, not in todo / inProgress / awaitingReview / overdue / dueToday.
 */
public record DashboardResponse(
        long totalOpen,
        long todo,
        long inProgress,
        long awaitingReview,
        long overdue,
        long dueToday,
        long completedToday,
        long completedThisWeek,
        long pending,
        Map<String, Long> openByPriority) {
}
