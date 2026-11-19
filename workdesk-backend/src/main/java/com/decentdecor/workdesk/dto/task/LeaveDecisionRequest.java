package com.decentdecor.workdesk.dto.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * POST /api/tasks/{id}/leave-decision — for a task that fell on the person's leave day.
 * decision ALLOW: do it later, dueAt = the new due date-time ("yyyy-mm-ddThh:mm", today or later).
 * decision DENY: skip it (the task is cancelled; whoever assigned it is told). note is optional.
 */
public record LeaveDecisionRequest(
        @NotBlank(message = "decision: choose ALLOW or DENY") String decision,
        String dueAt,
        @Size(max = 1000, message = "note: must be 1000 characters or fewer") String note) {
}
