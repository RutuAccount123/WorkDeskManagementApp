package com.decentdecor.workdesk.dto.task;

import java.time.LocalDate;
import java.util.List;

/**
 * Filters of GET /api/tasks.
 * scope: assigned (to me) | created (I assigned to others) | review (I review) | all (admin: everyone).
 * workFrom / workTo: the day the work belongs to (due date, or the day it was added).
 */
public record TaskFilter(
        String scope,
        List<String> status,
        Long assigneeId,
        String priority,
        Boolean overdue,
        String q,
        LocalDate workFrom,
        LocalDate workTo) {
}
