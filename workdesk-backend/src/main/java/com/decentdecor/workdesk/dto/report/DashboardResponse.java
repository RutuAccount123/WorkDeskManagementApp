package com.decentdecor.workdesk.dto.report;

import java.util.Map;

/** Headline numbers. Admin: everyone's work. Employee: their own. */
public record DashboardResponse(
        long totalOpen,
        long todo,
        long inProgress,
        long awaitingReview,
        long overdue,
        long dueToday,
        long completedToday,
        long completedThisWeek,
        Map<String, Long> openByPriority) {
}
